import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { addDays, api, todayStr } from "../api.js";
import TimeInput10 from "../components/TimeInput10.jsx";
import { overlayClose } from "../modalUtils.js";

const WEEK_LABEL = ["日", "月", "火", "水", "木", "金", "土"];

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const prevMonthDays = new Date(y, m - 1, 0).getDate();
  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    cells.push({ day, inMonth: false, dateStr: fmt(new Date(y, m - 2, day)) });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, inMonth: true, dateStr: fmt(new Date(y, m - 1, day)) });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: next, inMonth: false, dateStr: fmt(new Date(y, m, next)) });
    next++;
  }
  return cells;
}

function emptyShift(date, staffId) {
  return { id: "", staffId: staffId || "", date, start: "11:00", end: "23:00" };
}

// 性別タグ（男性・女性・ペア）は複数選択可。同じものをもう一度押すと外れる。
function toggleGenderTag(current, tag) {
  const arr = Array.isArray(current) ? current : current ? [current] : [];
  return arr.includes(tag) ? arr.filter((t) => t !== tag) : [...arr, tag];
}

function emptyReservation(date) {
  return {
    id: "",
    date,
    startTime: "",
    customerName: "",
    phone: "",
    minutes: 30,
    price: 0,
    memo: "",
    staffId: "",
    gender: [],
    payment: "現金",
    room: "",
    checked: false,
  };
}

const FORTUNE_COLORS = ["#1f6feb", "#e5484d", "#2fa84f", "#d99a00", "#8b5cf6", "#0ea5b7"];
function colorOf(staffId, staffList) {
  const idx = staffList.findIndex((s) => s.id === staffId);
  return FORTUNE_COLORS[idx < 0 ? 0 : idx % FORTUNE_COLORS.length];
}

// ---- 占いタイムボード用（マッサージ側のタイムボードとは完全に別実装・移動ロジックなし） ----
const FTB_HOUR_START = 11;
const FTB_HOUR_END = 24; // 表示ラベルは 11〜23
const FTB_HOUR_W = 70;
const FTB_MIN_W = FTB_HOUR_W / 60;
const FTB_STAFF_COL_W = 88;

function toMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function ftbComputeOffDuty(ranges, dayStart, dayEnd) {
  if (!ranges.length) return [];
  const sorted = [...ranges]
    .map((r) => ({ start: Math.max(r.start, dayStart), end: Math.min(r.end, dayEnd) }))
    .filter((r) => r.start < r.end)
    .sort((a, b) => a.start - b.start);
  if (!sorted.length) return [{ start: dayStart, end: dayEnd }];
  const segments = [];
  let cursor = dayStart;
  for (const r of sorted) {
    if (r.start > cursor) segments.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  // 杉の泉はシフト終了後も灰色にする（マッサージ側の「残業対応」とは別運用）
  if (cursor < dayEnd) segments.push({ start: cursor, end: dayEnd });
  return segments;
}

export default function Fortune() {
  const [staffList, setStaffList] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [shiftForm, setShiftForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState(todayStr());
  const [reservations, setReservations] = useState([]);
  const [resForm, setResForm] = useState(null);
  const [loadingRes, setLoadingRes] = useState(false);
  const [weekCounts, setWeekCounts] = useState({}); // date -> 件数（今日から14日分）

  const loadWeekCounts = async () => {
    const today = todayStr();
    const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));
    const results = await Promise.all(dates.map((d) => api.fortuneReservations(d)));
    const map = {};
    dates.forEach((d, i) => {
      map[d] = results[i].length;
    });
    setWeekCounts(map);
  };

  useEffect(() => {
    loadWeekCounts();
  }, []);

  const loadStaffAndShifts = async () => {
    const [sf, sh] = await Promise.all([api.fortuneStaff(), api.fortuneShifts()]);
    setStaffList(sf);
    setShifts(sh);
  };

  useEffect(() => {
    loadStaffAndShifts();
  }, []);

  const loadReservations = async () => {
    setLoadingRes(true);
    try {
      setReservations(await api.fortuneReservations(date));
    } finally {
      setLoadingRes(false);
    }
  };

  useEffect(() => {
    loadReservations();
    // eslint-disable-next-line
  }, [date]);

  // ---- 受付一覧表（紙の受付表に相当）----
  // タイムボードと同じ reservations（fortuneReservations）を直接読み書きすることで、
  // タイムボード⇔受付一覧表のどちらを編集しても双方に反映されるようにする。
  const updateReservationField = async (r, patch) => {
    const base = r || emptyReservation(date);
    const payload = { ...base, ...patch };
    if (r) {
      setReservations((prev) => prev.map((x) => (x.id === r.id ? payload : x)));
    }
    try {
      const saved = await api.saveFortuneReservation(payload);
      setReservations((prev) => {
        const exists = prev.some((x) => x.id === saved.id);
        return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
      });
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
      loadReservations();
    }
  };

  const REC_PAGE_SIZE = 20;
  const [recYY, recMM, recDD] = date.split("-").map(Number);
  const recYoubi = WEEK_LABEL[new Date(recYY, recMM - 1, recDD).getDay()];

  const staffName = (id) => staffList.find((s) => s.id === id)?.name || "?";

  const shiftsByDate = useMemo(() => {
    const map = {};
    for (const s of shifts) (map[s.date] ||= []).push(s);
    for (const k in map) {
      map[k].sort((a, b) => a.start.localeCompare(b.start));
    }
    return map;
  }, [shifts]);

  const monthDays = useMemo(() => buildMonthGrid(month), [month]);

  const shiftMonth = (delta) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const saveShift = async () => {
    if (!shiftForm.staffId) return alert("スタッフを選択してください");
    setBusy(true);
    try {
      await api.saveFortuneShift(shiftForm);
      await loadStaffAndShifts();
      setShiftForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delShift = async (id) => {
    if (!confirm("このシフトを削除しますか？")) return;
    setBusy(true);
    try {
      await api.deleteFortuneShift(id);
      await loadStaffAndShifts();
      setShiftForm(null);
    } finally {
      setBusy(false);
    }
  };

  const view = useMemo(
    () =>
      [...reservations].sort((a, b) => {
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      }),
    [reservations],
  );

  // ---- 占いタイムボード（当日分）----
  const todaysShifts = useMemo(() => shifts.filter((s) => s.date === date), [shifts, date]);
  const staffIdsToday = useMemo(() => {
    const earliest = {};
    for (const s of todaysShifts) {
      const m = toMin(s.start);
      if (earliest[s.staffId] === undefined || m < earliest[s.staffId]) earliest[s.staffId] = m;
    }
    for (const r of view) {
      if (!r.staffId || !r.startTime) continue;
      const m = toMin(r.startTime);
      if (earliest[r.staffId] === undefined || m < earliest[r.staffId]) earliest[r.staffId] = m;
    }
    return Object.entries(earliest)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
  }, [todaysShifts, view]);

  const ftbHours = [];
  for (let h = FTB_HOUR_START; h < FTB_HOUR_END; h++) ftbHours.push(h);
  const ftbTotalMin = (FTB_HOUR_END - FTB_HOUR_START) * 60;
  const ftbLaneW = ftbTotalMin * FTB_MIN_W;
  const ftbGridMarks = [];
  for (let m = 0; m <= ftbTotalMin; m += 10) {
    ftbGridMarks.push({ pos: m * FTB_MIN_W, major: m % 60 === 0 });
  }
  const ftbBlockStyle = (startMin, minutes, color) => ({
    left: (startMin - FTB_HOUR_START * 60) * FTB_MIN_W,
    width: Math.max(minutes * FTB_MIN_W - 2, 10),
    background: color,
  });
  const ftbFillStyle = (startMin, endMin) => ({
    left: (startMin - FTB_HOUR_START * 60) * FTB_MIN_W,
    width: Math.max((endMin - startMin) * FTB_MIN_W, 0),
  });

  const saveReservation = async () => {
    if (!resForm.customerName.trim()) return alert("お客様名を入力してください");
    setBusy(true);
    try {
      await api.saveFortuneReservation(resForm);
      await loadReservations();
      await loadWeekCounts();
      setResForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delReservation = async (id) => {
    if (!confirm("この予約を削除しますか？")) return;
    await api.deleteFortuneReservation(id, date);
    await loadReservations();
    await loadWeekCounts();
  };

  return (
    <div>
      <div className="page-head">
        <h2>杉の泉</h2>
      </div>

      {/* ---- 本日のタイムボード（占い専用・移動ロジックなし） ---- */}
      <div className="card">
        <strong>タイムボード</strong>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn sm" onClick={() => setResForm(emptyReservation(date))}>
            ＋ 予約追加
          </button>
        </div>

        {staffIdsToday.length === 0 ? (
          <div className="empty">本日出勤予定のスタッフがいません（下のシフト表で登録してください）</div>
        ) : (
          <div className="tb-scroll">
            <div className="tb" style={{ minWidth: FTB_STAFF_COL_W + ftbLaneW }}>
              <div className="tb-hours">
                <div className="tb-bedcol" style={{ width: FTB_STAFF_COL_W, height: 33 }} />
                {ftbHours.map((h) => (
                  <div className="tb-hour" key={h} style={{ width: FTB_HOUR_W }}>
                    {h}
                  </div>
                ))}
              </div>

              {staffIdsToday.map((staffId) => {
                const ranges = todaysShifts
                  .filter((s) => s.staffId === staffId)
                  .map((s) => ({ start: toMin(s.start), end: toMin(s.end) }));
                const offDuty = ftbComputeOffDuty(
                  ranges,
                  FTB_HOUR_START * 60,
                  FTB_HOUR_END * 60,
                );
                const apps = view.filter((r) => r.staffId === staffId && r.startTime);
                return (
                  <div className="tb-row" key={staffId}>
                    <div className="tb-bed" style={{ width: FTB_STAFF_COL_W }}>
                      <span className="b-name">{staffName(staffId)}</span>
                    </div>
                    <div className="tb-lane" style={{ width: ftbLaneW }}>
                      {offDuty.map((o, i) => (
                        <div
                          className="tb-offduty"
                          key={`o${i}`}
                          style={ftbFillStyle(o.start, o.end)}
                        />
                      ))}
                      {ftbGridMarks.map((g, i) => (
                        <div
                          className={g.major ? "tb-gridline" : "tb-gridline-minor"}
                          key={i}
                          style={{ left: g.pos }}
                        />
                      ))}
                      {apps.map((r) => {
                        const start = toMin(r.startTime);
                        return (
                          <div
                            className="tb-block"
                            key={r.id}
                            style={ftbBlockStyle(
                              start,
                              r.minutes || 30,
                              colorOf(staffId, staffList),
                            )}
                            onClick={() => setResForm({ ...r })}
                          >
                            <div className="bl-course">{r.minutes}分</div>
                            <div className="bl-name">{r.customerName}様</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ---- 受付一覧表（マッサージ側の受付一覧表と同じ紙の様式・タイムボードと同じデータを共有） ---- */}
      <div className="toolbar" style={{ marginTop: 0 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>
          セルをクリックしてそのまま編集（チェックはスタッフの確認用です）。タイムボードと同じデータなので、どちらを編集しても両方に反映されます。
        </span>
        <button className="btn sm ghost" onClick={() => window.print()}>
          🖨️ 印刷
        </button>
      </div>
      <style>{"@page { size: A4 landscape; margin: 8mm; }"}</style>

      {loadingRes ? (
        <div className="empty">読み込み中…</div>
      ) : (
        renderFortuneRecPages(view, "杉の泉　受付表")
      )}

      {/* ---- 予約管理 ---- */}
      <div className="card">
        <strong>予約管理</strong>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn sm" onClick={() => setResForm(emptyReservation(date))}>
            ＋ 予約追加
          </button>
        </div>

        <div className="week-count-row">
          {Array.from({ length: 14 }, (_, i) => addDays(todayStr(), i)).map((d) => {
            const dd = new Date(d);
            const label = `${dd.getMonth() + 1}/${dd.getDate()}(${WEEK_LABEL[dd.getDay()]})`;
            return (
              <button
                key={d}
                className={`week-count-badge ${d === date ? "active" : ""}`}
                onClick={() => setDate(d)}
              >
                <span>{label}</span>
                <strong>{weekCounts[d] ?? 0}件</strong>
              </button>
            );
          })}
        </div>

        {loadingRes ? (
          <div className="empty">読み込み中…</div>
        ) : view.length === 0 ? (
          <div className="empty">この日の予約はありません</div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>時間</th>
                  <th>お客様名</th>
                  <th>電話番号</th>
                  <th className="num">分</th>
                  <th className="num">料金</th>
                  <th>担当</th>
                  <th>メモ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr key={r.id}>
                    <td>{r.startTime}</td>
                    <td>{r.customerName}</td>
                    <td>{r.phone}</td>
                    <td className="num">{r.minutes}</td>
                    <td className="num">{Number(r.price || 0).toLocaleString("ja-JP")}</td>
                    <td>{staffName(r.staffId)}</td>
                    <td>{r.memo}</td>
                    <td>
                      <button className="btn sm ghost" onClick={() => setResForm({ ...r })}>
                        編集
                      </button>{" "}
                      <button className="btn sm danger" onClick={() => delReservation(r.id)}>
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- シフト表（カレンダー形式） ---- */}
      <div className="card">
        <strong>シフト表</strong>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <button className="btn sm ghost" onClick={() => shiftMonth(-1)}>
            ◀
          </button>
          <strong>{month}</strong>
          <button className="btn sm ghost" onClick={() => shiftMonth(1)}>
            ▶
          </button>
          <button
            className="btn sm"
            onClick={() => setShiftForm(emptyShift(todayStr(), staffList[0]?.id))}
          >
            ＋ シフト追加
          </button>
        </div>

        {staffList.length === 0 && (
          <div className="empty">占いスタッフが登録されていません（設定タブで登録してください）</div>
        )}

        <div className="shift-cal-head">
          {WEEK_LABEL.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="shift-cal-grid">
          {monthDays.map((d) => {
            const list = shiftsByDate[d.dateStr] || [];
            return (
              <div
                key={d.dateStr}
                className={`shift-cal-cell ${d.inMonth ? "" : "out"} ${
                  d.dateStr === date ? "today" : ""
                }`}
                onClick={() => setDate(d.dateStr)}
              >
                <div className="cal-date">{d.day}</div>
                {list.slice(0, 4).map((s) => (
                  <div
                    key={s.id}
                    className="cal-shift"
                    style={{ color: colorOf(s.staffId, staffList) }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShiftForm({ ...s });
                    }}
                  >
                    {staffName(s.staffId)}
                    {s.start.slice(0, 2)}-{s.end.slice(0, 2)}
                  </div>
                ))}
                {list.length > 4 && <div className="cal-more">+{list.length - 4}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {shiftForm && (
        <div className="modal-overlay" onClick={overlayClose(() => setShiftForm(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{shiftForm.id ? "シフトを編集" : "シフトを追加"}</h3>
            <div className="field">
              <label>スタッフ</label>
              <select
                value={shiftForm.staffId}
                onChange={(e) => setShiftForm({ ...shiftForm, staffId: e.target.value })}
              >
                <option value="">選択してください</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>日付</label>
              <input
                type="date"
                value={shiftForm.date}
                onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
              />
            </div>
            <div className="row">
              <div className="field">
                <label>開始</label>
                <TimeInput10
                  value={shiftForm.start}
                  onChange={(v) => setShiftForm({ ...shiftForm, start: v })}
                />
              </div>
              <div className="field">
                <label>終了</label>
                <TimeInput10
                  value={shiftForm.end}
                  onChange={(v) => setShiftForm({ ...shiftForm, end: v })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setShiftForm(null)}>
                キャンセル
              </button>
              {shiftForm.id && (
                <button className="btn danger" onClick={() => delShift(shiftForm.id)} disabled={busy}>
                  削除
                </button>
              )}
              <button className="btn" onClick={saveShift} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {resForm && (
        <div className="modal-overlay" onClick={overlayClose(() => setResForm(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{resForm.id ? "予約を編集" : "予約を追加"}</h3>
            <div className="row">
              <div className="field">
                <label>施術日</label>
                <input
                  type="date"
                  value={resForm.date}
                  onChange={(e) => setResForm({ ...resForm, date: e.target.value })}
                />
              </div>
              <div className="field">
                <label>開始時間</label>
                <TimeInput10
                  value={resForm.startTime}
                  onChange={(v) => setResForm({ ...resForm, startTime: v })}
                />
              </div>
            </div>
            <div className="field">
              <label>お客様名</label>
              <input
                value={resForm.customerName}
                onChange={(e) => setResForm({ ...resForm, customerName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>電話番号</label>
              <input
                value={resForm.phone}
                onChange={(e) => setResForm({ ...resForm, phone: e.target.value })}
              />
            </div>
            <div className="row">
              <div className="field">
                <label>分</label>
                <input
                  type="number"
                  value={resForm.minutes}
                  onChange={(e) => setResForm({ ...resForm, minutes: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="field">
                <label>料金</label>
                <input
                  type="number"
                  value={resForm.price}
                  onChange={(e) => setResForm({ ...resForm, price: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="field">
              <label>担当（占い師）</label>
              <select
                value={resForm.staffId}
                onChange={(e) => setResForm({ ...resForm, staffId: e.target.value })}
              >
                <option value="">未定</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <div className="field">
                <label>性別</label>
                <div style={{ display: "flex", gap: 10, alignItems: "center", height: 34 }}>
                  {["男性", "女性", "ペア"].map((tag) => (
                    <label
                      key={tag}
                      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
                    >
                      <input
                        type="checkbox"
                        checked={(resForm.gender || []).includes(tag)}
                        onChange={() =>
                          setResForm({
                            ...resForm,
                            gender: toggleGenderTag(resForm.gender, tag),
                          })
                        }
                      />
                      {tag}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>支払方法</label>
                <select
                  value={resForm.payment || "現金"}
                  onChange={(e) => setResForm({ ...resForm, payment: e.target.value })}
                >
                  <option value="現金">現金</option>
                  <option value="部屋付け">部屋付け</option>
                  <option value="QR">QR</option>
                </select>
              </div>
              <div className="field">
                <label>部屋番号</label>
                <input
                  value={resForm.room || ""}
                  placeholder="例：705"
                  onChange={(e) => setResForm({ ...resForm, room: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>メモ</label>
              <input
                value={resForm.memo}
                onChange={(e) => setResForm({ ...resForm, memo: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setResForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveReservation} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderFortuneRecPages(groupRecords, groupLabel) {
    const pageCount = Math.max(1, Math.ceil(groupRecords.length / REC_PAGE_SIZE));

    return Array.from({ length: pageCount }, (_, pageIndex) => {
      const startNo = pageIndex * REC_PAGE_SIZE;
      const slice = groupRecords.slice(startNo, startNo + REC_PAGE_SIZE);
      const isLastPage = pageIndex === pageCount - 1;
      const rowCount = isLastPage
        ? Math.max(REC_PAGE_SIZE, slice.length + 3)
        : REC_PAGE_SIZE;
      const cashList = groupRecords.filter((r) => r.payment === "現金");
      const roomList = groupRecords.filter((r) => r.payment === "部屋付け");
      const qrList = groupRecords.filter((r) => r.payment === "QR");
      const sumOf = (list) => list.reduce((s, r) => s + Number(r.price || 0), 0);
      const num = (n) => Number(n || 0).toLocaleString("ja-JP");

      return (
        <div className="sheet-scroll reception-sheet" key={`fortune-${pageIndex}`}>
          <div className="sheet">
            <div className="sheet-head">
              <span className="sheet-title">{groupLabel}</span>
              <span>
                令和 {recYY - 2018} 年 {recMM} 月 {recDD} 日（{recYoubi}）　NO.{" "}
                {pageIndex + 1}
              </span>
            </div>

            <table className="sheet-table">
              <thead>
                <tr>
                  <th>チェック</th>
                  <th>日付</th>
                  <th>NO</th>
                  <th>氏名</th>
                  <th>性別</th>
                  <th>コース</th>
                  <th>担当</th>
                  <th>開始時間</th>
                  <th>支払方法</th>
                  <th>部屋番号</th>
                  <th>金額</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }, (_, i) => {
                  const r = slice[i];
                  const displayNo = startNo + i + 1;
                  const rowKey = r ? r.id : `empty-fortune-${pageIndex}-${i}`;
                  return (
                    <tr key={rowKey}>
                      <td className="c-center">
                        <input
                          type="checkbox"
                          checked={!!r?.checked}
                          disabled={!r}
                          onChange={(e) => updateReservationField(r, { checked: e.target.checked })}
                        />
                      </td>
                      <td className="c-center">
                        {i === 0 ? `${recMM}/${recDD}` : ""}
                      </td>
                      <td className="c-center c-no">{displayNo}</td>
                      <td className="c-name">
                        <div className="cell">
                          <input
                            className="cell-input"
                            key={`${rowKey}-name`}
                            defaultValue={r?.customerName || ""}
                            onBlur={(e) =>
                              updateReservationField(r, { customerName: e.target.value })
                            }
                          />
                          <span className="printed">様</span>
                        </div>
                      </td>
                      <td className="c-center printed">
                        {["男性", "女性", "ペア"].map((tag, idx) => (
                          <span key={tag}>
                            {idx > 0 && "・"}
                            <span
                              className={
                                (r?.gender || []).includes(tag)
                                  ? "circled clickable"
                                  : "clickable"
                              }
                              onClick={() =>
                                updateReservationField(r, {
                                  gender: toggleGenderTag(r?.gender, tag),
                                })
                              }
                            >
                              {tag}
                            </span>
                          </span>
                        ))}
                      </td>
                      <td className="c-center">
                        <select
                          className="cell-select"
                          value={r?.minutes || 20}
                          onChange={(e) =>
                            updateReservationField(r, { minutes: Number(e.target.value) })
                          }
                        >
                          {[20, 30, 40, 50, 60].map((m) => (
                            <option key={m} value={m}>
                              {m}分
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="c-center">
                        <select
                          className="cell-select"
                          value={r?.staffId || ""}
                          onChange={(e) => updateReservationField(r, { staffId: e.target.value })}
                        >
                          <option value="">-</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="c-center">
                        <TimeInput10
                          value={r?.startTime || ""}
                          onChange={(v) => updateReservationField(r, { startTime: v })}
                        />
                      </td>
                      <td className="c-center printed">
                        <span
                          className={r?.payment === "現金" ? "circled clickable" : "clickable"}
                          onClick={() => updateReservationField(r, { payment: "現金" })}
                        >
                          現
                        </span>
                        ・
                        <span
                          className={
                            r?.payment === "部屋付け" ? "circled clickable" : "clickable"
                          }
                          onClick={() => updateReservationField(r, { payment: "部屋付け" })}
                        >
                          部
                        </span>
                        ・
                        <span
                          className={r?.payment === "QR" ? "circled clickable" : "clickable"}
                          onClick={() => updateReservationField(r, { payment: "QR" })}
                        >
                          Q
                        </span>
                      </td>
                      <td className="c-center">
                        <input
                          className="cell-input c-narrow"
                          key={`${rowKey}-room`}
                          defaultValue={r?.room || ""}
                          placeholder="例：705"
                          onBlur={(e) => updateReservationField(r, { room: e.target.value })}
                        />
                      </td>
                      <td className="c-amount">
                        <input
                          className="cell-input"
                          style={{ textAlign: "right" }}
                          key={`${rowKey}-amount`}
                          inputMode="numeric"
                          defaultValue={r?.price ?? ""}
                          placeholder="0"
                          onBlur={(e) =>
                            updateReservationField(r, {
                              price: e.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                        />
                      </td>
                      <td className="no-print">
                        {r && (
                          <button
                            className="btn sm danger"
                            onClick={() => delReservation(r.id)}
                          >
                            削除
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
                    <span>QR</span>
                    <span>{qrList.length} 件</span>
                    <span>{num(sumOf(qrList))} 円</span>
                  </div>
                  <div>
                    <span>合計</span>
                    <span>{groupRecords.length} 件</span>
                    <span>{num(sumOf(groupRecords))} 円</span>
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
