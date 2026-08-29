import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api, dateOfMonth, daysInMonth, thisMonthStr, yen } from "../api.js";

export default function Payroll() {
  const { role, staffSession, isAdminUser, stores, staff } = useApp();

  const isLockedToSelf = role === "staff" && !isAdminUser;
  const selfStaffId = staffSession?.id || "";

  const [month, setMonth] = useState(thisMonthStr());
  const [storeId, setStoreId] = useState("");
  const [staffId, setStaffId] = useState(isLockedToSelf ? selfStaffId : "");
  const [monthRecords, setMonthRecords] = useState({}); // date -> records[]
  const [shifts, setShifts] = useState([]);
  const [rateOverrides, setRateOverrides] = useState([]); // payrollrate items
  const [loading, setLoading] = useState(false);
  const [savingDay, setSavingDay] = useState(null);

  useEffect(() => {
    if (stores.length && !storeId) setStoreId(stores[0].id);
  }, [stores, storeId]);

  useEffect(() => {
    if (!isLockedToSelf && staff.length && !staffId) setStaffId(staff[0].id);
  }, [staff, staffId, isLockedToSelf]);

  const load = async () => {
    setLoading(true);
    try {
      const days = daysInMonth(month);
      const dates = Array.from({ length: days }, (_, i) => dateOfMonth(month, i + 1));
      const [recArr, sh, rates] = await Promise.all([
        Promise.all(dates.map((d) => api.reception(d))),
        api.shifts(),
        api.payrollRates(),
      ]);
      const map = {};
      dates.forEach((d, i) => {
        map[d] = recArr[i] || [];
      });
      setMonthRecords(map);
      setShifts(sh);
      setRateOverrides(rates);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    load();
  }, [month]);

  const selectedStaff = staff.find((s) => s.id === staffId);
  const selectedStore = stores.find((s) => s.id === storeId);

  const rateOf = (day) =>
    rateOverrides.find(
      (r) => r.staffId === staffId && r.storeId === storeId && r.month === month && r.day === day,
    );

  const rows = useMemo(() => {
    const days = daysInMonth(month);
    let cumTaxIn = 0;
    const out = [];
    for (let day = 1; day <= days; day++) {
      const date = dateOfMonth(month, day);
      const dayRecords = (monthRecords[date] || []).filter(
        (r) => r.staffId === staffId && r.storeId === storeId,
      );
      const count = dayRecords.length;
      const taxIn = dayRecords.reduce((s, r) => s + Number(r.amount || 0), 0);
      const taxEx = Math.round(taxIn / 1.1);
      const nominateCount = dayRecords.filter((r) => r.nominate).length;
      const nominateFee = Math.round(
        dayRecords.filter((r) => r.nominate).reduce((s, r) => s + Number(r.amount || 0), 0) * 0.05,
      );
      cumTaxIn += taxIn;

      const override = rateOf(day);
      const rate = override ? Number(override.rate) : Number(selectedStaff?.commissionRate ?? 45);
      const commission = Math.round(taxEx * (rate / 100));
      const total = commission + nominateFee;

      const dayShift = shifts.find((s) => s.staffId === staffId && s.date === date);
      const startLabel = dayShift ? `${dayShift.start.slice(0, 2)}時〜` : "";

      out.push({
        day,
        date,
        count,
        taxIn,
        cumTaxIn,
        taxEx,
        nominateCount,
        nominateFee,
        rate,
        rateIsOverride: !!override,
        commission,
        total,
        startLabel,
      });
    }
    return out;
    // eslint-disable-next-line
  }, [month, monthRecords, staffId, storeId, rateOverrides, selectedStaff, shifts]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          count: acc.count + r.count,
          taxIn: acc.taxIn + r.taxIn,
          taxEx: acc.taxEx + r.taxEx,
          commission: acc.commission + r.commission,
          nominateFee: acc.nominateFee + r.nominateFee,
          total: acc.total + r.total,
        }),
        { count: 0, taxIn: 0, taxEx: 0, commission: 0, nominateFee: 0, total: 0 },
      ),
    [rows],
  );

  const saveRate = async (day, newRate) => {
    setSavingDay(day);
    try {
      const existing = rateOf(day);
      await api.savePayrollRate({
        id: existing?.id || "",
        staffId,
        storeId,
        month,
        day,
        rate: Number(newRate),
      });
      const rates = await api.payrollRates();
      setRateOverrides(rates);
    } finally {
      setSavingDay(null);
    }
  };

  const [y, m] = month.split("-").map(Number);
  const reiwaYear = y - 2018;
  const lastDay = daysInMonth(month);

  return (
    <div>
      <div className="page-head">
        <h2>給料</h2>
      </div>

      <div className="toolbar">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {!isLockedToSelf && (
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn sm ghost" onClick={() => window.print()}>
          🖨️ 印刷
        </button>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : (
        <div className="sheet-scroll payroll-sheet">
          <div className="sheet">
            <div className="sheet-head">
              <span className="sheet-title">請求書</span>
              <span>
                <span>{selectedStore?.billingCompany || "（未設定）"}</span>{" "}
                御中
              </span>
              <span>{m}月分</span>
              <span>
                令和 <span>{reiwaYear}</span> 年{" "}
                <span>{m}</span> 月 <span>{lastDay}</span>{" "}
                日
              </span>
            </div>
            <div className="sheet-head" style={{ paddingTop: 0 }}>
              <span>
                氏名 <span>{selectedStaff?.name || "（未選択）"}</span>
              </span>
              <span>
                業務遂行地（住所）：{selectedStore?.billingAddress || "（未設定）"}
              </span>
            </div>

            <div className="sheet-title" style={{ margin: "10px 0" }}>
              ボディ・フット・リフレ委託料金合計金額　¥
            </div>

            <table className="sheet-table payroll-table">
              <thead>
                <tr>
                  <th>日</th>
                  <th>歩合率</th>
                  <th>出勤時間</th>
                  <th>件数</th>
                  <th>税込売上</th>
                  <th>税込累計</th>
                  <th>税抜売上</th>
                  <th>歩合金額</th>
                  <th>指名件数</th>
                  <th>
                    税抜金額
                    <br />
                    (5%)
                  </th>
                  <th>
                    売上合計
                    <br />
                    (税抜)
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day}>
                    <td className="c-center">{r.day}日</td>
                    <td className="c-center">
                      <input
                        type="number"
                        className="rate-input"
                        value={r.rate}
                        disabled={savingDay === r.day}
                        onChange={(e) => saveRate(r.day, e.target.value)}
                      />
                      %
                    </td>
                    <td className="c-center">{r.startLabel}</td>
                    <td className="c-center">{r.count ? `${r.count}件` : "件"}</td>
                    <td className="c-amount">{r.taxIn ? r.taxIn.toLocaleString("ja-JP") : ""}</td>
                    <td className="c-amount">
                      {r.count || r.cumTaxIn ? r.cumTaxIn.toLocaleString("ja-JP") : ""}
                    </td>
                    <td className="c-amount">{r.taxIn ? r.taxEx.toLocaleString("ja-JP") : ""}</td>
                    <td className="c-amount">
                      {r.taxIn ? r.commission.toLocaleString("ja-JP") : ""}
                    </td>
                    <td className="c-center">{r.nominateCount ? `${r.nominateCount}件` : "件"}</td>
                    <td className="c-amount">
                      {r.nominateFee ? r.nominateFee.toLocaleString("ja-JP") : ""}
                    </td>
                    <td className="c-amount">
                      {r.taxIn ? r.total.toLocaleString("ja-JP") : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="c-center" colSpan={3}>
                    総合計
                  </td>
                  <td className="c-center">{totals.count}件</td>
                  <td className="c-amount">{totals.taxIn.toLocaleString("ja-JP")}円</td>
                  <td />
                  <td className="c-amount">{totals.taxEx.toLocaleString("ja-JP")}円</td>
                  <td className="c-amount">
                    {totals.commission.toLocaleString("ja-JP")}円
                  </td>
                  <td />
                  <td className="c-amount">{totals.nominateFee.toLocaleString("ja-JP")}円</td>
                  <td className="c-amount">{totals.total.toLocaleString("ja-JP")}円</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
