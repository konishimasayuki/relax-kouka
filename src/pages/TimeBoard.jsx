import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { PAYMENTS, api, todayStr } from "../api.js";
import BreakModal from "../components/BreakModal.jsx";
import NewReceptionModal from "../components/NewReceptionModal.jsx";
import TimeBoardGrid from "../components/TimeBoardGrid.jsx";
import TimeInput10 from "../components/TimeInput10.jsx";

export default function TimeBoard() {
  const { stores, staff, menus, options, ready } = useApp();
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [breakModal, setBreakModal] = useState(null); // { editing } | null

  const load = async () => {
    setLoading(true);
    try {
      const [rec, sh, br] = await Promise.all([
        api.reception(date),
        api.shifts(),
        api.breaks(),
      ]);
      setRecords(rec);
      setShifts(sh);
      setBreaks(br);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    if (ready) load();
  }, [date, ready]);

  const openBoardWindow = () => {
    window.open("/board", "relaxBoard", "width=1280,height=720,noopener");
  };

  // その日にシフト登録されているスタッフのみ担当に選べるようにする
  const workingStaffIds = useMemo(
    () => new Set(shifts.filter((s) => s.date === date).map((s) => s.staffId)),
    [shifts, date],
  );
  const assignableStaff = (r) =>
    staff.filter((s) => s.active && (workingStaffIds.has(s.id) || s.id === r?.staffId));

  const menusFor = (r) => menus.filter((m) => m.storeId === r?.storeId);
  const optionsFor = (r) => options.filter((o) => o.storeId === r?.storeId);

  const updateSel = (patch) => setSel((prev) => ({ ...prev, ...patch }));

  const selectMenu = (menuId) => {
    const m = menusFor(sel).find((x) => x.id === menuId);
    const optionPrice = options.find((o) => o.id === sel.course?.optionId)?.price || 0;
    if (!m) {
      updateSel({
        course: { ...sel.course, menuId: "", name: "", displayName: "", minutes: "", color: "" },
        amount: optionPrice,
      });
      return;
    }
    updateSel({
      course: {
        ...sel.course,
        menuId: m.id,
        name: m.name,
        displayName: m.displayName,
        minutes: m.minutes,
        color: m.color,
      },
      amount: m.price + optionPrice,
    });
  };

  const selectOption = (optionId) => {
    const o = optionsFor(sel).find((x) => x.id === optionId);
    const menuPrice = menus.find((m) => m.id === sel.course?.menuId)?.price || 0;
    if (!o) {
      updateSel({
        course: {
          ...sel.course,
          optionId: "",
          optionName: "",
          optionDisplayName: "",
          optionMinutes: "",
          optionColor: "",
        },
        amount: menuPrice,
      });
      return;
    }
    updateSel({
      course: {
        ...sel.course,
        optionId: o.id,
        optionName: o.name,
        optionDisplayName: o.displayName,
        optionMinutes: o.minutes,
        optionColor: o.color,
      },
      amount: menuPrice + o.price,
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.saveReception(sel);
      setRecords((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setSel(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm("この予約を削除しますか？")) return;
    setBusy(true);
    try {
      await api.deleteReception(sel.id, sel.date || date);
      setRecords((prev) => prev.filter((x) => x.id !== sel.id));
      setSel(null);
    } catch (e) {
      alert(`削除失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h2>タイムボード</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn sm" onClick={() => setNewOpen(true)}>
          ＋ 新規受付
        </button>
        <button className="btn sm ghost" onClick={() => setBreakModal({ editing: null })}>
          ☕ 休憩
        </button>
        <button className="btn sm ghost desktop-only" onClick={openBoardWindow}>
          🖥️ 別ウィンドウで表示
        </button>
        <span className="muted desktop-only" style={{ fontSize: 12 }}>
          10分刻み／斜線＝移動（20分・本店パレス2F基準）／灰色＝シフト外
        </span>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : (
        <TimeBoardGrid
          stores={stores}
          staff={staff}
          records={records}
          shifts={shifts}
          breaks={breaks}
          date={date}
          onSelect={setSel}
          onSelectBreak={(b) => setBreakModal({ editing: b })}
          hourWidth={80}
        />
      )}

      {sel && (
        <div className="modal-overlay" onClick={() => setSel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{sel.customerName} 様</h3>
            <p className="muted" style={{ marginTop: -8 }}>
              {stores.find((s) => s.id === sel.storeId)?.name} / Bed {sel.bed}
            </p>

            <div className="field">
              <label>コース</label>
              <select value={sel.course?.menuId || ""} onChange={(e) => selectMenu(e.target.value)}>
                <option value="">未選択</option>
                {menusFor(sel).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>オプション</label>
              <select
                value={sel.course?.optionId || ""}
                onChange={(e) => selectOption(e.target.value)}
              >
                <option value="">なし</option>
                {optionsFor(sel).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="row">
              <div className="field">
                <label>担当</label>
                <select
                  value={sel.staffId || ""}
                  onChange={(e) => updateSel({ staffId: e.target.value })}
                >
                  <option value="">未定</option>
                  {assignableStaff(sel).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>開始</label>
                <TimeInput10
                  value={sel.startTime || ""}
                  onChange={(v) => updateSel({ startTime: v })}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>支払方法</label>
                <select
                  value={sel.payment || ""}
                  onChange={(e) => updateSel({ payment: e.target.value })}
                >
                  {PAYMENTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>金額</label>
                <input
                  type="number"
                  value={sel.amount || 0}
                  onChange={(e) => updateSel({ amount: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>部屋番号</label>
                <input value={sel.room || ""} onChange={(e) => updateSel({ room: e.target.value })} />
              </div>
              <div className="field">
                <label>携帯番号</label>
                <input value={sel.phone || ""} onChange={(e) => updateSel({ phone: e.target.value })} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn gray" onClick={() => setSel(null)}>
                キャンセル
              </button>
              <button className="btn danger" onClick={del} disabled={busy}>
                削除
              </button>
              <button className="btn" onClick={save} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {newOpen && (
        <NewReceptionModal
          date={date}
          stores={stores}
          staff={staff}
          menus={menus}
          options={options}
          workingStaffIds={workingStaffIds}
          onClose={() => setNewOpen(false)}
          onSaved={(saved) => {
            if (saved.date === date) setRecords((prev) => [...prev, saved]);
            setNewOpen(false);
          }}
        />
      )}

      {breakModal && (
        <BreakModal
          date={date}
          staff={staff}
          assignableStaffIds={workingStaffIds}
          editing={breakModal.editing}
          onClose={() => setBreakModal(null)}
          onSaved={(saved) => {
            setBreaks((prev) => {
              const exists = prev.some((x) => x.id === saved.id);
              return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
            });
            setBreakModal(null);
          }}
          onDeleted={(id) => {
            setBreaks((prev) => prev.filter((x) => x.id !== id));
            setBreakModal(null);
          }}
        />
      )}
    </div>
  );
}
