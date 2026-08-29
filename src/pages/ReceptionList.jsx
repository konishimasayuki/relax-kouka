import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { PAYMENTS, api, courseLabel, yen } from "../api.js";

function emptyRecord(storeId, date) {
  return {
    id: "",
    date: date || "",
    storeId: storeId || "",
    bed: "",
    customerName: "",
    gender: "女",
    course: {
      menuId: "",
      name: "",
      displayName: "",
      minutes: "",
      color: "",
      freeText: "",
    },
    pregnancy: false,
    nominate: false,
    staffId: "",
    startTime: "",
    payment: "現金",
    paymentNote: "",
    receptionist: "",
    room: "",
    phone: "",
    amount: 0,
    note: "",
  };
}

// 新フィールド追加前の古いレコードを開いてもundefinedにならないようマージする
function normalizeRecord(r) {
  const base = emptyRecord(r.storeId, r.date);
  return { ...base, ...r, course: { ...base.course, ...(r.course || {}) } };
}

export default function ReceptionList() {
  const { stores, staff, menus, date, setDate, ready } = useApp();
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

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

  // 全店舗まとめて、開始時間順で1枚のシートに
  const view = useMemo(
    () =>
      [...records].sort((a, b) => {
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      }),
    [records],
  );

  const total = useMemo(
    () => view.reduce((s, r) => s + Number(r.amount || 0), 0),
    [view],
  );

  const save = async () => {
    if (!form.customerName.trim()) return alert("お客様名を入力してください");
    if (!form.date) return alert("施術日を入力してください");
    setBusy(true);
    try {
      const { _originalDate, ...payload } = form;
      await api.saveReception(payload);
      // 編集で施術日を変更した場合は、元の日付側のデータを削除して移動させる
      if (form.id && _originalDate && _originalDate !== form.date) {
        await api.deleteReception(form.id, _originalDate);
      }
      await load();
      setForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const del = async (id, recordDate) => {
    if (!confirm("この受付を削除しますか？")) return;
    await api.deleteReception(id, recordDate || date);
    await load();
  };

  const staffName = (id) => staff.find((s) => s.id === id)?.name || "—";
  const storeName = (id) => stores.find((s) => s.id === id)?.name || "—";
  const storeMenus = useMemo(
    () => menus.filter((m) => m.storeId === form?.storeId),
    [menus, form?.storeId],
  );

  // 店舗を変更したら、その店舗のメニューに合わせてコース選択をリセット
  const changeStore = (storeId) => {
    setForm({
      ...form,
      storeId,
      course: { ...form.course, menuId: "", name: "", displayName: "", minutes: "", color: "" },
    });
  };

  // メニューを選んだら、コース名・表示名・時間・色・金額を自動反映（金額は後から編集・消去可）
  const selectMenu = (menuId) => {
    const m = menus.find((x) => x.id === menuId);
    if (!m) {
      setForm({
        ...form,
        course: { ...form.course, menuId: "", name: "", displayName: "", minutes: "", color: "" },
      });
      return;
    }
    setForm({
      ...form,
      course: {
        ...form.course,
        menuId: m.id,
        name: m.name,
        displayName: m.displayName,
        minutes: m.minutes,
        color: m.color,
      },
      amount: m.price,
    });
  };

  return (
    <div>
      <div className="page-head">
        <h2>受付一覧表</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn sm" onClick={() => setForm(emptyRecord(stores[0]?.id, date))}>
          ＋ 受付追加
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="label">客数（全店舗）</div>
          <div className="value">{view.length}</div>
        </div>
        <div className="stat">
          <div className="label">売上合計（全店舗）</div>
          <div className="value">{yen(total)}</div>
        </div>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : view.length === 0 ? (
        <div className="empty">受付がありません</div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>店舗</th>
                <th>Bed</th>
                <th>お客様名</th>
                <th>性別</th>
                <th>コース</th>
                <th>指名</th>
                <th>担当</th>
                <th>開始</th>
                <th>支払</th>
                <th>部屋/携帯</th>
                <th className="num">金額</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {view.map((r) => (
                <tr
                  key={r.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setForm({ ...normalizeRecord(r), _originalDate: r.date })}
                >
                  <td>{storeName(r.storeId)}</td>
                  <td>{r.bed}</td>
                  <td>{r.customerName}</td>
                  <td>{r.gender}</td>
                  <td>
                    {courseLabel(r.course)}
                    {r.pregnancy && <span className="pill green" style={{ marginLeft: 4 }}>妊</span>}
                  </td>
                  <td>{r.nominate ? "○" : ""}</td>
                  <td>{staffName(r.staffId)}</td>
                  <td>{r.startTime}</td>
                  <td>
                    {r.payment}
                    {r.payment === "その他" && r.paymentNote ? `（${r.paymentNote}）` : ""}
                  </td>
                  <td>{r.room || r.phone || ""}</td>
                  <td className="num">{Number(r.amount || 0).toLocaleString("ja-JP")}</td>
                  <td>
                    <button
                      className="btn sm ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ ...normalizeRecord(r), _originalDate: r.date });
                      }}
                    >
                      編集
                    </button>{" "}
                    <button
                      className="btn sm danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        del(r.id, r.date);
                      }}
                    >
                      削除
                    </button>
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
            <h3>{form.id ? "受付を編集" : "受付を追加"}</h3>

            <div className="row">
              <div className="field">
                <label>施術日</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="field">
                <label>開始時間</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>店舗</label>
                <select value={form.storeId} onChange={(e) => changeStore(e.target.value)}>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>ベッド</label>
                <input
                  value={form.bed}
                  onChange={(e) => setForm({ ...form, bed: e.target.value })}
                  placeholder="例：1 / オイルベッド"
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>お客様名</label>
                <input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
              </div>
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
            </div>

            <div className="field">
              <label>コース</label>
              {storeMenus.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  この店舗のコースがまだ登録されていません（料金タブで登録してください）
                </div>
              ) : (
                <select value={form.course.menuId} onChange={(e) => selectMenu(e.target.value)}>
                  <option value="">選択してください</option>
                  {storeMenus.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}（{m.minutes}分・{yen(m.price)}）
                    </option>
                  ))}
                </select>
              )}
              <input
                style={{ marginTop: 8 }}
                value={form.course.freeText}
                onChange={(e) =>
                  setForm({ ...form, course: { ...form.course, freeText: e.target.value } })
                }
                placeholder="コース自由記述（入力するとこちらが優先表示されます）"
              />
            </div>

            <div className="field">
              <div className="checks">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.nominate}
                    onChange={(e) => setForm({ ...form, nominate: e.target.checked })}
                  />
                  指名
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.pregnancy}
                    onChange={(e) => setForm({ ...form, pregnancy: e.target.checked })}
                  />
                  妊婦
                </label>
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>担当スタッフ</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                >
                  <option value="">未定</option>
                  {staff
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label>金額</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>支払方法</label>
                <select
                  value={form.payment}
                  onChange={(e) => setForm({ ...form, payment: e.target.value })}
                >
                  {PAYMENTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              {form.payment === "その他" && (
                <div className="field">
                  <label>支払方法（自由記述）</label>
                  <input
                    value={form.paymentNote}
                    onChange={(e) => setForm({ ...form, paymentNote: e.target.value })}
                    placeholder="例：PayPay"
                  />
                </div>
              )}
            </div>

            <div className="row">
              <div className="field">
                <label>部屋番号</label>
                <input
                  value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                />
              </div>
              <div className="field">
                <label>携帯番号</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>受付者 / メモ</label>
              <input
                value={form.receptionist}
                onChange={(e) => setForm({ ...form, receptionist: e.target.value })}
                placeholder="受付者"
                style={{ marginBottom: 8 }}
              />
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="メモ"
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
