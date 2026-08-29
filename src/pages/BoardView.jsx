import { useEffect, useRef, useState } from "react";
import { api, todayStr } from "../api.js";
import TimeBoardGrid from "../components/TimeBoardGrid.jsx";
import Login from "./Login.jsx";
import { loadSession, saveSession } from "../session.js";

const REFRESH_MS = 20000;

export default function BoardView() {
  const [role, setRole] = useState(() => loadSession()?.role || null);
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const timerRef = useRef(null);

  const handleLogin = (result) => {
    setRole(result.role);
    saveSession(result);
  };

  useEffect(() => {
    if (!role) return;
    let alive = true;

    const tick = async () => {
      try {
        const date = todayStr();
        const [st, sf, rec, sh] = await Promise.all([
          api.stores(),
          api.staff(),
          api.reception(date),
          api.shifts(),
        ]);
        if (!alive) return;
        setStores(st);
        setStaff(sf);
        setRecords(rec);
        setShifts(sh);
        setNow(new Date());
      } catch {
        // 表示専用画面のため、通信エラーは静かに無視して次回更新を待つ
      }
    };

    tick();
    timerRef.current = setInterval(tick, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timerRef.current);
    };
  }, [role]);

  if (!role) return <Login onLogin={handleLogin} />;

  const date = todayStr();
  const dateLabel = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}（${
    ["日", "月", "火", "水", "木", "金", "土"][now.getDay()]
  }）`;
  const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;

  return (
    <div className="board-page">
      <div className="board-frame">
        <div className="board-head">
          <strong>リラク業務管理 ／ タイムボード</strong>
          <span className="muted">{dateLabel}</span>
          <div className="spacer" />
          <span className="pill">{timeLabel}</span>
        </div>
        <div className="board-body">
          <TimeBoardGrid
            stores={stores}
            staff={staff}
            records={records}
            shifts={shifts}
            date={date}
            hourWidth={140}
          />
        </div>
      </div>
    </div>
  );
}
