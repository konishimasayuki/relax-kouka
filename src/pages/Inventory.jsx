import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api, todayStr } from "../api.js";

function emptyMaterial() {
  return { id: "", name: "", unit: "個" };
}

function emptyOp(type, storeId) {
  return {
    id: "",
    type, // "purchase" | "use" | "transfer"
    materialId: "",
    storeId: storeId || "",
    toStoreId: "",
    quantity: 1,
    date: todayStr(),
    note: "",
  };
}

const TYPE_LABEL = {
  purchase: "仕入れ",
  use: "使用",
  transfer_out: "移動（出）",
  transfer_in: "移動（入）",
};

export default function Inventory() {
  const { stores, isAdminUser } = useApp();
  const [materials, setMaterials] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [materialForm, setMaterialForm] = useState(null);
  const [opForm, setOpForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [mt, lg] = await Promise.all([api.materials(), api.stockLogs()]);
      setMaterials(mt);
      setLogs(lg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // materialId -> storeId -> 現在数量
  const stockMap = useMemo(() => {
    const map = {};
    for (const l of logs) {
      map[l.materialId] ||= {};
      map[l.materialId][l.storeId] = (map[l.materialId][l.storeId] || 0) + Number(l.delta || 0);
    }
    return map;
  }, [logs]);

  const activeStores = stores.filter((s) => s.active !== false);

  const saveMaterial = async () => {
    if (!materialForm.name.trim()) return alert("資材名を入力してください");
    setBusy(true);
    try {
      await api.saveMaterial(materialForm);
      await load();
      setMaterialForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delMaterial = async (id) => {
    if (!confirm("この資材を削除しますか？（履歴は残ります）")) return;
    await api.deleteMaterial(id);
    await load();
  };

  const saveOp = async () => {
    if (!opForm.materialId) return alert("資材を選択してください");
    if (!opForm.storeId) return alert("店舗を選択してください");
    if (!opForm.quantity || opForm.quantity <= 0) return alert("数量を入力してください");
    if (opForm.type === "transfer" && !opForm.toStoreId) return alert("移動先店舗を選択してください");
    if (opForm.type === "transfer" && opForm.toStoreId === opForm.storeId)
      return alert("移動元と移動先が同じです");

    setBusy(true);
    try {
      const qty = Number(opForm.quantity);
      if (opForm.type === "purchase") {
        await api.saveStockLog({
          id: "",
          materialId: opForm.materialId,
          storeId: opForm.storeId,
          delta: qty,
          type: "purchase",
          date: opForm.date,
          note: opForm.note,
        });
      } else if (opForm.type === "use") {
        await api.saveStockLog({
          id: "",
          materialId: opForm.materialId,
          storeId: opForm.storeId,
          delta: -qty,
          type: "use",
          date: opForm.date,
          note: opForm.note,
        });
      } else if (opForm.type === "transfer") {
        await api.saveStockLog({
          id: "",
          materialId: opForm.materialId,
          storeId: opForm.storeId,
          delta: -qty,
          type: "transfer_out",
          counterpartStoreId: opForm.toStoreId,
          date: opForm.date,
          note: opForm.note,
        });
        await api.saveStockLog({
          id: "",
          materialId: opForm.materialId,
          storeId: opForm.toStoreId,
          delta: qty,
          type: "transfer_in",
          counterpartStoreId: opForm.storeId,
          date: opForm.date,
          note: opForm.note,
        });
      }
      await load();
      setOpForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delLog = async (id) => {
    if (!confirm("この履歴を取り消しますか？（在庫数に反映されます）")) return;
    await api.deleteStockLog(id);
    await load();
  };

  const materialName = (id) => materials.find((m) => m.id === id)?.name || "?";
  const storeName = (id) => stores.find((s) => s.id === id)?.name || "?";

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [logs],
  );

  return (
    <div>
      <div className="page-head">
        <h2>在庫管理</h2>
      </div>

      <div className="toolbar">
        <button className="btn sm" onClick={() => setMaterialForm(emptyMaterial())}>
          ＋ 資材登録
        </button>
        <button
          className="btn sm ghost"
          onClick={() => setOpForm(emptyOp("purchase", stores[0]?.id))}
        >
          ＋ 仕入れ
        </button>
        <button className="btn sm ghost" onClick={() => setOpForm(emptyOp("use", stores[0]?.id))}>
          − 使用
        </button>
        <button
          className="btn sm ghost"
          onClick={() => setOpForm(emptyOp("transfer", stores[0]?.id))}
        >
          ⇄ 店舗間移動
        </button>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : materials.length === 0 ? (
        <div className="empty">資材が登録されていません</div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>資材名</th>
                <th>単位</th>
                {activeStores.map((s) => (
                  <th key={s.id} className="num">
                    {s.name}
                  </th>
                ))}
                <th className="num">合計</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const perStore = stockMap[m.id] || {};
                const total = activeStores.reduce((s, st) => s + (perStore[st.id] || 0), 0);
                return (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.unit}</td>
                    {activeStores.map((s) => (
                      <td key={s.id} className="num">
                        {perStore[s.id] || 0}
                      </td>
                    ))}
                    <td className="num">
                      <strong>{total}</strong>
                    </td>
                    <td>
                      <button className="btn sm ghost" onClick={() => setMaterialForm({ ...m })}>
                        編集
                      </button>{" "}
                      {isAdminUser && (
                        <button className="btn sm danger" onClick={() => delMaterial(m.id)}>
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="page-head" style={{ marginTop: 20 }}>
        <h2>操作履歴</h2>
      </div>
      {sortedLogs.length === 0 ? (
        <div className="empty">履歴がありません</div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>日付</th>
                <th>資材</th>
                <th>店舗</th>
                <th>種別</th>
                <th className="num">数量</th>
                <th>メモ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedLogs.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td>
                  <td>{materialName(l.materialId)}</td>
                  <td>
                    {storeName(l.storeId)}
                    {l.counterpartStoreId && (
                      <span className="muted">
                        {l.type === "transfer_out" ? " → " : " ← "}
                        {storeName(l.counterpartStoreId)}
                      </span>
                    )}
                  </td>
                  <td>{TYPE_LABEL[l.type] || l.type}</td>
                  <td className="num">{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                  <td>{l.note}</td>
                  <td>
                    {isAdminUser && (
                      <button className="btn sm danger" onClick={() => delLog(l.id)}>
                        取消
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {materialForm && (
        <div className="modal-overlay" onClick={() => setMaterialForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{materialForm.id ? "資材を編集" : "資材を追加"}</h3>
            <div className="field">
              <label>資材名</label>
              <input
                value={materialForm.name}
                onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                placeholder="例：オイル（大瓶）"
              />
            </div>
            <div className="field">
              <label>単位</label>
              <input
                value={materialForm.unit}
                onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                placeholder="例：本 / 個 / 枚"
              />
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setMaterialForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveMaterial} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {opForm && (
        <div className="modal-overlay" onClick={() => setOpForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {opForm.type === "purchase" && "仕入れ登録"}
              {opForm.type === "use" && "使用登録"}
              {opForm.type === "transfer" && "店舗間移動登録"}
            </h3>

            <div className="field">
              <label>資材</label>
              <select
                value={opForm.materialId}
                onChange={(e) => setOpForm({ ...opForm, materialId: e.target.value })}
              >
                <option value="">選択してください</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}（{m.unit}）
                  </option>
                ))}
              </select>
            </div>

            <div className="row">
              <div className="field">
                <label>{opForm.type === "transfer" ? "移動元店舗" : "店舗"}</label>
                <select
                  value={opForm.storeId}
                  onChange={(e) => setOpForm({ ...opForm, storeId: e.target.value })}
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {opForm.type === "transfer" && (
                <div className="field">
                  <label>移動先店舗</label>
                  <select
                    value={opForm.toStoreId}
                    onChange={(e) => setOpForm({ ...opForm, toStoreId: e.target.value })}
                  >
                    <option value="">選択してください</option>
                    {stores
                      .filter((s) => s.id !== opForm.storeId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div className="row">
              <div className="field">
                <label>数量</label>
                <input
                  type="number"
                  value={opForm.quantity}
                  onChange={(e) => setOpForm({ ...opForm, quantity: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>日付</label>
                <input
                  type="date"
                  value={opForm.date}
                  onChange={(e) => setOpForm({ ...opForm, date: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>メモ</label>
              <input
                value={opForm.note}
                onChange={(e) => setOpForm({ ...opForm, note: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button className="btn gray" onClick={() => setOpForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveOp} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
