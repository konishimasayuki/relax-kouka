import { useEffect, useState } from "react";
import { useApp } from "../App.jsx";
import { api } from "../api.js";

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function RequestCard({ r, onToggleStatus, onDelete, canDelete }) {
  const isMassage = r.type === "massage";
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <strong>{r.name || "（お名前未入力）"}</strong>
            <span
              className="muted"
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 10,
                background: r.status === "done" ? "#e5f3ea" : "#fdeeea",
                color: r.status === "done" ? "#2f7a48" : "#b3452f",
              }}
            >
              {r.status === "done" ? "対応済み" : "未対応"}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.8 }}>
            希望日時: {r.desiredDate || "-"} {r.desiredTime || ""}
            <br />
            お電話番号: {r.phone || "-"}
            <br />
            お部屋番号: {r.room || "-"}
            <br />
            {isMassage ? (
              <>
                メニュー: {r.menu || "-"}
                <br />
                オプション: {r.option || "なし"}
                <br />
                金額: {r.price || "-"}
              </>
            ) : (
              <>
                コース: {r.course || "-"}
                <br />
                人数: {r.people || "-"}
              </>
            )}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
            受信: {fmtDateTime(r.createdAt)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="btn sm ghost" onClick={() => onToggleStatus(r)}>
            {r.status === "done" ? "未対応に戻す" : "対応済みにする"}
          </button>
          {canDelete && (
            <button className="btn sm danger" onClick={() => onDelete(r)}>
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReservationRequests() {
  const { role, isAdminUser } = useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setList(await api.bookingRequests());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleStatus = async (r) => {
    const updated = { ...r, status: r.status === "done" ? "new" : "done" };
    setList((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    try {
      await api.saveBookingRequest(updated);
    } catch (e) {
      alert(`更新失敗: ${e.message}`);
      load();
    }
  };

  const remove = async (r) => {
    if (!confirm("この予約申請を削除しますか？")) return;
    try {
      await api.deleteBookingRequest(r.id);
      setList((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      alert(`削除失敗: ${e.message}`);
    }
  };

  const massageList = list.filter((r) => r.type === "massage");
  const fortuneList = list.filter((r) => r.type === "fortune");

  const showMassage = isAdminUser || role === "staff";
  const showFortune = isAdminUser || role === "fortune";

  return (
    <div>
      <div className="page-head">
        <h2>予約申請(デモ)</h2>
        <button className="btn sm ghost" onClick={load} disabled={loading}>
          更新
        </button>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
        予約用ページ（booking.html）から届いた予約申請を表示します。まだ確定処理・LINE自動通知とは連携していないデモ表示です。
      </p>

      {showMassage && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>マッサージ予約申請</h3>
          {massageList.length === 0 && <div className="empty">まだ申請はありません</div>}
          {massageList.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              onToggleStatus={toggleStatus}
              onDelete={remove}
              canDelete={isAdminUser}
            />
          ))}
        </div>
      )}

      {showFortune && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>占い予約申請</h3>
          {fortuneList.length === 0 && <div className="empty">まだ申請はありません</div>}
          {fortuneList.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              onToggleStatus={toggleStatus}
              onDelete={remove}
              canDelete={isAdminUser}
            />
          ))}
        </div>
      )}
    </div>
  );
}
