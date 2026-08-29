import { useState } from "react";
import { PAYMENTS, api } from "../api.js";
import TimeInput10 from "./TimeInput10.jsx";

function emptyForm(date, storeId) {
  return {
    id: "",
    date: date || "",
    storeId: storeId || "",
    bed: "",
    customerName: "",
    gender: "女",
    course: { menuId: "", name: "", displayName: "", minutes: "", color: "", freeText: "" },
    nominate: false,
    staffId: "",
    startTime: "",
    payment: "現金",
    paymentNote: "",
    room: "",
    phone: "",
    amount: 0,
  };
}

/**
 * 新規受付登録モーダル。
 * props: date, stores, staff, menus, workingStaffIds(Set), onClose(), onSaved(record)
 */
export default function NewReceptionModal({ date, stores, staff, menus, workingStaffIds, onClose, onSaved }) {
  const [form, setForm] = useState(() => emptyForm(date, stores[0]?.id));
  const [busy, setBusy] = useState(false);

  const menusFor = () => menus.filter((m) => m.storeId === form.storeId);
  const assignable = staff.filter((s) => s.active && workingStaffIds.has(s.id));

  const changeStore = (storeId) => {
    setForm({
      ...form,
      storeId,
      course: { menuId: "", name: "", displayName: "", minutes: "", color: "", freeText: "" },
    });
  };

  const selectMenu = (menuId) => {
    const m = menusFor().find((x) => x.id === menuId);
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

  const save = async () => {
    if (!form.customerName.trim()) return alert("お客様名を入力してください");
    setBusy(true);
    try {
      const saved = await api.saveReception(form);
      onSaved(saved);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>新規受付</h3>

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
            <TimeInput10
              value={form.startTime}
              onChange={(v) => setForm({ ...form, startTime: v })}
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
              placeholder="例：1"
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
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="女">女</option>
              <option value="男">男</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>コース</label>
          {menusFor().length === 0 ? (
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              この店舗のコースがまだ登録されていません（料金タブで登録してください）
            </div>
          ) : (
            <select value={form.course.menuId} onChange={(e) => selectMenu(e.target.value)}>
              <option value="">選択してください</option>
              {menusFor().map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <input
            style={{ marginTop: 8 }}
            value={form.course.freeText}
            onChange={(e) => setForm({ ...form, course: { ...form.course, freeText: e.target.value } })}
            placeholder="コース自由記述（入力するとこちらが優先表示されます）"
          />
        </div>

        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={form.nominate}
              onChange={(e) => setForm({ ...form, nominate: e.target.checked })}
            />
            指名
          </label>
        </div>

        <div className="row">
          <div className="field">
            <label>担当スタッフ</label>
            <select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              <option value="">未定</option>
              {assignable.map((s) => (
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
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>支払方法</label>
            <select value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}>
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
              />
            </div>
          )}
        </div>

        <div className="row">
          <div className="field">
            <label>部屋番号</label>
            <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>
          <div className="field">
            <label>携帯番号</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn gray" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn" onClick={save} disabled={busy}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
