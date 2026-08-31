import { useMemo, useRef, useState } from "react";
import {
  courseColorHex,
  courseOnlyBoardLabel,
  extensionLabel,
  optionLabel,
  staffColor,
  staffDisplayName,
  totalMinutes,
} from "../api.js";

const START_HOUR = 11;
const END_HOUR = 24; // 表示ラベルは 11〜23
const TRAVEL_MIN = 20;
const STAFF_COL_W = 96;
const ROW_H = 52; // .tb-row の高さ（styles.cssと一致させること）

function toMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// シフト範囲の「隙間」＝受付不可（灰色表示）の区間を求める。
// 出勤前や複数シフトの間は灰色にするが、シフト終了後は残業の可能性があるため
// 灰色にしない（末尾の区間は追加しない）。
function computeOffDuty(ranges, dayStart, dayEnd) {
  if (!ranges.length) return [];
  const sorted = [...ranges]
    .map((r) => ({ start: Math.max(r.start, dayStart), end: Math.min(r.end, dayEnd) }))
    .filter((r) => r.start < r.end)
    .sort((a, b) => a.start - b.start);
  if (!sorted.length) return [{ start: dayStart, end: dayEnd }];

  const segments = [];
  let cursor = dayStart;
  for (const r of sorted) {
    if (r.start > cursor) segments.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  return segments;
}

/**
 * タイムボードの描画本体（通常画面／別ウィンドウ表示の両方から使う共通部品）
 * props: stores, staff, records, shifts, date, onSelect(record), hourWidth（1時間分の幅px、既定56）
 */
export default function TimeBoardGrid({
  stores,
  staff,
  records,
  shifts,
  breaks = [],
  attendance = [],
  date,
  onSelect,
  onSelectBreak,
  onMove,
  onStaffClick,
  hourWidth = 56,
}) {
  const HOUR_W = hourWidth;
  const MIN_W = HOUR_W / 60;

  // ---- ドラッグで時間・担当を変更する機能 ----
  // 少し（HOLD_MS）押さえてから動かすとドラッグ、それより早く指/マウスを離すとクリック（編集）扱いにする。
  const HOLD_MS = 220;
  const MOVE_THRESHOLD = 6; // これ以上動いたらクリックではなくドラッグ候補とみなす
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const findRecord = (id) => records.find((r) => r.id === id);

  const handleBlockPointerDown = (e, r) => {
    e.stopPropagation();
    const rowIndex = staffIdsToday.indexOf(r.staffId); // 見つからなければ-1（＝未定行）
    const info = {
      recordId: r.id,
      startX: e.clientX,
      startY: e.clientY,
      origStartMin: toMin(r.startTime),
      origRowIndex: rowIndex,
      dxPx: 0,
      dyPx: 0,
      active: false,
      moved: false,
    };
    info.timer = setTimeout(() => {
      if (dragRef.current && dragRef.current.recordId === r.id && !dragRef.current.moved) {
        dragRef.current = { ...dragRef.current, active: true };
        setDrag(dragRef.current);
      }
    }, HOLD_MS);
    dragRef.current = info;
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {
      // Safariなど一部環境でsetPointerCaptureが使えない場合は無視して続行
    }
  };

  const handleBlockPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        // 保持時間が経つ前に動いた＝ドラッグにはせず、スクロール等の邪魔もしないようキャンセル
        clearTimeout(d.timer);
        dragRef.current = null;
        setDrag(null);
      }
      return;
    }
    dragRef.current = { ...d, dxPx: dx, dyPx: dy, moved: true };
    setDrag(dragRef.current);
  };

  const handleBlockPointerUp = () => {
    const d = dragRef.current;
    if (!d) return;
    clearTimeout(d.timer);
    dragRef.current = null;
    const rec = findRecord(d.recordId);
    if (d.active && d.moved) {
      if (rec) {
        const deltaMin = Math.round(d.dxPx / MIN_W / 10) * 10;
        const newStartMin = Math.max(START_HOUR * 60, d.origStartMin + deltaMin);
        const rowDelta = Math.round(d.dyPx / ROW_H);
        let newRowIndex = d.origRowIndex + rowDelta;
        newRowIndex = Math.max(-1, Math.min(staffIdsToday.length - 1, newRowIndex));
        const newStaffId = newRowIndex === -1 ? "" : staffIdsToday[newRowIndex];
        if (newStartMin !== d.origStartMin || newStaffId !== rec.staffId) {
          onMove?.(rec, { startTime: minToHHMM(newStartMin), staffId: newStaffId });
        }
      }
    } else if (!d.moved && rec) {
      // 素早いクリック（ドラッグにならなかった）＝編集モーダルを開く
      onSelect?.(rec);
    }
    setDrag(null);
  };

  const dragTransform = (recordId) =>
    drag && drag.recordId === recordId && drag.active
      ? { transform: `translate(${drag.dxPx}px, ${drag.dyPx}px)`, opacity: 0.85, zIndex: 20 }
      : {};


  const staffName = (id) => staffDisplayName(staff.find((s) => s.id === id)) || "?";
  const buildingOf = (storeId) => stores.find((s) => s.id === storeId)?.building || "";

  // 本店＝ここが移動の起点・終点になる。isHomeフラグを優先し、
  // 未設定の場合のみ建物名に「パレス」を含む店舗をフォールバックで使う。
  const homeBuilding = useMemo(() => {
    const home =
      stores.find((s) => s.isHome) || stores.find((s) => s.building?.includes("パレス"));
    return home?.building || stores[0]?.building || "";
    // eslint-disable-next-line
  }, [stores]);

  const todaysShifts = useMemo(() => shifts.filter((s) => s.date === date), [shifts, date]);
  const todaysBreaks = useMemo(() => breaks.filter((b) => b.date === date), [breaks, date]);
  // staffId -> 出勤打刻時刻("HH:MM")
  const attendanceMap = useMemo(() => {
    const map = {};
    for (const a of attendance) {
      if (a.date === date && a.checkInTime) map[a.staffId] = a.checkInTime;
    }
    return map;
  }, [attendance, date]);

  // 出勤するスタッフ = 本日シフトのあるスタッフ ∪ 本日予約が入っているスタッフ（早い順）
  const staffIdsToday = useMemo(() => {
    const earliest = {};
    for (const s of todaysShifts) {
      const m = toMin(s.start);
      if (earliest[s.staffId] === undefined || m < earliest[s.staffId]) earliest[s.staffId] = m;
    }
    for (const r of records) {
      if (!r.staffId || !r.startTime) continue;
      const m = toMin(r.startTime);
      if (earliest[r.staffId] === undefined || m < earliest[r.staffId]) earliest[r.staffId] = m;
    }
    // 並び順は「シフト開始時刻」が第一優先。
    // 同じシフト開始時刻のメンバー内でのみ、実際の出勤打刻が早い人を上に持ってくる。
    // （15時シフトの人が早く来ても、11時シフトの人を追い越すことはない）
    return Object.entries(earliest)
      .sort((a, b) => {
        if (a[1] !== b[1]) return a[1] - b[1];
        const aIn = attendanceMap[a[0]];
        const bIn = attendanceMap[b[0]];
        if (aIn && bIn) return toMin(aIn) - toMin(bIn);
        if (aIn) return -1; // 出勤済みは未出勤より上
        if (bIn) return 1;
        return 0;
      })
      .map(([id]) => id);
  }, [todaysShifts, records, attendanceMap]);

  // スタッフごとの予約一覧 ＋ 移動ブロック ＋ シフト外（灰色）区間
  const dataByStaff = useMemo(() => {
    const dayStart = START_HOUR * 60;
    const dayEnd = END_HOUR * 60;
    const out = {};
    for (const staffId of staffIdsToday) {
      const apps = records
        .filter((r) => r.staffId === staffId && r.startTime)
        .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));

      // 本店以外の場所は、同じ建物が連続する「滞在」ごとにまとめ、
      // その滞在の前後にだけ移動20分を入れる（連続中は移動なし）。
      // 状態を引き継ぐ方式ではなく、滞在単位でグループ化してから
      // 判定するため、担当変更や時間変更の編集後も必ず正しく再計算される。
      const stays = [];
      for (const r of apps) {
        const bld = buildingOf(r.storeId);
        const last = stays[stays.length - 1];
        if (last && last.building === bld) {
          last.apps.push(r);
        } else {
          stays.push({ building: bld, apps: [r] });
        }
      }

      const travels = [];
      if (homeBuilding) {
        for (const stay of stays) {
          if (stay.building === homeBuilding) continue;
          const first = stay.apps[0];
          const last = stay.apps[stay.apps.length - 1];
          const firstStart = toMin(first.startTime);
          const lastStart = toMin(last.startTime);
          const lastEnd = lastStart + totalMinutes(last.course);
          travels.push({ start: firstStart - TRAVEL_MIN, end: firstStart });
          travels.push({ start: lastEnd, end: lastEnd + TRAVEL_MIN });
        }
      }

      const ranges = todaysShifts
        .filter((s) => s.staffId === staffId)
        .map((s) => ({ start: toMin(s.start), end: toMin(s.end) }));
      const offDuty = computeOffDuty(ranges, dayStart, dayEnd);

      const staffBreaks = todaysBreaks
        .filter((b) => b.staffId === staffId)
        .sort((a, b) => toMin(a.start) - toMin(b.start));

      out[staffId] = { apps, travels, offDuty, breaks: staffBreaks };
    }
    return out;
    // eslint-disable-next-line
  }, [staffIdsToday, records, todaysShifts, todaysBreaks, homeBuilding, stores]);

  // 担当未定の予約（タイムボード最下段に表示）
  const unassignedApps = useMemo(
    () =>
      records
        .filter((r) => !r.staffId && r.startTime)
        .sort((a, b) => toMin(a.startTime) - toMin(b.startTime)),
    [records],
  );

  // 担当未定の予約が時間帯で重なる場合、段を分けて縦に並べる（貪欲法でレーン割り当て）
  const unassignedLaneOf = useMemo(() => {
    const map = new Map();
    const laneEnds = [];
    for (const r of unassignedApps) {
      const s = toMin(r.startTime);
      const e = s + (totalMinutes(r.course) || 60);
      let placed = false;
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] <= s) {
          laneEnds[i] = e;
          map.set(r.id, i);
          placed = true;
          break;
        }
      }
      if (!placed) {
        laneEnds.push(e);
        map.set(r.id, laneEnds.length - 1);
      }
    }
    return { map, laneCount: laneEnds.length || 1 };
  }, [unassignedApps]);

  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) hours.push(h);
  const totalMin = (END_HOUR - START_HOUR) * 60;
  const laneW = totalMin * MIN_W;

  // グリッド線（10分刻み）を 0〜終端まで一括生成し、最後の境界線も必ず引く
  const gridMarks = [];
  for (let m = 0; m <= totalMin; m += 10) {
    gridMarks.push({ pos: m * MIN_W, major: m % 60 === 0 });
  }

  const blockStyle = (startMin, minutes, color) => ({
    left: (startMin - START_HOUR * 60) * MIN_W,
    width: Math.max(minutes * MIN_W - 2, 10),
    background: color,
  });

  const fillStyle = (startMin, endMin) => ({
    left: (startMin - START_HOUR * 60) * MIN_W,
    width: Math.max((endMin - startMin) * MIN_W, 0),
  });

  if (staffIdsToday.length === 0 && unassignedApps.length === 0) {
    return (
      <div className="empty">本日出勤予定のスタッフがいません（シフトタブで登録してください）</div>
    );
  }

  return (
    <div className="tb-scroll">
      <div className="tb" style={{ minWidth: STAFF_COL_W + laneW }}>
        <div className="tb-hours">
          <div className="tb-bedcol" style={{ width: STAFF_COL_W, height: 33 }} />
          {hours.map((h) => (
            <div className="tb-hour" key={h} style={{ width: HOUR_W }}>
              {h}
            </div>
          ))}
        </div>

        {staffIdsToday.map((staffId) => {
          const { apps, travels, offDuty, breaks: staffBreaks } = dataByStaff[staffId] || {
            apps: [],
            travels: [],
            offDuty: [],
            breaks: [],
          };
          return (
            <div className="tb-row" key={staffId}>
              <div
                className={`tb-bed ${attendanceMap[staffId] ? "" : "not-checked-in"}`}
                style={{ width: STAFF_COL_W }}
                onClick={() => onStaffClick?.(staffId)}
              >
                {attendanceMap[staffId] && (
                  <span className="b-store">出勤 {attendanceMap[staffId]}</span>
                )}
                <span className="b-name">
                  <span
                    className="b-name-dot"
                    style={{ background: staffColor(staffId, staff) }}
                  />
                  {staffName(staffId)}
                </span>
              </div>
              <div className="tb-lane" style={{ width: laneW }}>
                {offDuty.map((o, i) => (
                  <div className="tb-offduty" key={`o${i}`} style={fillStyle(o.start, o.end)} />
                ))}

                {gridMarks.map((g, i) => (
                  <div
                    className={g.major ? "tb-gridline" : "tb-gridline-minor"}
                    key={i}
                    style={{ left: g.pos }}
                  />
                ))}

                {travels.map((t, i) => (
                  <div
                    className="tb-block travel"
                    key={`t${i}`}
                    style={blockStyle(t.start, t.end - t.start, undefined)}
                  >
                    移動
                  </div>
                ))}

                {staffBreaks.map((b) => (
                  <div
                    className="tb-block break"
                    key={b.id}
                    style={blockStyle(toMin(b.start), toMin(b.end) - toMin(b.start), undefined)}
                    onClick={() => onSelectBreak?.(b)}
                  >
                    休憩
                  </div>
                ))}

                {apps.map((r) => {
                  const start = toMin(r.startTime);
                  const courseMins = Number(r.course?.minutes || 0) || 60;
                  const optionMins = Number(r.course?.optionMinutes || 0);
                  const courseColor =
                    courseColorHex(r.course?.color) || staffColor(r.staffId, staff);
                  const optionColor = courseColorHex(r.course?.optionColor) || courseColor;
                  const extensionMins = Number(r.course?.extensionMinutes || 0);
                  const extensionColor = courseColorHex(r.course?.extensionColor) || courseColor;
                  const courseLbl = courseOnlyBoardLabel(r.course);
                  const optionLbl = optionLabel(r.course);
                  const extensionLbl = extensionLabel(r.course);
                  const dragStyle = dragTransform(r.id);
                  return [
                    <div
                      className="tb-block"
                      key={`${r.id}-c`}
                      style={{ ...blockStyle(start, courseMins, courseColor), ...dragStyle }}
                      onPointerDown={(e) => handleBlockPointerDown(e, r)}
                      onPointerMove={handleBlockPointerMove}
                      onPointerUp={handleBlockPointerUp}
                      onPointerCancel={handleBlockPointerUp}
                    >
                      <div className="bl-course">{courseLbl}</div>
                      <div className="bl-name">{r.customerName}様</div>
                    </div>,
                    optionMins > 0 && (
                      <div
                        className="tb-block"
                        key={`${r.id}-o`}
                        style={{
                          ...blockStyle(start + courseMins, optionMins, optionColor),
                          ...dragStyle,
                        }}
                        onPointerDown={(e) => handleBlockPointerDown(e, r)}
                        onPointerMove={handleBlockPointerMove}
                        onPointerUp={handleBlockPointerUp}
                        onPointerCancel={handleBlockPointerUp}
                      >
                        <div className="bl-course">{optionLbl}</div>
                      </div>
                    ),
                    extensionMins > 0 && (
                      <div
                        className="tb-block"
                        key={`${r.id}-e`}
                        style={{
                          ...blockStyle(
                            start + courseMins + optionMins,
                            extensionMins,
                            extensionColor,
                          ),
                          ...dragStyle,
                        }}
                        onPointerDown={(e) => handleBlockPointerDown(e, r)}
                        onPointerMove={handleBlockPointerMove}
                        onPointerUp={handleBlockPointerUp}
                        onPointerCancel={handleBlockPointerUp}
                      >
                        <div className="bl-course">{extensionLbl}</div>
                      </div>
                    ),
                  ];
                })}
              </div>
            </div>
          );
        })}

        {unassignedApps.length > 0 && (
          <div className="tb-row" style={{ height: ROW_H * unassignedLaneOf.laneCount }}>
            <div className="tb-bed" style={{ width: STAFF_COL_W }}>
              <span className="b-name muted">未定</span>
            </div>
            <div className="tb-lane" style={{ width: laneW }}>
              {gridMarks.map((g, i) => (
                <div
                  className={g.major ? "tb-gridline" : "tb-gridline-minor"}
                  key={i}
                  style={{ left: g.pos }}
                />
              ))}

              {unassignedApps.map((r) => {
                const start = toMin(r.startTime);
                const courseMins = Number(r.course?.minutes || 0) || 60;
                const optionMins = Number(r.course?.optionMinutes || 0);
                const courseColor =
                  courseColorHex(r.course?.color) || staffColor(r.staffId, staff);
                const optionColor = courseColorHex(r.course?.optionColor) || courseColor;
                const extensionMins = Number(r.course?.extensionMinutes || 0);
                const extensionColor = courseColorHex(r.course?.extensionColor) || courseColor;
                const courseLbl = courseOnlyBoardLabel(r.course);
                const optionLbl = optionLabel(r.course);
                const extensionLbl = extensionLabel(r.course);
                const lane = unassignedLaneOf.map.get(r.id) || 0;
                const laneStyle = { top: lane * ROW_H + 4, height: ROW_H - 8 };
                const dragStyle = dragTransform(r.id);
                return [
                  <div
                    className="tb-block"
                    key={`${r.id}-c`}
                    style={{
                      ...blockStyle(start, courseMins, courseColor),
                      ...laneStyle,
                      ...dragStyle,
                    }}
                    onPointerDown={(e) => handleBlockPointerDown(e, r)}
                    onPointerMove={handleBlockPointerMove}
                    onPointerUp={handleBlockPointerUp}
                    onPointerCancel={handleBlockPointerUp}
                  >
                    <div className="bl-course">{courseLbl}</div>
                    <div className="bl-name">{r.customerName}様</div>
                  </div>,
                  optionMins > 0 && (
                    <div
                      className="tb-block"
                      key={`${r.id}-o`}
                      style={{
                        ...blockStyle(start + courseMins, optionMins, optionColor),
                        ...laneStyle,
                        ...dragStyle,
                      }}
                      onPointerDown={(e) => handleBlockPointerDown(e, r)}
                      onPointerMove={handleBlockPointerMove}
                      onPointerUp={handleBlockPointerUp}
                      onPointerCancel={handleBlockPointerUp}
                    >
                      <div className="bl-course">{optionLbl}</div>
                    </div>
                  ),
                  extensionMins > 0 && (
                    <div
                      className="tb-block"
                      key={`${r.id}-e`}
                      style={{
                        ...blockStyle(
                          start + courseMins + optionMins,
                          extensionMins,
                          extensionColor,
                        ),
                        ...laneStyle,
                        ...dragStyle,
                      }}
                      onPointerDown={(e) => handleBlockPointerDown(e, r)}
                      onPointerMove={handleBlockPointerMove}
                      onPointerUp={handleBlockPointerUp}
                      onPointerCancel={handleBlockPointerUp}
                    >
                      <div className="bl-course">{extensionLbl}</div>
                    </div>
                  ),
                ];
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
