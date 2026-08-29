import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, todayStr } from "./api.js";
import Layout from "./components/Layout.jsx";
import CustomerRoster from "./pages/CustomerRoster.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import IndividualDaily from "./pages/IndividualDaily.jsx";
import Login from "./pages/Login.jsx";
import ReceptionList from "./pages/ReceptionList.jsx";
import Settings from "./pages/Settings.jsx";
import TimeBoard from "./pages/TimeBoard.jsx";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const PAGES = {
  dashboard: Dashboard,
  timeboard: TimeBoard,
  reception: ReceptionList,
  daily: IndividualDaily,
  customers: CustomerRoster,
  settings: Settings,
};

export default function App() {
  const [role, setRole] = useState(null); // "admin" | "debug" | null
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

  const logout = () => {
    setRole(null);
    setReady(false);
    setPage("dashboard");
  };

  if (!role) return <Login onLogin={setRole} />;

  const PageComp = PAGES[page] || Dashboard;

  const ctx = {
    role,
    date,
    setDate,
    stores,
    staff,
    refreshMaster,
    ready,
  };

  return (
    <AppCtx.Provider value={ctx}>
      <Layout page={page} setPage={setPage} role={role} onLogout={logout}>
        {ready ? <PageComp /> : <div className="empty">読み込み中…</div>}
      </Layout>
    </AppCtx.Provider>
  );
}
