import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../App.jsx";
import { PAYMENTS, api, sortByOrder, staffDisplayName, todayStr } from "../api.js";
import BreakModal from "../components/BreakModal.jsx";
import CallTranscriptWidget from "../components/CallTranscriptWidget.jsx";
import NewReceptionModal from "../components/NewReceptionModal.jsx";
import TimeBoardGrid from "../components/TimeBoardGrid.jsx";
import TimeInput10 from "../components/TimeInput10.jsx";
import { overlayClose } from "../modalUtils.js";

export default function TimeBoard() {
  const { stores, staff, menus, options, coupons, extensions, ready } = useApp();
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [acceptReq, setAcceptReq] = useState(null); // 受け入れ確認モーダル用
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);
  const selOriginalRef = useRef(null); // 編集モーダルを開いた時点の元データ（undo用）
  const [busy, setBusy] = useState(false);
  const [confirmMailBusy, setConfirmMailBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [breakModal, setBreakModal] = useState(null); // { editing } | null
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [undoStack, setUndoStack] = useState([]); // [{ type: "update"|"delete"|"create", record }]
  const [undoBusy, setUndoBusy] = useState(false);
  const [attendanceModal, setAttendanceModal] = useState(null); // staffId | null
  const [editCheckInTime, setEditCheckInTime] = useState(""); // 出勤モーダル内での編集値

  const load = async () => {
    setLoading(true);
    try {
      const [rec, sh, br, att, bookingReqs] = await Promise.all([
        api.reception(date),
        api.shifts(),
        api.breaks(),
        api.attendance(date),
        api.bookingRequests().catch(() => []),
      ]);
      setRecords(rec);
      setShifts(sh);
      setBreaks(br);
      setAttendance(att);
      setBookingRequests(bookingReqs);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    if (ready) load();
    setUndoStack([]);
  }, [date, ready]);

  const openBoardWindow = () => {
    window.open("/board", "relaxBoard", "width=1280,height=720,noopener");
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistory(await api.receptionHistory());
    } catch (e) {
      alert(`履歴の取得に失敗しました: ${e.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  const staffNameOf = (id) => staffDisplayName(staff.find((s) => s.id === id)) || "未定";

  const historyActionLabel = (action) => {
    if (action === "新規") return { text: "新規登録", cls: "history-new" };
    if (action === "削除") return { text: "削除", cls: "history-delete" };
    return { text: "変更", cls: "history-edit" };
  };

  const historyTimeLabel = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
  };

  // その日にシフト登録されているスタッフのみ担当に選べるようにする
  const workingStaffIds = useMemo(
    () => new Set(shifts.filter((s) => s.date === date).map((s) => s.staffId)),
    [shifts, date],
  );
  const assignableStaff = (r) =>
    staff.filter((s) => s.active && (workingStaffIds.has(s.id) || s.id === r?.staffId));

  // その日・未対応のマッサージ予約申請だけをタイムボードの「予約申請」欄に表示する
  const pendingBookingRequests = useMemo(
    () =>
      bookingRequests.filter(
        (r) => r.type === "massage" && r.desiredDate === date && r.status !== "done",
      ),
    [bookingRequests, date],
  );

  const homeStore =
    stores.find((s) => s.isHome) || stores.find((s) => s.building?.includes("パレス")) || stores[0];

  // 予約申請を受け入れて、実際の受付レコードとしてタイムボードに反映する（担当は未定のまま）。
  // 予約申請タブ側も同じデータを見ているので、ステータスを更新すれば自動的に同期される。
  const acceptBookingRequest = async (r, overrides = {}) => {
    setBusy(true);
    try {
      const priceNum = Number(String(r.price || "0").replace(/[^\d]/g, "")) || 0;
      // 予約申請に実際の店舗IDが含まれていればそれを使う（無ければ本店にフォールバック）
      const targetStoreId = r.storeId || homeStore?.id || "";

      // メニュー名・オプション名が、選ばれた店舗の実際の登録メニューと一致するか探す。
      // 一致すればコース・オプション欄にちゃんと選択された状態にする（一致しなければ自由入力で保持）。
      const storeMenus = menus.filter((m) => m.storeId === targetStoreId);
      const storeOptions = options.filter((o) => o.storeId === targetStoreId);
      const matchedMenu = storeMenus.find((m) => m.name === r.menu);
      const matchedOption =
        r.option && r.option !== "なし" ? storeOptions.find((o) => o.name === r.option) : null;

      const newRecord = {
        id: "",
        date,
        storeId: targetStoreId,
        bed: "",
        customerName: r.name || "",
        gender: "女",
        course: {
          menuId: matchedMenu?.id || "",
          name: matchedMenu?.name || r.menu || "",
          displayName: matchedMenu?.name || r.menu || "",
          minutes: matchedMenu?.minutes || "",
          color: matchedMenu?.color || "",
          freeText: matchedMenu ? "" : r.menu || "",
          optionId: matchedOption?.id || "",
          optionName: matchedOption?.name || (r.option && r.option !== "なし" ? r.option : ""),
          optionDisplayName: matchedOption?.name || "",
          optionMinutes: matchedOption?.minutes || "",
          optionColor: matchedOption?.color || "",
          couponId: "",
          couponName: "",
          couponDiscount: 0,
          extensionId: "",
          extensionName: "",
          extensionDisplayName: "",
          extensionMinutes: "",
          extensionColor: "",
        },
        nominate: false,
        pregnancy: false,
        femalePreferred: false,
        staffId: overrides.staffId ?? "",
        startTime: overrides.startTime || r.desiredTime || "",
        payment: "現金",
        paymentNote: "",
        receptionist: "",
        room: r.room || "",
        phone: r.phone || "",
        email: r.email || "",
        amount: priceNum,
        note:
          "【予約申請より受入】" +
          (!matchedMenu ? `メニュー:${r.menu || ""}　` : "") +
          (r.option && r.option !== "なし" && !matchedOption ? `オプション:${r.option}` : ""),
      };
      const saved = await api.saveReception(newRecord);
      pushUndo({ type: "acceptRequest", record: saved, bookingRequestBefore: r });
      setRecords((prev) => [...prev, saved]);

      const updatedReq = { ...r, status: "done" };
      await api.saveBookingRequest(updatedReq);
      setBookingRequests((prev) => prev.map((x) => (x.id === r.id ? updatedReq : x)));

      setAcceptReq(null);
    } catch (e) {
      alert(`受け入れ処理に失敗しました: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

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

  // 店舗を変更した場合、メニュー等は店舗ごとに異なるためリセットする。
  // ベッド番号（bed）も新しい店舗に存在しないベッドを指していると困るため空にする。
  // storeIdが変わればタイムボードの移動（滞在）判定は records から自動的に再計算される。
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
      } else if (last.type === "acceptRequest") {
        // 受け入れで作った受付を削除し、予約申請を元のステータス（未対応）に戻す
        await api.deleteReception(last.record.id, last.record.date || date);
        setRecords((prev) => prev.filter((x) => x.id !== last.record.id));
        const restored = await api.saveBookingRequest(last.bookingRequestBefore);
        setBookingRequests((prev) => prev.map((x) => (x.id === restored.id ? restored : x)));
      }
    } catch (e) {
      alert(`元に戻す処理に失敗しました: ${e.message}`);
      load();
    } finally {
      setUndoBusy(false);
    }
  };

  // Ctrl+Z / Cmd+Z で元に戻す（モーダルが開いている間は誤爆を避けるため無効）
  useEffect(() => {
    const onKeyDown = (e) => {
      const isUndoKey = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z";
      if (!isUndoKey) return;
      if (sel || newOpen || breakModal || historyOpen || attendanceModal) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line
  }, [undo, sel, newOpen, breakModal, historyOpen, attendanceModal]);

  // 予約確定メールを送信する（送信済みなら再送の確認を挟む。二重送信の事故を防ぐため）
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
  // そこから担当を割り振ってもらう想定。
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
  // 出勤打刻（現在時刻を記録）／打刻の取り消し
  const checkIn = async (staffId) => {
    const d = new Date();
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const existing = attendance.find((a) => a.staffId === staffId && a.date === date);
    try {
      const saved = await api.saveAttendance({
        id: existing?.id || "",
        staffId,
        date,
        checkInTime: time,
      });
      setAttendance((prev) => {
        const exists = prev.some((x) => x.id === saved.id);
        return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
      });
      setAttendanceModal(null);
    } catch (e) {
      alert(`出勤登録失敗: ${e.message}`);
    }
  };

  const cancelCheckIn = async (staffId) => {
    const existing = attendance.find((a) => a.staffId === staffId && a.date === date);
    if (!existing) return;
    if (!confirm("出勤時刻を取り消しますか？")) return;
    try {
      await api.deleteAttendance(existing.id, date);
      setAttendance((prev) => prev.filter((x) => x.id !== existing.id));
      setAttendanceModal(null);
    } catch (e) {
      alert(`取消失敗: ${e.message}`);
    }
  };

  // 出勤時刻を手動で編集して保存（保存後は打刻時刻順に自動で並び替わる）
  const updateCheckIn = async (staffId, time) => {
    if (!time) return;
    const existing = attendance.find((a) => a.staffId === staffId && a.date === date);
    try {
      const saved = await api.saveAttendance({
        id: existing?.id || "",
        staffId,
        date,
        checkInTime: time,
        leaveTime: existing?.leaveTime || "",
      });
      setAttendance((prev) => {
        const exists = prev.some((x) => x.id === saved.id);
        return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
      });
      setAttendanceModal(null);
    } catch (e) {
      alert(`更新失敗: ${e.message}`);
    }
  };

  // 途中退勤（現在時刻を記録。以降の時間帯はタイムボード上で灰色になる）
  const leaveEarly = async (staffId) => {
    const existing = attendance.find((a) => a.staffId === staffId && a.date === date);
    if (!existing?.checkInTime) return;
    const d = new Date();
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    try {
      const saved = await api.saveAttendance({ ...existing, leaveTime: time });
      setAttendance((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setAttendanceModal(null);
    } catch (e) {
      alert(`途中退勤登録失敗: ${e.message}`);
    }
  };

  const cancelLeave = async (staffId) => {
    const existing = attendance.find((a) => a.staffId === staffId && a.date === date);
    if (!existing?.leaveTime) return;
    try {
      const saved = await api.saveAttendance({ ...existing, leaveTime: "" });
      setAttendance((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setAttendanceModal(null);
    } catch (e) {
      alert(`取消失敗: ${e.message}`);

    }
  };

  const handleMove = async (record, patch) => {
    const updated = { ...record, ...patch };
    setRecords((prev) => prev.map((x) => (x.id === record.id ? updated : x)));
    try {
      const saved = await api.saveReception(updated);
      pushUndo({ type: "update", record });
      setRecords((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    } catch (e) {
      alert(`移動失敗: ${e.message}`);
      load();
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
        <button
          className="btn sm ghost"
          onClick={() => {
            setHistoryOpen(true);
            loadHistory();
          }}
        >
          📜 受付履歴
        </button>
        <button
          className="btn sm ghost"
          onClick={undo}
          disabled={!undoStack.length || undoBusy}
          title="直前の変更・削除・新規登録を1つ元に戻します（Ctrl+Z）"
        >
          ↩️ 元に戻す{undoStack.length > 0 ? `（${undoStack.length}）` : ""}
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
          attendance={attendance}
          date={date}
          onSelect={(r) => {
            selOriginalRef.current = r;
            setSel(r);
          }}
          onSelectBreak={(b) => setBreakModal({ editing: b })}
          onMove={handleMove}
          onStaffClick={(staffId) => {
            const rec = attendance.find((a) => a.staffId === staffId && a.date === date);
            setEditCheckInTime(rec?.checkInTime || "");
            setAttendanceModal(staffId);
          }}
          hourWidth={80}
          bookingRequests={pendingBookingRequests}
          onAcceptBookingRequest={(r) => setAcceptReq(r)}
          onAcceptBookingRequestDrop={(r, { staffId, startTime }) =>
            acceptBookingRequest(r, { staffId, startTime })
          }
        />
      )}

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
            <p className="muted" style={{ marginTop: -8 }}>
              Bed {sel.bed}
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
              {!sel.email && (
                <span className="muted" style={{ fontSize: 12 }}>
                  メールアドレスが未入力のため送信できません
                </span>
              )}
            </div>

            <div className="field">
              <label>特記事項（タイムボードに「特」と表示されます）</label>
              <input
                value={sel.note || ""}
                placeholder="例：常連様・アレルギーあり　等"
                onChange={(e) => updateSel({ note: e.target.value })}
              />
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

      {newOpen && (
        <NewReceptionModal
          date={date}
          stores={stores}
          staff={staff}
          menus={menus}
          options={options}
          coupons={coupons}
          extensions={extensions}
          workingStaffIds={workingStaffIds}
          onClose={() => setNewOpen(false)}
          onSaved={(saved) => {
            pushUndo({ type: "create", record: saved });
            if (saved.date === date) setRecords((prev) => [...prev, saved]);
            setNewOpen(false);
          }}
        />
      )}

      {attendanceModal && (
        <div className="modal-overlay" onClick={overlayClose(() => setAttendanceModal(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{staff.find((s) => s.id === attendanceModal)?.name}</h3>
            {(() => {
              const rec = attendance.find(
                (a) => a.staffId === attendanceModal && a.date === date,
              );
              if (!rec?.checkInTime) {
                // 未出勤：現在時刻での出勤のみ
                return (
                  <>
                    <p className="muted" style={{ marginTop: -6 }}>
                      まだ出勤していません
                    </p>
                    <div className="modal-actions">
                      <button className="btn gray" onClick={() => setAttendanceModal(null)}>
                        キャンセル
                      </button>
                      <button className="btn" onClick={() => checkIn(attendanceModal)}>
                        出勤
                      </button>
                    </div>
                  </>
                );
              }
              return (
                <>
                  <p className="muted" style={{ marginTop: -6 }}>
                    出勤時刻を編集できます
                  </p>
                  <div
                    className="modal-actions"
                    style={{ justifyContent: "center", marginBottom: 4 }}
                  >
                    <TimeInput10 value={editCheckInTime} onChange={setEditCheckInTime} />
                  </div>
                  {rec.leaveTime && (
                    <p className="muted" style={{ marginTop: 0 }}>
                      途中退勤：{rec.leaveTime}
                    </p>
                  )}
                  <div className="modal-actions">
                    <button className="btn gray" onClick={() => setAttendanceModal(null)}>
                      閉じる
                    </button>
                    <button className="btn danger" onClick={() => cancelCheckIn(attendanceModal)}>
                      出勤取消
                    </button>
                    <button
                      className="btn"
                      disabled={!editCheckInTime || editCheckInTime === rec.checkInTime}
                      onClick={() => updateCheckIn(attendanceModal, editCheckInTime)}
                    >
                      更新
                    </button>
                  </div>
                  <div className="modal-actions">
                    {rec.leaveTime ? (
                      <button className="btn gray" onClick={() => cancelLeave(attendanceModal)}>
                        途中退勤を取消
                      </button>
                    ) : (
                      <button className="btn danger" onClick={() => leaveEarly(attendanceModal)}>
                        途中退勤
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
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

      {historyOpen && (
        <div className="modal-overlay" onClick={overlayClose(() => setHistoryOpen(false))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>受付履歴（全日程）</h3>
            {historyLoading ? (
              <div className="empty">読み込み中…</div>
            ) : history.length === 0 ? (
              <div className="empty">この日の履歴はまだありません</div>
            ) : (
              <div className="history-list">
                {history.map((h, i) => {
                  const label = historyActionLabel(h.action);
                  return (
                    <div className="history-row" key={i}>
                      <span className={`history-badge ${label.cls}`}>{label.text}</span>
                      <span className="history-time">{historyTimeLabel(h.time)}</span>
                      <span className="history-body">
                        【{h.date}】{h.customerName || "（お客様名未入力）"}様
                        {h.startTime ? `　${h.startTime}〜` : "　時間未定"}
                        　担当：{staffNameOf(h.staffId)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setHistoryOpen(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {acceptReq && (
        <div className="modal-overlay" onClick={overlayClose(() => setAcceptReq(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>予約申請を受け入れる</h3>
            <p className="muted" style={{ marginTop: -8, lineHeight: 1.8 }}>
              希望日時：{acceptReq.desiredDate} {acceptReq.desiredTime}〜
              <br />
              お名前：{acceptReq.name}様　部屋番号：{acceptReq.room || "-"}
              <br />
              電話番号：{acceptReq.phone || "-"}
              <br />
              メニュー：{acceptReq.menu || "-"}　オプション：{acceptReq.option || "なし"}
              <br />
              金額：{acceptReq.price || "-"}
            </p>
            <p className="muted" style={{ fontSize: 12.5 }}>
              受け入れると、担当未定のままタイムボードの「未定」欄に追加されます。店舗・担当・詳細はあとから編集できます。
            </p>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setAcceptReq(null)}>
                キャンセル
              </button>
              <button className="btn" disabled={busy} onClick={() => acceptBookingRequest(acceptReq)}>
                受け入れる
              </button>
            </div>
          </div>
        </div>
      )}

      <CallTranscriptWidget />
    </div>
  );
}
