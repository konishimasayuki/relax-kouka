import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api, dateOfMonth, daysInMonth, thisMonthStr } from "../api.js";

// 請求先は全店舗共通のため固定（店舗ごとの設定は不要）
const BILLING_COMPANY = "株式会社 康佳";
const BILLING_ADDRESS = "大分県別府市海観寺1杉乃井ホテル内　康楽美ボディリセ";

export default function Payroll() {
  const { role, staffSession, isAdminUser, staff, stores } = useApp();

  const isLockedToSelf = role === "staff" && !isAdminUser;
  const selfStaffId = staffSession?.id || "";

  // 請求書は2枚に分ける：①BODY RECESS（パレス／宙館） ②Spa the Ceada
  const storeById = useMemo(() => Object.fromEntries(stores.map((s) => [s.id, s])), [stores]);
  const isCeadaStore = (storeId) => storeById[storeId]?.building === "Ceada";

  const [month, setMonth] = useState(thisMonthStr());
  const [staffId, setStaffId] = useState(isLockedToSelf ? selfStaffId : "");
  const [monthRecords, setMonthRecords] = useState({}); // date -> records[]
  const [monthAttendance, setMonthAttendance] = useState({}); // date -> attendance[]
  const [shifts, setShifts] = useState([]);
  const [rateOverrides, setRateOverrides] = useState([]); // payrollrate items
  const [commissionRates, setCommissionRates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingDay, setSavingDay] = useState(null);

  useEffect(() => {
    if (!isLockedToSelf && staff.length && !staffId) setStaffId(staff[0].id);
  }, [staff, staffId, isLockedToSelf]);

  const load = async () => {
    setLoading(true);
    try {
      const days = daysInMonth(month);
      const dates = Array.from({ length: days }, (_, i) => dateOfMonth(month, i + 1));
      const [recArr, attArr, sh, rates, commRates] = await Promise.all([
        Promise.all(dates.map((d) => api.reception(d))),
        Promise.all(dates.map((d) => api.attendance(d))),
        api.shifts(),
        api.payrollRates(),
        api.commissionRates(),
      ]);
      const map = {};
      const attMap = {};
      dates.forEach((d, i) => {
        map[d] = recArr[i] || [];
        attMap[d] = attArr[i] || [];
      });
      setMonthRecords(map);
      setMonthAttendance(attMap);
      setShifts(sh);
      setRateOverrides(rates);
      setCommissionRates(commRates);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    load();
  }, [month]);

  const selectedStaff = staff.find((s) => s.id === staffId);

  const rateOf = (day) =>
    rateOverrides.find((r) => r.staffId === staffId && r.month === month && r.day === day);

  // "HH:MM" を分に変換
  const toMinutes = (hhmm) => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const MIN_11_00 = 11 * 60;
  const MIN_15_00 = 15 * 60;
  const MIN_23_00 = 23 * 60;

  // 出勤時刻の時間帯バケットを判定
  const bucketOf = (checkInMin) => {
    if (checkInMin === null) return null;
    if (checkInMin <= MIN_11_00) return "until11";
    if (checkInMin <= MIN_15_00) return "from11to15";
    return "from15to23";
  };

  // 出勤時刻・退勤時刻（タイムボードの出勤／途中退勤記録）から、その日の自動歩合率を算出。
  // 出勤記録が無い日は null（空欄）を返す。
  const autoRateFor = (date, storeKey) => {
    if (!commissionRates) return null;
    const att = (monthAttendance[date] || []).find((a) => a.staffId === staffId);
    if (!att?.checkInTime) return null;

    const checkInMin = toMinutes(att.checkInTime);
    const bucket = bucketOf(checkInMin);
    if (!bucket) return null;

    const leaveMin = att.leaveTime ? toMinutes(att.leaveTime) : null;
    const isEarlyLeave = leaveMin !== null && leaveMin < MIN_23_00;

    const table = commissionRates[storeKey];
    if (!table) return null;
    return isEarlyLeave ? table.earlyLeave[bucket] : table.base[bucket];
  };

  // 店舗グループ（パレス／宙館 or Ceada）ごとに、日別の受付を絞り込んで集計する。
  // 税込累計・歩合金額などはグループごとに独立して計算し直す。
  const buildRows = (storeFilter, commissionKey) => {
    const days = daysInMonth(month);
    let cumTaxIn = 0;
    const out = [];
    for (let day = 1; day <= days; day++) {
      const date = dateOfMonth(month, day);
      const dayRecords = (monthRecords[date] || []).filter(
        (r) => r.staffId === staffId && storeFilter(r.storeId),
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
      const autoRate = autoRateFor(date, commissionKey);
      const rate = override ? Number(override.rate) : autoRate;
      const commission = rate === null ? 0 : Math.round(taxEx * (rate / 100));
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
  };

  const rowsBodyRecess = useMemo(
    () => buildRows((storeId) => !isCeadaStore(storeId), "bodyRecess"),
    // eslint-disable-next-line
    [month, monthRecords, monthAttendance, staffId, rateOverrides, commissionRates, shifts, storeById],
  );
  const rowsCeada = useMemo(
    () => buildRows((storeId) => isCeadaStore(storeId), "ceada"),
    // eslint-disable-next-line
    [month, monthRecords, monthAttendance, staffId, rateOverrides, commissionRates, shifts, storeById],
  );

  const sumRows = (rows) =>
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
    );

  const totalsBodyRecess = useMemo(() => sumRows(rowsBodyRecess), [rowsBodyRecess]);
  const totalsCeada = useMemo(() => sumRows(rowsCeada), [rowsCeada]);

  const saveRate = async (day, newRate) => {
    setSavingDay(day);
    try {
      const existing = rateOf(day);
      await api.savePayrollRate({
        id: existing?.id || "",
        staffId,
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
        <>
          {renderSheet("BODY RECESS（パレス／宙館）", rowsBodyRecess, totalsBodyRecess, BILLING_COMPANY)}
          {renderSheet("Spa the Ceada", rowsCeada, totalsCeada, "株式会社Spa the Ceada")}
        </>
      )}
    </div>
  );

  function renderSheet(storeLabel, rows, totals, billingCompany) {
    return (
      <div className="sheet-scroll payroll-sheet" style={{ marginBottom: 24 }}>
        <div className="sheet">
          <div className="sheet-head">
            <span className="sheet-title">請求書</span>
            <span>{billingCompany} 御中</span>
            <span>{m}月分</span>
            <span>
              令和 <span>{reiwaYear}</span> 年 <span>{m}</span> 月 <span>{lastDay}</span> 日
            </span>
          </div>
          <div className="sheet-head" style={{ paddingTop: 0 }}>
            <span>
              氏名 <span>{selectedStaff?.name || "（未選択）"}</span>
            </span>
            <span>業務遂行地（住所）：{BILLING_ADDRESS}</span>
          </div>

          <div className="sheet-title" style={{ margin: "10px 0" }}>
            {storeLabel}　ボディ・フット・リフレ委託料金合計金額　¥
            {totals.commission.toLocaleString("ja-JP")}
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day}>
                  <td className="c-center">{r.day}日</td>
                  <td className="c-center">
                    <span className="print-only">{r.rate === null ? "" : `${r.rate}%`}</span>
                    <span className="no-print">
                      <input
                        type="number"
                        className="rate-input"
                        value={r.rate === null ? "" : r.rate}
                        placeholder="-"
                        disabled={savingDay === r.day}
                        onChange={(e) => saveRate(r.day, e.target.value)}
                      />
                      %
                    </span>
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
                <td className="c-amount">{totals.commission.toLocaleString("ja-JP")}円</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }
}
