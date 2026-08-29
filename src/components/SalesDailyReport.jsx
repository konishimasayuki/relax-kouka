import { useEffect, useState } from "react";
import { api } from "../api.js";

const DENOMS = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1];

function emptyMeta(date, storeId) {
  return {
    date,
    storeId,
    cashOver: "",
    note: "",
    responsible: "",
    cashier: "",
    tenantManager: "",
    creator: "",
    denoms: Object.fromEntries(DENOMS.map((d) => [d, ""])),
  };
}

export default function SalesDailyReport({ store, date, records }) {
  const [meta, setMeta] = useState(emptyMeta(date, store.id));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .dailyReportMeta(date, store.id)
      .then((m) => {
        if (alive) setMeta({ ...emptyMeta(date, store.id), ...m });
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line
  }, [date, store.id]);

  const updateMeta = async (patch) => {
    const payload = { ...meta, ...patch, date, storeId: store.id };
    setMeta(payload);
    try {
      await api.saveDailyReportMeta(payload);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    }
  };

  const updateDenom = (denom, val) => {
    updateMeta({ denoms: { ...meta.denoms, [denom]: val } });
  };

  // 未収＝部屋付け（ホテル請求で後日精算）、それ以外は現金扱い
  const cashList = records.filter((r) => r.payment !== "部屋付け");
  const unpaidList = records.filter((r) => r.payment === "部屋付け");
  const cashTotal = cashList.reduce((s, r) => s + Number(r.amount || 0), 0);
  const unpaidTotal = unpaidList.reduce((s, r) => s + Number(r.amount || 0), 0);
  const cashBase = Math.round(cashTotal / 1.1);
  const unpaidBase = Math.round(unpaidTotal / 1.1);
  const cashTax = cashTotal - cashBase;
  const unpaidTax = unpaidTotal - unpaidBase;
  const totalBase = cashBase + unpaidBase;
  const totalTax = cashTax + unpaidTax;
  const totalAll = cashTotal + unpaidTotal;
  const num = (n) => Number(n || 0).toLocaleString("ja-JP");

  const denomTotal = DENOMS.reduce((s, d) => s + d * Number(meta.denoms?.[d] || 0), 0);

  return (
    <div className="card daily-report-card">
      <strong>売上日計表　{store.name}</strong>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table className="grid dr-table">
          <thead>
            <tr>
              <th />
              <th className="num">現金</th>
              <th className="num">未収</th>
              <th className="num">合計</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>基本売上</td>
              <td className="num">{num(cashBase)}</td>
              <td className="num">{num(unpaidBase)}</td>
              <td className="num">{num(totalBase)}</td>
            </tr>
            <tr>
              <td>消費税</td>
              <td className="num">{num(cashTax)}</td>
              <td className="num">{num(unpaidTax)}</td>
              <td className="num">{num(totalTax)}</td>
            </tr>
            <tr>
              <td>
                <strong>合計</strong>
              </td>
              <td className="num">
                <strong>{num(cashTotal)}</strong>
              </td>
              <td className="num">
                <strong>{num(unpaidTotal)}</strong>
              </td>
              <td className="num">
                <strong>{num(totalAll)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <div className="field">
          <label>現金過不足（＋多い／−足りない）</label>
          <input
            type="number"
            value={meta.cashOver}
            onChange={(e) => updateMeta({ cashOver: e.target.value })}
            placeholder="例：-100"
          />
        </div>
        <div className="field">
          <label>記事</label>
          <input
            value={meta.note}
            onChange={(e) => updateMeta({ note: e.target.value })}
            placeholder="メモ"
          />
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12, margin: "8px 0 4px" }}>
        金種別（現金の内訳・手入力）
      </div>
      <div className="table-wrap">
        <table className="grid dr-denom-table">
          <thead>
            <tr>
              {DENOMS.map((d) => (
                <th key={d} className="num">
                  {d.toLocaleString("ja-JP")}
                </th>
              ))}
              <th className="num">合計</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {DENOMS.map((d) => (
                <td key={d}>
                  <input
                    type="number"
                    className="denom-input"
                    value={meta.denoms?.[d] ?? ""}
                    onChange={(e) => updateDenom(d, e.target.value)}
                  />
                </td>
              ))}
              <td className="num">{num(denomTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <div className="field">
          <label>責任者</label>
          <input
            value={meta.responsible}
            onChange={(e) => updateMeta({ responsible: e.target.value })}
          />
        </div>
        <div className="field">
          <label>出納</label>
          <input value={meta.cashier} onChange={(e) => updateMeta({ cashier: e.target.value })} />
        </div>
        <div className="field">
          <label>テナント管理</label>
          <input
            value={meta.tenantManager}
            onChange={(e) => updateMeta({ tenantManager: e.target.value })}
          />
        </div>
        <div className="field">
          <label>作成者</label>
          <input value={meta.creator} onChange={(e) => updateMeta({ creator: e.target.value })} />
        </div>
      </div>
      {loading && <div className="muted" style={{ fontSize: 12 }}>読み込み中…</div>}
    </div>
  );
}
