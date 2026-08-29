import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api } from "../api.js";

const empty = {
  id: "",
  name: "",
  kana: "",
  gender: "女",
  phone: "",
  note: "",
  visits: 0,
  lastVisit: "",
};

export default function CustomerRoster() {
  const { role, ready } = useApp();
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setList(await api.customers());
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    if (ready) load();
  }, [ready]);

  const view = useMemo(() => {
    const kw = q.trim();
    if (!kw) return list;
    return list.filter(
      (c) =>
        (c.name || "").includes(kw) ||
        (c.kana || "").includes(kw) ||
        (c.phone || "").includes(kw),
    );
  }, [list, q]);

  const save = async () => {
    if (!form.name.trim()) return alert("氏名を入力してください");
    setBusy(true);
    try {
      await api.saveCustomer(form);
      await load();
      setForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const del = async (id) => {
    if (!confirm("この顧客を削除しますか？")) return;
    await api.deleteCustomer(id);
    await load();
  };

  return (
    <div>
      <div className="page-head">
        <h2>顧客名簿</h2>
      </div>

      <div className="toolbar">
        <input
          placeholder="氏名・カナ・電話で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
        <button className="btn sm" onClick={() => setForm({ ...empty })}>
          ＋ 顧客追加
        </button>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : view.length === 0 ? (
        <div className="empty">顧客がいません</div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>氏名</th>
                <th>性別</th>
                <th>電話</th>
                <th className="num">来店</th>
                <th>最終来店</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {view.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    {c.kana && <div className="muted" style={{ fontSize: 11 }}>{c.kana}</div>}
                  </td>
                  <td>{c.gender}</td>
                  <td>{c.phone}</td>
                  <td className="num">{c.visits || 0}</td>
                  <td>{c.lastVisit || "—"}</td>
                  <td>
                    <button className="btn sm ghost" onClick={() => setForm({ ...c })}>
                      編集
                    </button>{" "}
                    {role === "debug" && (
                      <button className="btn sm danger" onClick={() => del(c.id)}>
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{form.id ? "顧客を編集" : "顧客を追加"}</h3>
            <div className="row">
              <div className="field">
                <label>氏名</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>カナ</label>
                <input
                  value={form.kana}
                  onChange={(e) => setForm({ ...form, kana: e.target.value })}
                />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>性別</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="女">女</option>
                  <option value="男">男</option>
                </select>
              </div>
              <div className="field">
                <label>電話</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>メモ</label>
              <textarea
                rows={3}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={save} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
