import { useEffect, useState } from "react";
import { useApp } from "../App.jsx";
import { api, courseLabel, todayStr } from "../api.js";
import TimeBoardGrid from "../components/TimeBoardGrid.jsx";

export default function TimeBoard() {
  const { stores, staff, ready } = useApp();
  const [date, setDate] = useState(todayStr());
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

  const openBoardWindow = () => {
    window.open("/board", "relaxBoard", "width=1280,height=720,noopener");
  };

  return (
    <div>
      <div className="page-head">
        <h2>タイムボード</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn sm ghost desktop-only" onClick={openBoardWindow}>
          🖥️ 別ウィンドウで表示
        </button>
        <span className="muted desktop-only" style={{ fontSize: 12 }}>
          10分刻み／斜線＝移動（20分・本店パレス2F基準）／灰色＝シフト外
        </span>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : (
        <TimeBoardGrid
          stores={stores}
          staff={staff}
          records={records}
          shifts={shifts}
          date={date}
          onSelect={setSel}
          hourWidth={80}
        />
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
