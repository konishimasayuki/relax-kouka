import { useEffect, useState } from "react";
import { useApp } from "../App.jsx";
import { api, todayStr } from "../api.js";

export default function BookingStopPanel() {
  const { stores, staffSession, isAdminUser } = useApp();
  const [data, setData] = useState({ _history: [] });
  const [busy, setBusy] = useState(false);

  const load = () => api.bookingStopConfig().then(setData).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const isStoppedToday = (key) => data[key] === todayStr();

  const actorName = staffSession?.name || (isAdminUser ? "管理者" : "スタッフ");

  const toggle = async (key, label) => {
    setBusy(true);
    try {
      const next = await api.saveBookingStop(
        key,
        isStoppedToday(key) ? "" : todayStr(),
        actorName,
        label,
      );
      setData(next);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const items = [
    ...stores.map((s) => ({ key: s.id, label: s.name })),
    { key: "fortune", label: "杉の泉（占い）" },
  ];

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>ネット予約設定</h3>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0, lineHeight: 1.8 }}>
        満室等で一時的にネット予約を止めたい店舗だけ「本日は停止する」を押してください。
        お客様の予約ページでは「ただいまネット予約を一時停止しております。お電話にてお問い合わせください」と表示され、予約できなくなります。
        <br />
        <strong>押し忘れ・消し忘れ対策として、日付が変わると自動的に停止は解除されます。</strong>
        （停止したい日はその日のうちに押してください）
      </p>

      {items.map((it) => {
        const stopped = isStoppedToday(it.key);
        return (
          <div
            key={it.key}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}
          >
            <div style={{ flex: 1 }}>
              <strong>{it.label}</strong>
              {stopped ? (
                <span className="pill" style={{ background: "#e8734a", marginLeft: 8 }}>
                  本日停止中
                </span>
              ) : (
                <span className="pill gray" style={{ marginLeft: 8 }}>
                  通常受付中
                </span>
              )}
            </div>
            <button
              className={stopped ? "btn sm" : "btn sm danger"}
              disabled={busy}
              onClick={() => toggle(it.key, it.label)}
            >
              {stopped ? "停止を解除する" : "本日は停止する"}
            </button>
          </div>
        );
      })}

      <div className="field" style={{ marginTop: 14 }}>
        <label>操作履歴（新しい順）</label>
        {(!data._history || data._history.length === 0) && (
          <p className="muted" style={{ fontSize: 12.5 }}>
            まだ操作履歴はありません
          </p>
        )}
        {data._history && data._history.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: "auto", fontSize: 12.5, lineHeight: 1.9 }}>
            {data._history.map((h, i) => (
              <div
                key={i}
                style={{ borderBottom: "1px solid var(--border)", padding: "4px 0" }}
              >
                {new Date(h.at).toLocaleString("ja-JP")}　
                <strong>{h.actorName}</strong>さんが「{h.label}」を
                <strong style={{ color: h.action === "stop" ? "#e8734a" : "#2f9e44" }}>
                  {h.action === "stop" ? " 停止" : " 停止解除"}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
