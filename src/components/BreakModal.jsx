import { useState } from "react";
import { api } from "../api.js";
import TimeInput10 from "./TimeInput10.jsx";

function emptyBreak(date, staffId) {
  return { id: "", date, staffId: staffId || "", start: "13:00", end: "13:30" };
}

/**
 * 休憩の追加・編集モーダル。
 * props: date, staff(全スタッフ), assignableStaffIds(Set, その日出勤中のみ), editing(既存の休憩 or null), onClose(), onSaved(rec), onDeleted(id)
 */
export default function BreakModal({ date, staff, assignableStaffIds, editing, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(() =>
    editing ? { ...editing } : emptyBreak(date, [...assignableStaffIds][0]),
  );
  const [busy, setBusy] = useState(false);

  const workers = staff.filter((s) => s.active && assignableStaffIds.has(s.id));

  const save = async () => {
    if (!form.staffId) return alert("スタッフを選択してください");
    if (!form.start || !form.end) return alert("開始・終了時間を入力してください");
    setBusy(true);
    try {
      const saved = await api.saveBreak(form);
      onSaved(saved);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm("この休憩を削除しますか？")) return;
    setBusy(true);
    try {
      await api.deleteBreak(form.id);
      onDeleted(form.id);
    } catch (e) {
      alert(`削除失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{form.id ? "休憩を編集" : "休憩を追加"}</h3>

        <div className="field">
          <label>スタッフ</label>
          <select
            value={form.staffId}
            onChange={(e) => setForm({ ...form, staffId: e.target.value })}
          >
            <option value="">選択してください</option>
            {workers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <div className="field">
            <label>開始</label>
            <TimeInput10 value={form.start} onChange={(v) => setForm({ ...form, start: v })} />
          </div>
          <div className="field">
            <label>終了</label>
            <TimeInput10 value={form.end} onChange={(v) => setForm({ ...form, end: v })} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn gray" onClick={onClose}>
            キャンセル
          </button>
          {form.id && (
            <button className="btn danger" onClick={del} disabled={busy}>
              削除
            </button>
          )}
          <button className="btn" onClick={save} disabled={busy}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
