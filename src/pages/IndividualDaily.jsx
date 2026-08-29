import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api, courseLabel, yen } from "../api.js";

export default function IndividualDaily() {
  const { staff, date, setDate, ready } = useApp();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openStaff, setOpenStaff] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRecords(await api.reception(date));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    if (ready) load();
  }, [date, ready]);

  const summary = useMemo(() => {
    const map = {};
    for (const r of records) {
      const key = r.staffId || "__none__";
      if (!map[key]) map[key] = { count: 0, amount: 0, nominate: 0, records: [] };
      map[key].count += 1;
      map[key].amount += Number(r.amount || 0);
      if (r.nominate) map[key].nominate += 1;
      map[key].records.push(r);
    }
    return map;
  }, [records]);

  const rows = useMemo(() => {
    const arr = staff
      .map((s) => ({ staff: s, ...(summary[s.id] || { count: 0, amount: 0, nominate: 0 }) }))
      .filter((r) => r.count > 0);
    if (summary.__none__) {
      arr.push({ staff: { id: "__none__", name: "未割当" }, ...summary.__none__ });
    }
    return arr.sort((a, b) => b.amount - a.amount);
  }, [staff, summary]);

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalCount = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div>
      <div className="page-head">
        <h2>個人別日計表</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="label">総件数</div>
          <div className="value">{totalCount}</div>
        </div>
        <div className="stat">
          <div className="label">総売上</div>
          <div className="value">{yen(totalAmount)}</div>
        </div>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : rows.length === 0 ? (
        <div className="empty">データがありません</div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>スタッフ</th>
                <th className="num">件数</th>
                <th className="num">指名</th>
                <th className="num">売上</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.staff.id}>
                  <td>
                    {r.staff.name}
                    {r.staff.facial && <span className="pill" style={{ marginLeft: 6 }}>F可</span>}
                  </td>
                  <td className="num">{r.count}</td>
                  <td className="num">{r.nominate}</td>
                  <td className="num">{Number(r.amount).toLocaleString("ja-JP")}</td>
                  <td>
                    <button
                      className="btn sm ghost"
                      onClick={() => setOpenStaff(openStaff === r.staff.id ? null : r.staff.id)}
                    >
                      明細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openStaff && summary[openStaff] && (
        <div className="card" style={{ marginTop: 14 }}>
          <strong>
            {staff.find((s) => s.id === openStaff)?.name || "未割当"} の明細
          </strong>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>開始</th>
                  <th>顧客</th>
                  <th>コース</th>
                  <th>支払</th>
                  <th className="num">金額</th>
                </tr>
              </thead>
              <tbody>
                {summary[openStaff].records
                  .slice()
                  .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.startTime}</td>
                      <td>{r.customerName}</td>
                      <td>{courseLabel(r.course)}</td>
                      <td>{r.payment}</td>
                      <td className="num">{Number(r.amount || 0).toLocaleString("ja-JP")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
