import { useEffect, useMemo, useRef, useState } from "react";
import { PAYMENTS, api, sortByOrder, staffDisplayName, todayStr } from "../api.js";
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
  const selOriginalRef = useRef(null); // 編集モーダルを開いた時点の元データ（undo用）
  const [busy, setBusy] = useState(false);
  const [confirmMailBusy, setConfirmMailBusy] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [undoBusy, setUndoBusy] = useState(false);
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

  const changeSelStore = (storeId) => {
    updateSel({
      storeId,
      bed: "",
      course: {
        menuId: "",
        name: "",
        displayName: "",
        minutes: "",
        color: "",
        freeText: "",
        optionId: "",
        optionName: "",
        optionDisplayName: "",
        optionMinutes: "",
        optionColor: "",
        couponId: "",
        couponName: "",
        couponDiscount: 0,
        extensionId: "",
        extensionName: "",
        extensionDisplayName: "",
        extensionMinutes: "",
        extensionColor: "",
      },
    });
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

  const UNDO_LIMIT = 20;
  const pushUndo = (entry) => {
    setUndoStack((prev) => [...prev.slice(-(UNDO_LIMIT - 1)), entry]);
  };

  const undo = async () => {
    if (!undoStack.length || undoBusy) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setUndoBusy(true);
    try {
      if (last.type === "update") {
        const saved = await api.saveReception(last.record);
        setRecords((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      } else if (last.type === "delete") {
        const saved = await api.saveReception({ ...last.record, id: "" });
        if (saved.date === date) setRecords((prev) => [...prev, saved]);
      } else if (last.type === "create") {
        await api.deleteReception(last.record.id, last.record.date || date);
        setRecords((prev) => prev.filter((x) => x.id !== last.record.id));
      }
    } catch (e) {
      alert(`元に戻す処理に失敗しました: ${e.message}`);
    } finally {
      setUndoBusy(false);
    }
  };

  // Ctrl+Z / Cmd+Z で元に戻す
  useEffect(() => {
    const onKeyDown = (e) => {
      const isUndoKey = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z";
      if (!isUndoKey || sel) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line
  }, [undo, sel]);

  const sendConfirmEmailForSel = async () => {
    if (!sel?.email) return;
    if (sel.confirmEmailSentAt) {
      const ok = confirm(
        `このお客様には ${new Date(sel.confirmEmailSentAt).toLocaleString(
          "ja-JP",
        )} に確定メールを送信済みです。もう一度送信しますか？`,
      );
      if (!ok) return;
    }
    setConfirmMailBusy(true);
    try {
      const { record: savedRecord } = await api.sendConfirmEmail(sel);
      setSel(savedRecord);
      setRecords((prev) => prev.map((x) => (x.id === savedRecord.id ? savedRecord : x)));
      alert("確定メールを送信しました。");
    } catch (e) {
      alert(`送信失敗: ${e.message}`);
    } finally {
      setConfirmMailBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.saveReception(sel);
      if (selOriginalRef.current) pushUndo({ type: "update", record: selOriginalRef.current });
      setRecords((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setSel(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // 現在編集中の内容をコピーして、担当未定（タイムボード下部の「未定」欄）で複製する。
  const duplicate = async () => {
    setBusy(true);
    try {
      const copy = { ...sel, id: "", staffId: "" };
      const saved = await api.saveReception(copy);
      pushUndo({ type: "create", record: saved });
      setRecords((prev) => [...prev, saved]);
      setSel(null);
    } catch (e) {
      alert(`複製失敗: ${e.message}`);
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
      pushUndo({ type: "update", record });
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
      pushUndo({ type: "delete", record: sel });
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
          <button
            className="btn sm ghost"
            onClick={undo}
            disabled={!undoStack.length || undoBusy}
            title="直前の変更・削除を1つ元に戻します（Ctrl+Z）"
          >
            ↩️ 元に戻す{undoStack.length > 0 ? `（${undoStack.length}）` : ""}
          </button>
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
            onSelect={(r) => {
              selOriginalRef.current = r;
              setSel(r);
            }}
            onMove={handleMove}
            hourWidth={140}
          />
        </div>
      </div>

      {sel && (
        <div className="modal-overlay" onClick={overlayClose(() => setSel(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="field">
              <label>お客様名</label>
              <input
                value={sel.customerName || ""}
                onChange={(e) => updateSel({ customerName: e.target.value })}
              />
            </div>
            <p className="muted" style={{ marginTop: -8 }}>
              Bed {sel.bed}
            </p>
            <div className="field">
              <label>店舗</label>
              <select value={sel.storeId} onChange={(e) => changeSelStore(e.target.value)}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

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
                      {staffDisplayName(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>開始</label>
                <TimeInput10
                  minHour={11}
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

            <div className="field">
              <label>メールアドレス</label>
              <input
                type="email"
                value={sel.email || ""}
                placeholder="お客様のメールアドレス（予約確定メールの送信先）"
                onChange={(e) => updateSel({ email: e.target.value })}
              />
            </div>

            <div className="field">
              <label>予約確定メール</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn sm"
                  disabled={confirmMailBusy || !sel.email}
                  onClick={sendConfirmEmailForSel}
                >
                  ✉️ {sel.confirmEmailSentAt ? "確定メールを再送する" : "確定メールを送る"}
                </button>
                {sel.confirmEmailSentAt ? (
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    送信済み：{new Date(sel.confirmEmailSentAt).toLocaleString("ja-JP")}
                  </span>
                ) : (
                  <span className="muted" style={{ fontSize: 12.5 }}>未送信</span>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn gray" onClick={() => setSel(null)}>
                キャンセル
              </button>
              <button className="btn danger" onClick={del} disabled={busy}>
                削除
              </button>
              <button className="btn gray" onClick={duplicate} disabled={busy}>
                📋 複製
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
