import { useEffect, useMemo, useRef, useState } from "react";
import { PAYMENTS, api, sortByOrder, todayStr } from "../api.js";
import TimeBoardGrid from "../components/TimeBoardGrid.jsx";
import TimeInput10 from "../components/TimeInput10.jsx";
import Login from "./Login.jsx";
import { loadSession, saveSession } from "../session.js";
import { overlayClose } from "../modalUtils.js";

const REFRESH_MS = 20000;

export default function BoardView() {
  const [role, setRole] = useState(() => loadSession()?.role || null);
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [menus, setMenus] = useState([]);
  const [options, setOptions] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  const handleLogin = (result) => {
    setRole(result.role);
    saveSession(result);
  };

  useEffect(() => {
    if (!role) return;
    let alive = true;

    const tick = async () => {
      try {
        const date = todayStr();
        const [st, sf, mn, op, cp, ex, rec, sh, att] = await Promise.all([
          api.stores(),
          api.staff(),
          api.menus(),
          api.options(),
          api.coupons(),
          api.extensions(),
          api.reception(date),
          api.shifts(),
          api.attendance(date),
        ]);
        if (!alive) return;
        setStores(st);
        setStaff(sf);
        setMenus(mn);
        setOptions(op);
        setCoupons(cp);
        setExtensions(ex);
        setRecords(rec);
        setShifts(sh);
        setAttendance(att);
        setNow(new Date());
      } catch {
        // 表示専用画面のため、通信エラーは静かに無視して次回更新を待つ
      }
    };

    tick();
    timerRef.current = setInterval(tick, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timerRef.current);
    };
  }, [role]);

  const date = todayStr();

  const workingStaffIds = useMemo(
    () => new Set(shifts.filter((s) => s.date === date).map((s) => s.staffId)),
    [shifts, date],
  );
  const assignableStaff = (r) =>
    staff.filter((s) => s.active && (workingStaffIds.has(s.id) || s.id === r?.staffId));

  const menusFor = (r) => sortByOrder(menus.filter((m) => m.storeId === r?.storeId));
  const optionsFor = (r) => sortByOrder(options.filter((o) => o.storeId === r?.storeId));
  const extensionsFor = (r) => sortByOrder(extensions.filter((e) => e.storeId === r?.storeId));

  const updateSel = (patch) => setSel((prev) => ({ ...prev, ...patch }));

  // コース料金＋オプション料金＋延長料金－クーポン割引額（0円未満にはしない）
  const computeAmount = (menuId, optionId, couponId, extensionId) => {
    const menuPrice = menus.find((m) => m.id === menuId)?.price || 0;
    const optionPrice = options.find((o) => o.id === optionId)?.price || 0;
    const extensionPrice = extensions.find((e) => e.id === extensionId)?.price || 0;
    const discount = coupons.find((c) => c.id === couponId)?.discountAmount || 0;
    return Math.max(0, menuPrice + optionPrice + extensionPrice - discount);
  };

  const selectMenu = (menuId) => {
    const m = menusFor(sel).find((x) => x.id === menuId);
    const cur = sel.course || {};
    if (!m) {
      updateSel({
        course: { ...cur, menuId: "", name: "", displayName: "", minutes: "", color: "" },
        amount: computeAmount("", cur.optionId, cur.couponId, cur.extensionId),
      });
      return;
    }
    updateSel({
      course: {
        ...cur,
        menuId: m.id,
        name: m.name,
        displayName: m.displayName,
        minutes: m.minutes,
        color: m.color,
      },
      amount: computeAmount(m.id, cur.optionId, cur.couponId, cur.extensionId),
    });
  };

  const selectOption = (optionId) => {
    const o = optionsFor(sel).find((x) => x.id === optionId);
    const cur = sel.course || {};
    if (!o) {
      updateSel({
        course: {
          ...cur,
          optionId: "",
          optionName: "",
          optionDisplayName: "",
          optionMinutes: "",
          optionColor: "",
        },
        amount: computeAmount(cur.menuId, "", cur.couponId, cur.extensionId),
      });
      return;
    }
    updateSel({
      course: {
        ...cur,
        optionId: o.id,
        optionName: o.name,
        optionDisplayName: o.displayName,
        optionMinutes: o.minutes,
        optionColor: o.color,
      },
      amount: computeAmount(cur.menuId, o.id, cur.couponId, cur.extensionId),
    });
  };

  const selectCoupon = (couponId) => {
    const cp = coupons.find((x) => x.id === couponId);
    const cur = sel.course || {};
    if (!cp) {
      updateSel({
        course: { ...cur, couponId: "", couponName: "", couponDiscount: 0 },
        amount: computeAmount(cur.menuId, cur.optionId, "", cur.extensionId),
      });
      return;
    }
    updateSel({
      course: { ...cur, couponId: cp.id, couponName: cp.name, couponDiscount: cp.discountAmount },
      amount: computeAmount(cur.menuId, cur.optionId, cp.id, cur.extensionId),
    });
  };

  const selectExtension = (extensionId) => {
    const ex = extensionsFor(sel).find((x) => x.id === extensionId);
    const cur = sel.course || {};
    if (!ex) {
      updateSel({
        course: {
          ...cur,
          extensionId: "",
          extensionName: "",
          extensionDisplayName: "",
          extensionMinutes: "",
          extensionColor: "",
        },
        amount: computeAmount(cur.menuId, cur.optionId, cur.couponId, ""),
      });
      return;
    }
    updateSel({
      course: {
        ...cur,
        extensionId: ex.id,
        extensionName: ex.name,
        extensionDisplayName: ex.displayName,
        extensionMinutes: ex.minutes,
        extensionColor: ex.color,
      },
      amount: computeAmount(cur.menuId, cur.optionId, cur.couponId, ex.id),
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

  // タイムボード上でドラッグして時間・担当を変更した時の確定処理
  const handleMove = async (record, patch) => {
    const updated = { ...record, ...patch };
    setRecords((prev) => prev.map((x) => (x.id === record.id ? updated : x)));
    try {
      const saved = await api.saveReception(updated);
      setRecords((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    } catch (e) {
      alert(`移動失敗: ${e.message}`);
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

  if (!role) return <Login onLogin={handleLogin} />;

  const dateLabel = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}（${
    ["日", "月", "火", "水", "木", "金", "土"][now.getDay()]
  }）`;
  const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;

  return (
    <div className="board-page">
      <div className="board-frame">
        <div className="board-head">
          <strong>リラク業務管理 ／ タイムボード</strong>
          <span className="muted">{dateLabel}</span>
          <div className="spacer" />
          <span className="pill">{timeLabel}</span>
        </div>
        <div className="board-body">
          <TimeBoardGrid
            stores={stores}
            staff={staff}
            records={records}
            shifts={shifts}
            attendance={attendance}
            date={date}
            onSelect={setSel}
            onMove={handleMove}
            hourWidth={140}
          />
        </div>
      </div>

      {sel && (
        <div className="modal-overlay" onClick={overlayClose(() => setSel(null))}>
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

            <div className="field">
              <label>クーポン</label>
              {coupons.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  クーポンは登録されていません
                </div>
              ) : (
                <select
                  value={sel.course?.couponId || ""}
                  onChange={(e) => selectCoupon(e.target.value)}
                >
                  <option value="">なし</option>
                  {coupons.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}（-{Number(c.discountAmount || 0).toLocaleString("ja-JP")}円）
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="field">
              <label>延長</label>
              {extensionsFor(sel).length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  この店舗の延長料金は登録されていません
                </div>
              ) : (
                <select
                  value={sel.course?.extensionId || ""}
                  onChange={(e) => selectExtension(e.target.value)}
                >
                  <option value="">なし</option>
                  {extensionsFor(sel).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              )}
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
    </div>
  );
}
