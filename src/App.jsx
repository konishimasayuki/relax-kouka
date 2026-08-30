import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";
import Layout from "./components/Layout.jsx";
import CustomerRoster from "./pages/CustomerRoster.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DebugRequests from "./pages/DebugRequests.jsx";
import Fortune from "./pages/Fortune.jsx";
import IndividualDaily from "./pages/IndividualDaily.jsx";
import Inventory from "./pages/Inventory.jsx";
import Login from "./pages/Login.jsx";
import Payroll from "./pages/Payroll.jsx";
import Pricing from "./pages/Pricing.jsx";
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
  reception: ReceptionList,
  shift: Shift,
  inventory: Inventory,
  fortune: Fortune,
  daily: IndividualDaily,
  payroll: Payroll,
  customers: CustomerRoster,
  pricing: Pricing,
  settings: Settings,
  debugRequests: DebugRequests,
};

export default function App() {
  // ログアウトするまで保持されるセッション（Cookie）を初期状態として読み込む
  const [role, setRole] = useState(() => loadSession()?.role || null);
  const [staffSession, setStaffSession] = useState(() => {
    const s = loadSession();
    return s?.role === "staff" || s?.role === "fortune"
      ? { id: s.staffId, name: s.staffName, isAdmin: !!s.isAdmin }
      : null;
  });
  const [page, setPage] = useState(() => {
    const s = loadSession();
    if (s?.role === "fortune") return "fortune";
    if (s?.role === "staff" && !s?.isAdmin) return "timeboard";
    return "dashboard";
  });
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [menus, setMenus] = useState([]);
  const [options, setOptions] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [ready, setReady] = useState(false);

  // 管理者相当（管理者/デバッグ、または管理者権限ありのスタッフ）かどうか
  const isAdminUser = role === "admin" || role === "debug" || (role === "staff" && !!staffSession?.isAdmin);

  const refreshMaster = useCallback(async () => {
    const [st, sf, mn, op, cp] = await Promise.all([
      api.stores(),
      api.staff(),
      api.menus(),
      api.options(),
      api.coupons(),
    ]);
    setStores(st);
    setStaff(sf);
    setMenus(mn);
    setOptions(op);
    setCoupons(cp);
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

  // 管理者権限のないスタッフは、ダッシュボード／料金／顧客名簿／設定／デバッグ依頼に入れない
  const RESTRICTED_PAGES = ["dashboard", "pricing", "customers", "settings", "debugRequests"];
  useEffect(() => {
    if (role === "fortune" && page !== "fortune") {
      setPage("fortune");
      return;
    }
    if (role === "staff" && !isAdminUser && RESTRICTED_PAGES.includes(page)) setPage("timeboard");
    // eslint-disable-next-line
  }, [role, isAdminUser, page]);

  const handleLogin = (result) => {
    setRole(result.role);
    setStaffSession(
      result.role === "staff" || result.role === "fortune"
        ? { id: result.staffId, name: result.staffName, isAdmin: !!result.isAdmin }
        : null,
    );
    saveSession(result);
    if (result.role === "fortune") {
      setPage("fortune");
    } else if (result.role === "staff" && !result.isAdmin) {
      setPage("timeboard");
    } else {
      setPage("dashboard");
    }
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
    isAdminUser,
    stores,
    staff,
    menus,
    options,
    coupons,
    refreshMaster,
    ready,
  };

  return (
    <AppCtx.Provider value={ctx}>
      <Layout
        page={page}
        setPage={setPage}
        role={role}
        staffSession={staffSession}
        isAdminUser={isAdminUser}
        onLogout={logout}
      >
        {ready ? <PageComp /> : <div className="empty">読み込み中…</div>}
      </Layout>
    </AppCtx.Provider>
  );
}
