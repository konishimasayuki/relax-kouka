import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { PAYMENTS, addDays, api, todayStr, yen } from "../api.js";
import QuickReport from "../components/QuickReport.jsx";
import SalesDailyReport from "../components/SalesDailyReport.jsx";

function toMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export default function Dashboard() {
  const { stores, ready } = useApp();
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [tomorrowRecords, setTomorrowRecords] = useState([]);
  const [tomorrowShifts, setTomorrowShifts] = useState([]);
  const [loading, setLoading] = useState(false);

  const tomorrow = addDays(date, 1);

  const load = async () => {
    setLoading(true);
    try {
      const [rec, tRec, allShifts] = await Promise.all([
        api.reception(date),
        api.reception(tomorrow),
        api.shifts(),
      ]);
      setRecords(rec);
      setTomorrowRecords(tRec);
      setTomorrowShifts(allShifts.filter((s) => s.date === tomorrow));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    if (ready) load();
  }, [date, ready]);

  const stats = useMemo(() => {
    const total = records.reduce((s, r) => s + Number(r.amount || 0), 0);
    const byStore = {};
    const byPay = Object.fromEntries(PAYMENTS.map((p) => [p, 0]));
    for (const r of records) {
      byStore[r.storeId] = (byStore[r.storeId] || 0) + Number(r.amount || 0);
      if (byPay[r.payment] === undefined) byPay[r.payment] = 0;
      byPay[r.payment] += Number(r.amount || 0);
    }
    const avg = records.length ? Math.round(total / records.length) : 0;
    return { total, count: records.length, avg, byStore, byPay };
  }, [records]);

  // 明日のスタッフ稼働人数（店舗を跨いで動くため全店舗合計として算出）
  const staffCounts = useMemo(() => {
    const overlap = (start, end, winStart, winEnd) => start < winEnd && end > winStart;
    let morning = 0;
    let evening = 0;
    for (const s of tomorrowShifts) {
      const st = toMin(s.start);
      const en = toMin(s.end);
      if (st === null || en === null) continue;
      if (overlap(st, en, toMin("11:00"), toMin("15:00"))) morning++;
      if (overlap(st, en, toMin("15:00"), toMin("23:00"))) evening++;
    }
    return { morning, evening };
  }, [tomorrowShifts]);

  const activeStores = useMemo(() => stores.filter((s) => s.active !== false), [stores]);

  return (
    <div>
      <div className="page-head">
        <h2>ダッシュボード</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat">
              <div className="label">本日の客数</div>
              <div className="value">{stats.count}</div>
            </div>
            <div className="stat">
              <div className="label">本日の売上</div>
              <div className="value">{yen(stats.total)}</div>
            </div>
            <div className="stat">
              <div className="label">客単価</div>
              <div className="value dark">{yen(stats.avg)}</div>
            </div>
          </div>

          <div className="card">
            <strong>店舗別売上</strong>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="grid">
                <thead>
                  <tr>
                    <th>店舗</th>
                    <th className="num">売上</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td className="num">
                        {Number(stats.byStore[s.id] || 0).toLocaleString("ja-JP")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <strong>支払方法別</strong>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="grid">
                <thead>
                  <tr>
                    <th>方法</th>
                    <th className="num">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.byPay).map(([p, v]) => (
                    <tr key={p}>
                      <td>{p}</td>
                      <td className="num">{Number(v).toLocaleString("ja-JP")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- 売上日計表（テナント管理のホテルへ毎日提出する様式） ---- */}
          <div className="page-head" style={{ marginTop: 20 }}>
            <h2>売上日計表</h2>
          </div>
          {activeStores.map((s) => (
            <SalesDailyReport
              key={s.id}
              store={s}
              date={date}
              records={records.filter((r) => r.storeId === s.id)}
            />
          ))}

          {/* ---- 速報（本日実績と明日の見込み） ---- */}
          <div className="page-head" style={{ marginTop: 20 }}>
            <h2>速報</h2>
          </div>
          {activeStores.map((s) => (
            <QuickReport
              key={s.id}
              store={s}
              todayRecords={records.filter((r) => r.storeId === s.id)}
              tomorrowRecords={tomorrowRecords.filter((r) => r.storeId === s.id)}
              staffCounts={staffCounts}
            />
          ))}
        </>
      )}
    </div>
  );
}
