import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, todayStr } from "./api.js";
import Layout from "./components/Layout.jsx";
import CustomerRoster from "./pages/CustomerRoster.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import IndividualDaily from "./pages/IndividualDaily.jsx";
import Login from "./pages/Login.jsx";
import ReceptionList from "./pages/ReceptionList.jsx";
import Settings from "./pages/Settings.jsx";
import Shift from "./pages/Shift.jsx";
import TimeBoard from "./pages/TimeBoard.jsx";
import { clearSession, loadSession, saveSession } from "./session.js";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const PAGES = {
  dashboard: Dashboard,
  timeboard: TimeBoard,
  shift: Shift,
  reception: ReceptionList,
  daily: IndividualDaily,
  customers: CustomerRoster,
  settings: Settings,
};

export default function App() {
  // ログアウトするまで保持されるセッション（Cookie）を初期状態として読み込む
  const [role, setRole] = useState(() => loadSession()?.role || null);
  const [staffSession, setStaffSession] = useState(() => {
    const s = loadSession();
    return s?.role === "staff" ? { id: s.staffId, name: s.staffName } : null;
  });
  const [page, setPage] = useState("dashboard");
  const [date, setDate] = useState(todayStr());
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [ready, setReady] = useState(false);

  const refreshMaster = useCallback(async () => {
    const [st, sf] = await Promise.all([api.stores(), api.staff()]);
    setStores(st);
    setStaff(sf);
  }, []);

  useEffect(() => {
    if (!role) return;
    let alive = true;
    (async () => {
      await api.seed().catch(() => {});
      await refreshMaster().catch(() => {});
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [role, refreshMaster]);

  // スタッフログインは設定画面に入れない（管理者・デバッグのみ）
  useEffect(() => {
    if (role === "staff" && page === "settings") setPage("dashboard");
  }, [role, page]);

  const handleLogin = (result) => {
    setRole(result.role);
    setStaffSession(
      result.role === "staff" ? { id: result.staffId, name: result.staffName } : null,
    );
    saveSession(result);
  };

  const logout = () => {
    clearSession();
    setRole(null);
    setStaffSession(null);
    setReady(false);
    setPage("dashboard");
  };

  if (!role) return <Login onLogin={handleLogin} />;

  const PageComp = PAGES[page] || Dashboard;

  const ctx = {
    role,
    staffSession,
    date,
    setDate,
    stores,
    staff,
    refreshMaster,
    ready,
  };

  return (
    <AppCtx.Provider value={ctx}>
      <Layout page={page} setPage={setPage} role={role} staffSession={staffSession} onLogout={logout}>
        {ready ? <PageComp /> : <div className="empty">読み込み中…</div>}
      </Layout>
    </AppCtx.Provider>
  );
}
