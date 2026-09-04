import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../App.jsx";
import { PAYMENTS, api, sortByOrder, staffDisplayName, todayStr } from "../api.js";
import NewReceptionModal from "../components/NewReceptionModal.jsx";
import SignaturePad from "../components/SignaturePad.jsx";
import TimeInput10 from "../components/TimeInput10.jsx";

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
      optionId: "",
      optionName: "",
      optionDisplayName: "",
      optionMinutes: "",
      optionColor: "",
    },
    pregnancy: false,
    nominate: false,
    done: false,
    couponCheck: false,
    catchCheck: false,
    cashNote: "",
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

function emptyMeta(date) {
  return { date, guestCount: "", childCount: "", inbound: "", signature: "" };
}

export default function ReceptionList() {
  const { stores, staff, menus, options, coupons, extensions, ready } = useApp();
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [meta, setMeta] = useState(emptyMeta(todayStr()));
  const [loading, setLoading] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [freeTextRows, setFreeTextRows] = useState(new Set());
  const [newOpen, setNewOpen] = useState(false);
  // 削除中のIDを即時マーク（confirm()によるblur連鎖で誤って保存が走るのを防ぐ）
  const deletingIdsRef = useRef(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [rec, mt] = await Promise.all([api.reception(date), api.receptionMeta(date)]);
      setRecords(rec);
      setMeta(mt);
      setFreeTextRows(new Set(rec.filter((r) => r.course?.freeText).map((r) => r.id)));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    if (ready) load();
  }, [date, ready]);

  // シフト（出勤スタッフ判定用）は全体を一括取得
  useEffect(() => {
    if (ready) api.shifts().then(setShifts).catch(() => {});
  }, [ready]);

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

  // レコードの一部を更新して即保存（新規行なら作成）。体感速度のため先に画面へ反映する。
  const updateRecord = async (r, patch) => {
    if (r && deletingIdsRef.current.has(r.id)) return;
    const base = r ? normalizeRecord(r) : emptyRecord(stores[0]?.id, date);
    const payload = { ...base, ...patch };

    if (r) {
      setRecords((prev) => prev.map((x) => (x.id === r.id ? payload : x)));
    }

    try {
      const saved = await api.saveReception(payload);
      if (deletingIdsRef.current.has(saved.id)) return; // 保存が返る前に削除された場合は反映しない
      setRecords((prev) => {
        const exists = prev.some((x) => x.id === saved.id);
        return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
      });
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
      load();
    }
  };

  const del = async (id, recordDate) => {
    // confirm()はダイアログ表示時に他のフォーカス中の入力欄をblurさせ、
    // その保存処理と競合することがあるため、確認前に削除中として先にマークしておく
    deletingIdsRef.current.add(id);
    const ok = window.confirm("この受付を削除しますか？");
    if (!ok) {
      deletingIdsRef.current.delete(id);
      return;
    }
    setRecords((prev) => prev.filter((x) => x.id !== id));
    try {
      await api.deleteReception(id, recordDate || date);
    } catch (e) {
      alert(`削除失敗: ${e.message}`);
      load();
    } finally {
      deletingIdsRef.current.delete(id);
    }
  };

  const updateMeta = async (patch) => {
    const payload = { ...meta, ...patch, date };
    setMeta(payload);
    try {
      await api.saveReceptionMeta(payload);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    }
  };

  const staffName = (id) => staff.find((s) => s.id === id)?.name || "";
  const storeName = (id) => stores.find((s) => s.id === id)?.name || "";

  // その日にシフト登録されているスタッフのみ担当に選べるようにする
  const workingStaffIds = useMemo(
    () => new Set(shifts.filter((s) => s.date === date).map((s) => s.staffId)),
    [shifts, date],
  );
  const assignableStaff = (r) =>
    staff.filter((s) => s.active && (workingStaffIds.has(s.id) || s.id === r?.staffId));

  const menusFor = (r) =>
    sortByOrder(menus.filter((m) => m.storeId === (r?.storeId || stores[0]?.id)));
  const shortStoreLabel = (s) => `${s.building || ""}${s.floor || ""}` || s.name;

  // ---- 紙の受付表の再現用 ----
  const [yy, mm, dd] = date.split("-").map(Number);
  const youbi = "日月火水木金土"[new Date(yy, mm - 1, dd).getDay()];
  // 紙の様式に合わせて1ページ最大20行。
  // 店舗グループ（BODY RECESS=パレス／宙館、Spa the Ceada）ごとに別の受付表として分け、
  // 21件以上になる場合はページ（NO.）を分けて続ける。
  const PAGE_SIZE = 20;
  const storeById = useMemo(() => Object.fromEntries(stores.map((s) => [s.id, s])), [stores]);
  const isCeadaStore = (storeId) => storeById[storeId]?.building === "Ceada";
  const bodyRecessRecords = useMemo(
    () => view.filter((r) => !isCeadaStore(r.storeId)),
    // eslint-disable-next-line
    [view, storeById],
  );
  const ceadaRecords = useMemo(
    () => view.filter((r) => isCeadaStore(r.storeId)),
    // eslint-disable-next-line
    [view, storeById],
  );
  const sumOf = (list) => list.reduce((s, r) => s + Number(r.amount || 0), 0);
  const num = (n) => Number(n || 0).toLocaleString("ja-JP");

  return (
    <div>
      <div className="page-head">
        <h2>受付一覧表</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn sm" onClick={() => setNewOpen(true)}>
          ＋ 新規受付
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          セルをクリックしてそのまま編集／行の削除ボタンで削除
        </span>
        <button className="btn sm ghost" onClick={() => window.print()}>
          🖨️ 印刷
        </button>
      </div>
      <style>{"@page { size: A4 landscape; margin: 8mm; }"}</style>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : (
        <>
          {renderGroupPages(bodyRecessRecords, "BODY RECESS（パレス／宙館）")}
          {renderGroupPages(ceadaRecords, "Spa the Ceada")}
        </>
      )}


      {signOpen && (
        <SignaturePad
          initialValue={meta.signature}
          onClose={() => setSignOpen(false)}
          onSave={(dataUrl) => {
            updateMeta({ signature: dataUrl });
            setSignOpen(false);
          }}
        />
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
    </div>
  );

  function renderGroupPages(groupRecords, groupLabel) {
    const groupKey = groupLabel;
    const pageCount = Math.max(1, Math.ceil(groupRecords.length / PAGE_SIZE));
    const groupTotal = sumOf(groupRecords);

    return Array.from({ length: pageCount }, (_, pageIndex) => {
      const startNo = pageIndex * PAGE_SIZE;
      const slice = groupRecords.slice(startNo, startNo + PAGE_SIZE);
      const isLastPage = pageIndex === pageCount - 1;
      const rowCount = isLastPage ? Math.max(PAGE_SIZE, slice.length + 3) : PAGE_SIZE;
      const cashList = groupRecords.filter((r) => r.payment === "現金");
      const roomList = groupRecords.filter((r) => r.payment === "部屋付け");
      const creditList = groupRecords.filter((r) => r.payment === "クレジット");
      const qrList = groupRecords.filter((r) => r.payment === "QR");

      return (
        <div className="sheet-scroll reception-sheet" key={`${groupKey}-${pageIndex}`}>
          <div className="sheet">
            <div className="sheet-head">
              <span className="sheet-title">{groupLabel}　受付表</span>
              <span>
                客数{" "}
                <input
                  type="number"
                  className="meta-input meta-input-wide"
                  defaultValue={meta.guestCount}
                  onBlur={(e) => updateMeta({ guestCount: e.target.value })}
                />{" "}
                名（内子供
                <input
                  type="number"
                  className="meta-input"
                  defaultValue={meta.childCount}
                  onBlur={(e) => updateMeta({ childCount: e.target.value })}
                />
                名）　インバウンド
                <input
                  type="number"
                  className="meta-input"
                  defaultValue={meta.inbound}
                  onBlur={(e) => updateMeta({ inbound: e.target.value })}
                />
                名
              </span>
              <span>
                令和 {yy - 2018} 年 {mm} 月 {dd} 日（{youbi}）　NO. {pageIndex + 1}
              </span>
            </div>

            <table className="sheet-table">
              <thead>
                <tr>
                  <th>
                    終了
                    <br />
                    チェック
                  </th>
                  <th>日付</th>
                  <th>NO</th>
                  <th>店舗</th>
                  <th>
                    ベッド
                    <br />
                    NO
                  </th>
                  <th>氏名</th>
                  <th>性別</th>
                  <th>コース</th>
                  <th>
                    クーポン
                    <br />
                    チェック
                  </th>
                  <th>指名</th>
                  <th>キャッチ</th>
                  <th>担当</th>
                  <th>開始時間</th>
                  <th>支払方法</th>
                  <th>受付者</th>
                  <th>部屋番号</th>
                  <th>電話番号</th>
                  <th>金額</th>
                  <th>
                    現金金額／釣銭
                    <br />
                    受領担当
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }, (_, i) => {
                  const r = slice[i];
                  const displayNo = startNo + i + 1;
                  const rowKey = r ? r.id : `empty-${groupKey}-${pageIndex}-${i}`;
                  return (
                    <tr
                      key={rowKey}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (r) del(r.id, r.date);
                      }}
                    >
                      <td className="c-center">
                        <input
                          type="checkbox"
                          checked={!!r?.done}
                          disabled={!r}
                          onChange={(e) => updateRecord(r, { done: e.target.checked })}
                        />
                      </td>
                      <td className="c-center">{i === 0 ? `${mm}/${dd}` : ""}</td>
                      <td className="c-center c-no">{displayNo}</td>
                      <td className="c-center">
                        <select
                          className="cell-select"
                          value={r?.storeId || stores[0]?.id || ""}
                          onChange={(e) =>
                            updateRecord(r, {
                              storeId: e.target.value,
                              course: {
                                menuId: "",
                                name: "",
                                displayName: "",
                                minutes: "",
                                color: "",
                                freeText: r?.course?.freeText || "",
                              },
                            })
                          }
                        >
                          {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {shortStoreLabel(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="c-center">
                        <input
                          className="cell-input c-narrow"
                          key={`${rowKey}-bed`}
                          defaultValue={r?.bed || ""}
                          onBlur={(e) => updateRecord(r, { bed: e.target.value })}
                        />
                      </td>
                      <td className="c-name">
                        <div className="cell">
                          <input
                            className="cell-input"
                            key={`${rowKey}-name`}
                            defaultValue={r?.customerName || ""}
                            onBlur={(e) => updateRecord(r, { customerName: e.target.value })}
                          />
                          <span className="printed">様</span>
                        </div>
                      </td>
                      <td className="c-center printed">
                        <span
                          className={r?.gender === "男" ? "circled clickable" : "clickable"}
                          onClick={() => updateRecord(r, { gender: "男" })}
                        >
                          男
                        </span>
                        ・
                        <span
                          className={r?.gender === "女" ? "circled clickable" : "clickable"}
                          onClick={() => updateRecord(r, { gender: "女" })}
                        >
                          女
                        </span>
                      </td>
                      <td className="c-course">
                        {freeTextRows.has(rowKey) ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              className="cell-input"
                              key={`${rowKey}-free`}
                              defaultValue={r?.course?.freeText || ""}
                              placeholder="自由記述"
                              onBlur={(e) =>
                                updateRecord(r, {
                                  course: { ...(r?.course || {}), freeText: e.target.value },
                                })
                              }
                            />
                            <span
                              className="clickable"
                              title="コース一覧から選び直す"
                              onClick={() => {
                                setFreeTextRows((prev) => {
                                  const s = new Set(prev);
                                  s.delete(rowKey);
                                  return s;
                                });
                                updateRecord(r, {
                                  course: { ...(r?.course || {}), freeText: "" },
                                });
                              }}
                            >
                              ▾
                            </span>
                          </div>
                        ) : (
                          <select
                            className="cell-select"
                            value={r?.course?.menuId || ""}
                            onChange={(e) => {
                              if (e.target.value === "__free__") {
                                setFreeTextRows((prev) => new Set(prev).add(rowKey));
                                return;
                              }
                              const m = menusFor(r).find((x) => x.id === e.target.value);
                              if (!m) {
                                updateRecord(r, {
                                  course: {
                                    ...(r?.course || {}),
                                    menuId: "",
                                    name: "",
                                    displayName: "",
                                    minutes: "",
                                    color: "",
                                  },
                                });
                                return;
                              }
                              updateRecord(r, {
                                course: {
                                  ...(r?.course || {}),
                                  menuId: m.id,
                                  name: m.name,
                                  displayName: m.displayName,
                                  minutes: m.minutes,
                                  color: m.color,
                                },
                                amount:
                                  m.price +
                                  (options.find((o) => o.id === r?.course?.optionId)?.price || 0),
                              });
                            }}
                          >
                            <option value="">未選択</option>
                            {menusFor(r).map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                            <option value="__free__">自由記述</option>
                          </select>
                        )}
                        {r?.pregnancy && <span className="printed">（妊）</span>}
                      </td>
                      <td className="c-center">
                        <input
                          type="checkbox"
                          checked={!!r?.couponCheck}
                          disabled={!r}
                          onChange={(e) => updateRecord(r, { couponCheck: e.target.checked })}
                        />
                      </td>
                      <td
                        className="c-center clickable"
                        onClick={() => updateRecord(r, { nominate: !r?.nominate })}
                      >
                        {r?.nominate ? "○" : ""}
                      </td>
                      <td className="c-center">
                        <input
                          type="checkbox"
                          checked={!!r?.catchCheck}
                          disabled={!r}
                          onChange={(e) => updateRecord(r, { catchCheck: e.target.checked })}
                        />
                      </td>
                      <td className="c-center">
                        <select
                          className="cell-select"
                          value={r?.staffId || ""}
                          onChange={(e) => updateRecord(r, { staffId: e.target.value })}
                        >
                          <option value="">未定</option>
                          {assignableStaff(r).map((s) => (
                            <option key={s.id} value={s.id}>
                              {staffDisplayName(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="c-center">
                        <TimeInput10
                          className="time10-cell"
                          value={r?.startTime || ""}
                          onChange={(v) => updateRecord(r, { startTime: v })}
                        />
                      </td>
                      <td className="c-center printed pay-cell">
                        {PAYMENTS.filter((p) => p !== "その他").map((p, idx, arr) => (
                          <span key={p}>
                            <span
                              className={r?.payment === p ? "circled clickable" : "clickable"}
                              onClick={() => updateRecord(r, { payment: p, paymentNote: "" })}
                            >
                              {p === "現金" ? "現" : p === "部屋付け" ? "部" : p === "クレジット" ? "クレ" : p}
                            </span>
                            {idx < arr.length - 1 ? "・" : ""}
                          </span>
                        ))}
                        ・
                        {r?.payment === "その他" ? (
                          <input
                            className="cell-input c-narrow"
                            key={`${rowKey}-paynote`}
                            defaultValue={r?.paymentNote || ""}
                            placeholder="他"
                            onBlur={(e) =>
                              updateRecord(r, { payment: "その他", paymentNote: e.target.value })
                            }
                          />
                        ) : (
                          <span
                            className="clickable"
                            onClick={() => updateRecord(r, { payment: "その他" })}
                          >
                            他
                          </span>
                        )}
                      </td>
                      <td className="c-center">
                        <input
                          className="cell-input c-narrow"
                          key={`${rowKey}-recept`}
                          defaultValue={r?.receptionist || ""}
                          onBlur={(e) => updateRecord(r, { receptionist: e.target.value })}
                        />
                      </td>
                      <td className="c-center">
                        <input
                          className="cell-input c-narrow"
                          key={`${rowKey}-room`}
                          defaultValue={r?.room || ""}
                          onBlur={(e) => updateRecord(r, { room: e.target.value })}
                        />
                      </td>
                      <td className="c-center">
                        <input
                          className="cell-input c-narrow"
                          key={`${rowKey}-phone`}
                          defaultValue={r?.phone || ""}
                          onBlur={(e) => updateRecord(r, { phone: e.target.value })}
                        />
                      </td>
                      <td className="c-amount">
                        <input
                          type="number"
                          className="cell-input c-narrow amount-input"
                          key={`${rowKey}-amount`}
                          defaultValue={r?.amount || ""}
                          onBlur={(e) => updateRecord(r, { amount: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="c-center">
                        <input
                          className="cell-input c-narrow"
                          key={`${rowKey}-cashnote`}
                          defaultValue={r?.cashNote || ""}
                          onBlur={(e) => updateRecord(r, { cashNote: e.target.value })}
                        />
                      </td>
                      <td className="c-center">
                        {r && (
                          <button
                            className="row-del-btn"
                            title="この行を削除"
                            onClick={() => del(r.id, r.date)}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isLastPage && (
            <div className="sheet-foot">
              <div className="sf-left">
                <div>
                  青伝③（{roomList.length}）枚　合計（{num(sumOf(roomList))}）円
                </div>
                <div>
                  宙店（<span className="fill-blank" />）名　合計（
                  <span className="fill-blank w" />）円
                </div>
                <div>
                  レジ金５万チェック（<span className="fill-blank" />）Ｗチェック（
                  <span className="fill-blank" />）
                </div>
                <div>
                  通帳入金チェック（<span className="fill-blank" />）日　計　表（
                  <span className="fill-blank" />）
                </div>
                <div>
                  中間の現金チェック（<span className="fill-blank" />）時（
                  <span className="fill-blank" />）分
                </div>
              </div>
              <div className="sf-sign clickable" onClick={() => setSignOpen(true)}>
                {meta.signature ? (
                  <img src={meta.signature} alt="サイン" className="sf-sign-img" />
                ) : (
                  "サイン"
                )}
              </div>
              <div className="sf-check">
                <div className="sf-check-head">リスト（磁石）確認</div>
                <div>時　担当</div>
                <div>時　担当</div>
                <div>時　担当</div>
                <div>時　担当</div>
              </div>
              <div className="sf-total">
                <div>
                  <span>現金</span>
                  <span>{cashList.length} 件</span>
                  <span>{num(sumOf(cashList))} 円</span>
                </div>
                <div>
                  <span>部屋掛け</span>
                  <span>{roomList.length} 件</span>
                  <span>{num(sumOf(roomList))} 円</span>
                </div>
                <div>
                  <span>クレジット</span>
                  <span>{creditList.length} 件</span>
                  <span>{num(sumOf(creditList))} 円</span>
                </div>
                <div>
                  <span>QR</span>
                  <span>{qrList.length} 件</span>
                  <span>{num(sumOf(qrList))} 円</span>
                </div>
                <div>
                  <span>合計</span>
                  <span>{groupRecords.length} 件</span>
                  <span>{num(groupTotal)} 円</span>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      );
    });
  }
}
