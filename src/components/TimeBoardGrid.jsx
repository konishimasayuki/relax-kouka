import { useMemo } from "react";
import { courseLabel, staffColor } from "../api.js";

const START_HOUR = 11;
const END_HOUR = 24; // 表示ラベルは 11〜23
const TRAVEL_MIN = 20;
const STAFF_COL_W = 96;

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

// シフト範囲の「隙間」＝受付不可（灰色表示）の区間を求める
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
  if (cursor < dayEnd) segments.push({ start: cursor, end: dayEnd });
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
  date,
  onSelect,
  hourWidth = 56,
}) {
  const HOUR_W = hourWidth;
  const MIN_W = HOUR_W / 60;

  const staffName = (id) => staff.find((s) => s.id === id)?.name || "?";
  const buildingOf = (storeId) => stores.find((s) => s.id === storeId)?.building || "";

  // パレス2F＝本店。ここが移動の起点・終点になる。
  const homeBuilding = useMemo(() => {
    const home = stores.find((s) => s.building?.includes("パレス"));
    return home?.building || stores[0]?.building || "";
    // eslint-disable-next-line
  }, [stores]);

  const storeAbbr = (storeId) => {
    const bld = buildingOf(storeId);
    if (bld.includes("パレス")) return "P";
    if (bld.includes("宙")) return "宙";
    if (bld.toLowerCase().includes("ceada")) return "C";
    return bld ? bld[0] : "";
  };

  const todaysShifts = useMemo(() => shifts.filter((s) => s.date === date), [shifts, date]);

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
    return Object.entries(earliest)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
  }, [todaysShifts, records]);

  const shiftRangeLabel = (staffId) => {
    const list = todaysShifts.filter((s) => s.staffId === staffId);
    if (list.length === 0) return "";
    const start = Math.min(...list.map((s) => toMin(s.start)));
    const end = Math.max(...list.map((s) => toMin(s.end)));
    return `${minToHHMM(start)}-${minToHHMM(end)}`;
  };

  // スタッフごとの予約一覧 ＋ 移動ブロック ＋ シフト外（灰色）区間
  const dataByStaff = useMemo(() => {
    const dayStart = START_HOUR * 60;
    const dayEnd = END_HOUR * 60;
    const out = {};
    for (const staffId of staffIdsToday) {
      const apps = records
        .filter((r) => r.staffId === staffId && r.startTime)
        .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));

      const travels = [];
      let prevBuilding = homeBuilding;
      for (const r of apps) {
        const bld = buildingOf(r.storeId);
        if (homeBuilding && bld !== prevBuilding) {
          const s = toMin(r.startTime);
          travels.push({ start: s - TRAVEL_MIN, end: s });
        }
        prevBuilding = bld;
      }
      if (homeBuilding && apps.length && prevBuilding !== homeBuilding) {
        const last = apps[apps.length - 1];
        const endMin = toMin(last.startTime) + (last.course?.minutes || 60);
        travels.push({ start: endMin, end: endMin + TRAVEL_MIN });
      }

      const ranges = todaysShifts
        .filter((s) => s.staffId === staffId)
        .map((s) => ({ start: toMin(s.start), end: toMin(s.end) }));
      const offDuty = computeOffDuty(ranges, dayStart, dayEnd);

      out[staffId] = { apps, travels, offDuty };
    }
    return out;
    // eslint-disable-next-line
  }, [staffIdsToday, records, todaysShifts, homeBuilding, stores]);

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

  if (staffIdsToday.length === 0) {
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
          const { apps, travels, offDuty } = dataByStaff[staffId] || {
            apps: [],
            travels: [],
            offDuty: [],
          };
          return (
            <div className="tb-row" key={staffId}>
              <div className="tb-bed" style={{ width: STAFF_COL_W }}>
                <span className="b-store">{shiftRangeLabel(staffId)}</span>
                <span className="b-name">{staffName(staffId)}</span>
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

                {apps.map((r) => {
                  const start = toMin(r.startTime);
                  const mins = r.course?.minutes || 60;
                  const color = staffColor(r.staffId, staff);
                  return (
                    <div
                      className="tb-block"
                      key={r.id}
                      style={blockStyle(start, mins, color)}
                      onClick={() => onSelect?.(r)}
                    >
                      <div className="bl-course">
                        {courseLabel(r.course)}・{storeAbbr(r.storeId)}
                      </div>
                      <div className="bl-name">{r.customerName}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
