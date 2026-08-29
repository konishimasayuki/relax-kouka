import { useState } from "react";

const MENU = [
  { key: "dashboard", label: "ダッシュボード", ico: "📊" },
  { key: "timeboard", label: "タイムボード", ico: "🗓️" },
  { key: "reception", label: "受付一覧表", ico: "📋" },
  { key: "daily", label: "個人別日計表", ico: "🧾" },
  { key: "customers", label: "顧客名簿", ico: "👥" },
  { key: "settings", label: "設定", ico: "⚙️" },
];

export default function Layout({ page, setPage, role, onLogout, children }) {
  const [open, setOpen] = useState(false);
  const current = MENU.find((m) => m.key === page);

  const go = (key) => {
    setPage(key);
    setOpen(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="hamburger" onClick={() => setOpen(true)} aria-label="メニュー">
          <span />
        </button>
        <div className="title">{current?.label || "リラク業務管理"}</div>
        <div className="spacer" />
        <div className="role-badge">{role === "debug" ? "DEBUG" : "管理者"}</div>
      </header>

      {open && <div className="drawer-overlay" onClick={() => setOpen(false)} />}
      <nav className={`drawer ${open ? "open" : ""}`}>
        <div className="drawer-head">
          <div className="brand">
            リラク業務管理
            <small>Relax Management</small>
          </div>
        </div>
        <div className="nav">
          {MENU.map((m) => (
            <button
              key={m.key}
              className={page === m.key ? "active" : ""}
              onClick={() => go(m.key)}
            >
              <span className="ico">{m.ico}</span>
              {m.label}
            </button>
          ))}
        </div>
        <div className="drawer-foot">
          <button className="btn gray" style={{ width: "100%" }} onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </nav>

      <main className="content">{children}</main>
    </div>
  );
}
