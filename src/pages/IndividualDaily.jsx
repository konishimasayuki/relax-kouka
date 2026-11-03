import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { BRANDS, api, courseLabel, recordBrand, todayStr, yen } from "../api.js";

export default function IndividualDaily() {
  const { staff, stores, menus, role, staffSession, isAdminUser, ready } = useApp();
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  // 明細を開いている行（"帰属先:スタッフID" 形式）
  const [openKey, setOpenKey] = useState(null);

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

  // 売上の帰属先（BODY RECESS / Spa the Ceada）ごとに、スタッフ別の集計を作る。
  // 帰属先は料金設定のコースごとの設定で決まる（未設定のコースは店舗から判定）。
  const groups = useMemo(() => {
    return BRANDS.map((brand) => {
      const brandRecords = records.filter((r) => recordBrand(r, menus, stores) === brand.key);
      const map = {};
      for (const r of brandRecords) {
        const key = r.staffId || "__none__";
        if (!map[key]) map[key] = { count: 0, amount: 0, nominate: 0, records: [] };
        map[key].count += 1;
        map[key].amount += Number(r.amount || 0);
        if (r.nominate) map[key].nominate += 1;
        map[key].records.push(r);
      }

      // 管理者権限がなければ、自分自身の分のみ表示する
      let rows = staff
        .map((s) => ({ staff: s, ...(map[s.id] || { count: 0, amount: 0, nominate: 0, records: [] }) }))
        .filter((r) => r.count > 0);
      if (map.__none__) {
        rows.push({ staff: { id: "__none__", name: "未割当" }, ...map.__none__ });
      }
      if (role === "staff" && !isAdminUser) {
        rows = rows.filter((r) => r.staff.id === staffSession?.id);
      }
      rows.sort((a, b) => b.amount - a.amount);

      return {
        brand,
        rows,
        totalAmount: rows.reduce((s, r) => s + r.amount, 0),
        totalCount: rows.reduce((s, r) => s + r.count, 0),
      };
    });
  }, [records, menus, stores, staff, role, isAdminUser, staffSession]);

  return (
    <div>
      <div className="page-head">
        <h2>個人別日計表</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : (
        groups.map((g) => (
          <div className="card" key={g.brand.key} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>{g.brand.label}</h3>

            <div className="stat-grid" style={{ marginBottom: 12 }}>
              <div className="stat">
                <div className="label">総件数</div>
                <div className="value">{g.totalCount}</div>
              </div>
              <div className="stat">
                <div className="label">総売上</div>
                <div className="value">{yen(g.totalAmount)}</div>
              </div>
            </div>

            {g.rows.length === 0 ? (
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
                    {g.rows.map((r) => {
                      const key = `${g.brand.key}:${r.staff.id}`;
                      return (
                        <tr key={key}>
                          <td>
                            {r.staff.name}
                            {r.staff.facial && (
                              <span className="pill" style={{ marginLeft: 6 }}>
                                F可
                              </span>
                            )}
                          </td>
                          <td className="num">{r.count}</td>
                          <td className="num">{r.nominate}</td>
                          <td className="num">{Number(r.amount).toLocaleString("ja-JP")}</td>
                          <td>
                            <button
                              className="btn sm ghost"
                              onClick={() => setOpenKey(openKey === key ? null : key)}
                            >
                              明細
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {g.rows
              .filter((r) => openKey === `${g.brand.key}:${r.staff.id}`)
              .map((r) => (
                <div className="card" style={{ marginTop: 12 }} key="detail">
                  <strong>{r.staff.name} の明細</strong>
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
                        {r.records
                          .slice()
                          .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
                          .map((rec) => (
                            <tr key={rec.id}>
                              <td>{rec.startTime}</td>
                              <td>{rec.customerName}</td>
                              <td>{courseLabel(rec.course)}</td>
                              <td>{rec.payment}</td>
                              <td className="num">
                                {Number(rec.amount || 0).toLocaleString("ja-JP")}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        ))
      )}
    </div>
  );
}
