import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { PAYMENTS, api, sortByOrder, todayStr } from "../api.js";
import BreakModal from "../components/BreakModal.jsx";
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
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [breakModal, setBreakModal] = useState(null); // { editing } | null
  const [attendanceModal, setAttendanceModal] = useState(null); // staffId | null
  const [editCheckInTime, setEditCheckInTime] = useState(""); // 出勤モーダル内での編集値

  const load = async () => {
    setLoading(true);
    try {
      const [rec, sh, br, att] = await Promise.all([
        api.reception(date),
        api.shifts(),
        api.breaks(),
        api.attendance(date),
      ]);
      setRecords(rec);
      setShifts(sh);
      setBreaks(br);
      setAttendance(att);
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

  const handleMove = async (record, patch) => {
    const updated = { ...record, ...patch };
    setRecords((prev) => prev.map((x) => (x.id === record.id ? updated : x)));
    try {
      const saved = await api.saveReception(updated);
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
          attendance={attendance}
          date={date}
          onSelect={setSel}
          onSelectBreak={(b) => setBreakModal({ editing: b })}
          onMove={handleMove}
          onStaffClick={(staffId) => {
            const rec = attendance.find((a) => a.staffId === staffId && a.date === date);
            setEditCheckInTime(rec?.checkInTime || "");
            setAttendanceModal(staffId);
          }}
          hourWidth={80}
        />
      )}

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
              return rec?.checkInTime ? (
                <>
                  <p className="muted" style={{ marginTop: -6 }}>
                    出勤時刻を編集できます
                  </p>
                  <div className="modal-actions" style={{ justifyContent: "center", marginBottom: 4 }}>
                    <TimeInput10 value={editCheckInTime} onChange={setEditCheckInTime} />
                  </div>
                  <div className="modal-actions">
                    <button className="btn gray" onClick={() => setAttendanceModal(null)}>
                      閉じる
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => cancelCheckIn(attendanceModal)}
                    >
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
                </>
              ) : (
                <>
                  <p className="muted" style={{ marginTop: -6 }}>
                    まだ出勤していません（時刻を指定して出勤にすることもできます）
                  </p>
                  <div className="modal-actions" style={{ justifyContent: "center", marginBottom: 4 }}>
                    <TimeInput10 value={editCheckInTime} onChange={setEditCheckInTime} />
                  </div>
                  <div className="modal-actions">
                    <button className="btn gray" onClick={() => setAttendanceModal(null)}>
                      キャンセル
                    </button>
                    <button className="btn" onClick={() => checkIn(attendanceModal)}>
                      現在時刻で出勤
                    </button>
                    <button
                      className="btn"
                      disabled={!editCheckInTime}
                      onClick={() => updateCheckIn(attendanceModal, editCheckInTime)}
                    >
                      指定時刻で出勤
                    </button>
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
    </div>
  );
}
