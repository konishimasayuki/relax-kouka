import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api, courseLabel, staffColor } from "../api.js";

const START_HOUR = 11;
const END_HOUR = 24; // 表示は 11〜23 のラベル
const HOUR_W = 56;
const MIN_W = HOUR_W / 60;
const TRAVEL_MIN = 20;

function toMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export default function TimeBoard() {
  const { stores, staff, date, setDate, ready } = useApp();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRecords(await api.reception(date));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    if (ready) load();
  }, [date, ready]);

  const activeStores = useMemo(() => stores.filter((s) => s.active !== false), [stores]);

  // ベッド行を組み立て（店舗ごと × ベッド番号）
  const rows = useMemo(() => {
    const out = [];
    for (const st of activeStores) {
      for (let b = 1; b <= (st.beds || 0); b++) {
        out.push({ storeId: st.id, storeName: st.name, building: st.building, bed: b });
      }
    }
    return out;
  }, [activeStores]);

  const buildingOf = (storeId) => stores.find((s) => s.id === storeId)?.building || "";

  // 移動バッファ算出：同一スタッフの連続予約が別建物なら、後の予約の前に20分
  const travels = useMemo(() => {
    const byStaff = {};
    for (const r of records) {
      if (!r.staffId || !r.startTime) continue;
      (byStaff[r.staffId] ||= []).push(r);
    }
    const list = [];
    for (const arr of Object.values(byStaff)) {
      arr.sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const cur = arr[i];
        if (buildingOf(prev.storeId) !== buildingOf(cur.storeId)) {
          list.push({
            storeId: cur.storeId,
            bed: cur.bed,
            start: toMin(cur.startTime) - TRAVEL_MIN,
            staffId: cur.staffId,
          });
        }
      }
    }
    return list;
    // eslint-disable-next-line
  }, [records, stores]);

  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) hours.push(h);
  const laneW = (END_HOUR - START_HOUR) * HOUR_W;

  const blockStyle = (startMin, minutes, color) => ({
    left: (startMin - START_HOUR * 60) * MIN_W,
    width: Math.max(minutes * MIN_W - 2, 10),
    background: color,
  });

  const recFor = (row) =>
    records.filter(
      (r) => r.storeId === row.storeId && r.bed === row.bed && r.startTime,
    );

  return (
    <div>
      <div className="page-head">
        <h2>タイムボード</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>
          斜線 = 店舗間移動（{TRAVEL_MIN}分）
        </span>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : rows.length === 0 ? (
        <div className="empty">稼働中の店舗がありません（設定で登録してください）</div>
      ) : (
        <div className="tb-scroll">
          <div className="tb" style={{ minWidth: 66 + laneW }}>
            <div className="tb-hours">
              <div className="tb-bedcol" style={{ height: 33 }} />
              {hours.map((h) => (
                <div className="tb-hour" key={h} style={{ width: HOUR_W }}>
                  {h}
                </div>
              ))}
            </div>

            {rows.map((row, ri) => {
              const prevRow = rows[ri - 1];
              const newStore = !prevRow || prevRow.storeId !== row.storeId;
              return (
                <div className="tb-row" key={`${row.storeId}-${row.bed}`}>
                  <div className="tb-bed">
                    {newStore && <span className="b-store">{shortStore(row.storeName)}</span>}
                    <span className="b-name">Bed {row.bed}</span>
                  </div>
                  <div className="tb-lane" style={{ width: laneW }}>
                    {hours.map((h, i) => (
                      <div
                        className="tb-gridline"
                        key={h}
                        style={{ left: i * HOUR_W }}
                      />
                    ))}

                    {travels
                      .filter((t) => t.storeId === row.storeId && t.bed === row.bed)
                      .map((t, i) => (
                        <div
                          className="tb-block travel"
                          key={`t${i}`}
                          style={blockStyle(t.start, TRAVEL_MIN, undefined)}
                        >
                          移動
                        </div>
                      ))}

                    {recFor(row).map((r) => {
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
                          <div className="bl-course">{courseLabel(r.course)}</div>
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

function shortStore(name) {
  if (!name) return "";
  if (name.includes("宙")) return "宙館13F";
  if (name.includes("パレス")) return "パレス2F";
  if (name.toLowerCase().includes("ceada") || name.includes("Spa")) return "Ceada";
  return name.length > 6 ? `${name.slice(0, 6)}…` : name;
}
