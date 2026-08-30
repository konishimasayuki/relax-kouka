import { useState } from "react";

const MENU = [
  { key: "dashboard", label: "ダッシュボード", ico: "📊" },
  { key: "timeboard", label: "タイムボード", ico: "🗓️" },
  { key: "reception", label: "受付一覧表", ico: "📋" },
  { key: "shift", label: "シフト", ico: "🕒" },
  { key: "inventory", label: "在庫管理", ico: "📦" },
  { key: "fortune", label: "杉の泉", ico: "🔮" },
  { key: "daily", label: "個人別日計表", ico: "🧾" },
  { key: "payroll", label: "給料", ico: "💴" },
  { key: "customers", label: "顧客名簿", ico: "👥" },
  { key: "pricing", label: "料金", ico: "💰" },
  { key: "settings", label: "設定", ico: "⚙️" },
];

export default function Layout({ page, setPage, role, staffSession, isAdminUser, onLogout, children }) {
  const [open, setOpen] = useState(false);
  const RESTRICTED = ["dashboard", "pricing", "customers", "settings"];
  let menu = MENU;
  if (role === "fortune") {
    menu = MENU.filter((m) => m.key === "fortune");
  } else if (role === "staff" && !isAdminUser) {
    menu = MENU.filter((m) => !RESTRICTED.includes(m.key));
  }
  const current = menu.find((m) => m.key === page);

  const go = (key) => {
    setPage(key);
    setOpen(false);
  };

  const badge =
    role === "debug"
      ? "DEBUG"
      : role === "staff" || role === "fortune"
        ? staffSession?.name || "スタッフ"
        : "管理者";

  return (
    <div className="app">
      <header className="topbar">
        <button className="hamburger" onClick={() => setOpen(true)} aria-label="メニュー">
          <span />
        </button>
        <div className="title">{current?.label || "リラク業務管理"}</div>
        <div className="spacer" />
        <div className="role-badge">{badge}</div>
      </header>

      {open && <div className="drawer-overlay" onClick={() => setOpen(false)} />}
      <div className="body-row">
        <nav className={`drawer ${open ? "open" : ""}`}>
          <div className="drawer-head">
            <div className="brand">
              リラク業務管理
              <small>Relax Management</small>
            </div>
          </div>
          <div className="nav">
            {menu.map((m) => (
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
    </div>
  );
}
