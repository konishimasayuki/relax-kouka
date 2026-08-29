import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api, courseLabel, staffColor } from "../api.js";

const START_HOUR = 11;
const END_HOUR = 24; // 表示ラベルは 11〜23
const HOUR_W = 56;
const MIN_W = HOUR_W / 60;
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

export default function TimeBoard() {
  const { stores, staff, date, setDate, ready } = useApp();
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rec, sh] = await Promise.all([api.reception(date), api.shifts()]);
      setRecords(rec);
      setShifts(sh);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    if (ready) load();
  }, [date, ready]);

  const staffName = (id) => staff.find((s) => s.id === id)?.name || "?";
  const buildingOf = (storeId) => stores.find((s) => s.id === storeId)?.building || "";

  // パレス2F＝本店。ここが移動の起点・終点になる。
  const homeBuilding = useMemo(() => {
    const home = stores.find((s) => s.building?.includes("パレス"));
    return home?.building || stores[0]?.building || "";
  }, [stores]);

  const storeAbbr = (storeId) => {
    const bld = buildingOf(storeId);
    if (bld.includes("パレス")) return "P";
    if (bld.includes("宙")) return "宙";
    if (bld.toLowerCase().includes("ceada")) return "C";
    return bld ? bld[0] : "";
  };

  const todaysShifts = useMemo(() => shifts.filter((s) => s.date === date), [shifts, date]);

  // 出勤するスタッフ = 本日シフトのあるスタッフ ∪ 本日予約が入っているスタッフ（順序は開始が早い順）
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

  // スタッフごとのシフト時間帯（複数あれば最早〜最遅をまとめて表示）
  const shiftRangeLabel = (staffId) => {
    const list = todaysShifts.filter((s) => s.staffId === staffId);
    if (list.length === 0) return "";
    const start = Math.min(...list.map((s) => toMin(s.start)));
    const end = Math.max(...list.map((s) => toMin(s.end)));
    return `${minToHHMM(start)}-${minToHHMM(end)}`;
  };

  // スタッフごとの予約一覧 ＋ 移動ブロック（パレス2F本店からの行き帰りも含む）
  const dataByStaff = useMemo(() => {
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
      // 最後の施術が本店以外なら、本店へ戻る移動も必要
      if (homeBuilding && apps.length && prevBuilding !== homeBuilding) {
        const last = apps[apps.length - 1];
        const endMin = toMin(last.startTime) + (last.course?.minutes || 60);
        travels.push({ start: endMin, end: endMin + TRAVEL_MIN });
      }

      out[staffId] = { apps, travels };
    }
    return out;
    // eslint-disable-next-line
  }, [staffIdsToday, records, homeBuilding, stores]);

  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) hours.push(h);
  const laneW = (END_HOUR - START_HOUR) * HOUR_W;

  // 10分刻みの補助縦線（毎時0分は既存の時間線と重なるので除外）
  const minorLines = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (const m of [10, 20, 30, 40, 50]) {
      minorLines.push(h * 60 + m - START_HOUR * 60);
    }
  }

  const blockStyle = (startMin, minutes, color) => ({
    left: (startMin - START_HOUR * 60) * MIN_W,
    width: Math.max(minutes * MIN_W - 2, 10),
    background: color,
  });

  return (
    <div>
      <div className="page-head">
        <h2>タイムボード</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>
          10分刻み／斜線＝移動（{TRAVEL_MIN}分・本店パレス2F基準）
        </span>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : staffIdsToday.length === 0 ? (
        <div className="empty">
          本日出勤予定のスタッフがいません（シフトタブで登録してください）
        </div>
      ) : (
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
              const { apps, travels } = dataByStaff[staffId] || { apps: [], travels: [] };
              return (
                <div className="tb-row" key={staffId}>
                  <div className="tb-bed" style={{ width: STAFF_COL_W }}>
                    <span className="b-store">{shiftRangeLabel(staffId)}</span>
                    <span className="b-name">{staffName(staffId)}</span>
                  </div>
                  <div className="tb-lane" style={{ width: laneW }}>
                    {hours.map((h, i) => (
                      <div className="tb-gridline" key={h} style={{ left: i * HOUR_W }} />
                    ))}
                    {minorLines.map((m) => (
                      <div className="tb-gridline-minor" key={m} style={{ left: m * MIN_W }} />
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
                          onClick={() => setSel(r)}
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
      )}

      {sel && (
        <div className="modal-overlay" onClick={() => setSel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{sel.customerName} 様</h3>
            <p className="muted" style={{ marginTop: -8 }}>
              {stores.find((s) => s.id === sel.storeId)?.name} / Bed {sel.bed}
            </p>
            <table className="grid" style={{ whiteSpace: "normal" }}>
              <tbody>
                <tr>
                  <th>コース</th>
                  <td>{courseLabel(sel.course)}</td>
                </tr>
                <tr>
                  <th>担当</th>
                  <td>{staff.find((s) => s.id === sel.staffId)?.name || "未定"}</td>
                </tr>
                <tr>
                  <th>開始</th>
                  <td>
                    {sel.startTime}（{sel.course?.minutes || 60}分）
                  </td>
                </tr>
                <tr>
                  <th>支払</th>
                  <td>{sel.payment}</td>
                </tr>
                <tr>
                  <th>金額</th>
                  <td>¥{Number(sel.amount || 0).toLocaleString("ja-JP")}</td>
                </tr>
                <tr>
                  <th>部屋/TEL</th>
                  <td>{sel.room || sel.phone || "—"}</td>
                </tr>
              </tbody>
            </table>
            <div className="modal-actions">
              <button className="btn" onClick={() => setSel(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
