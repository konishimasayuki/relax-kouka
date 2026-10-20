import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api, staffColor, todayStr } from "../api.js";
import TimeInput10 from "../components/TimeInput10.jsx";
import { overlayClose } from "../modalUtils.js";

const HOUR_START = 11;
const HOUR_END = 24; // 表示ラベルは 11〜23
const HOUR_W = 60;
const MIN_W = HOUR_W / 60;
const NOTE_W = 200;
const WEEK_LABEL = ["月", "火", "水", "木", "金", "土", "日"];

// JSの Date#getDay()（0=日〜6=土）を、月曜始まりのインデックス（0=月〜6=日）に変換する
function mondayFirstIndex(jsWeekday) {
  return (jsWeekday + 6) % 7;
}

// "YYYY-MM-DD" 文字列から曜日ラベル（月〜日）を返す
function weekdayLabelOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEK_LABEL[mondayFirstIndex(new Date(y, m - 1, d).getDay())];
}

function toMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 指定日を含む週（月曜始まり）の7日分を返す
function buildWeekGrid(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const monday = new Date(y, m - 1, d - mondayFirstIndex(base.getDay()));
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    cells.push({ day: dd.getDate(), dateStr: fmt(dd) });
  }
  return cells;
}

function buildMonthGrid(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startWeekday = mondayFirstIndex(first.getDay());
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

// "YYYY-MM-DD" 文字列から±N日した日付文字列を返す
function shiftDateStr(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + delta);
  return fmt(next);
}

function emptyShift(date) {
  return { id: "", staffId: "", date, start: "11:00", end: "23:00", note: "" };
}

// 指定の月の日数を返す
function daysInMonthOf(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// 指定の月・日の曜日インデックスを返す（0=月〜6=日。WEEK_LABELと対応）
function weekdayOf(monthStr, day) {
  const [y, m] = monthStr.split("-").map(Number);
  return mondayFirstIndex(new Date(y, m - 1, day).getDay());
}

function emptyMonthForm(monthStr) {
  const days = daysInMonthOf(monthStr);
  const checked = {};
  for (let d = 1; d <= days; d++) checked[d] = true;
  return { staffId: "", month: monthStr, start: "11:00", end: "23:00", checked };
}

export default function Shift() {
  const { staff } = useApp();
  const [date, setDate] = useState(todayStr());
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(() => date.slice(0, 7));
  const [form, setForm] = useState(null);
  const [monthForm, setMonthForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setShifts(await api.shifts());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const staffName = (id) => staff.find((s) => s.id === id)?.name || "?";

  const todays = useMemo(
    () => shifts.filter((s) => s.date === date).sort((a, b) => toMin(a.start) - toMin(b.start)),
    [shifts, date],
  );

  const shiftsByDate = useMemo(() => {
    const map = {};
    for (const s of shifts) (map[s.date] ||= []).push(s);
    for (const k in map) map[k].sort((a, b) => toMin(a.start) - toMin(b.start));
    return map;
  }, [shifts]);

  const weekDays = useMemo(() => buildWeekGrid(date), [date]);
  const monthDays = useMemo(() => buildMonthGrid(month), [month]);

  const shiftMonth = (delta) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const save = async () => {
    if (!form.staffId) return alert("スタッフを選択してください");
    setBusy(true);
    try {
      await api.saveShift(form);
      await load();
      setForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // 1ヶ月まとめて入力：チェックが入っている日だけ、同じ開始・終了時刻でシフトを一括登録する
  const saveMonthShifts = async () => {
    if (!monthForm.staffId) return alert("スタッフを選択してください");
    const days = Object.entries(monthForm.checked)
      .filter(([, v]) => v)
      .map(([d]) => Number(d));
    if (days.length === 0) return alert("日付を1つ以上選択してください");
    setBusy(true);
    try {
      await Promise.all(
        days.map((d) =>
          api.saveShift({
            id: "",
            staffId: monthForm.staffId,
            date: `${monthForm.month}-${String(d).padStart(2, "0")}`,
            start: monthForm.start,
            end: monthForm.end,
            note: "",
          }),
        ),
      );
      await load();
      setMonthForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleAllMonthDays = (value) => {
    const next = {};
    for (const d in monthForm.checked) next[d] = value;
    setMonthForm({ ...monthForm, checked: next });
  };

  const del = async (id) => {
    if (!confirm("このシフトを削除しますか？")) return;
    setBusy(true);
    try {
      await api.deleteShift(id);
      await load();
      setForm(null);
    } finally {
      setBusy(false);
    }
  };

  const hours = [];
  for (let h = HOUR_START; h < HOUR_END; h++) hours.push(h);
  const totalMin = (HOUR_END - HOUR_START) * 60;
  const laneW = totalMin * MIN_W;
  const BED_W = 84;

  // グリッド線（10分刻み）を0〜終端まで一括生成し、最後の境界線も必ず引く
  const gridMarks = [];
  for (let m = 0; m <= totalMin; m += 10) {
    gridMarks.push({ pos: m * MIN_W, major: m % 60 === 0 });
  }

  const blockStyle = (startMin, endMin, color) => ({
    left: (startMin - HOUR_START * 60) * MIN_W,
    width: Math.max((endMin - startMin) * MIN_W - 2, 10),
    background: color,
  });

  return (
    <>
    <div className="shift-page">
      <div className="page-head">
        <h2>シフト</h2>
      </div>

      {/* ---- 本日のシフト ---- */}
      <div className="card">
        <div className="toolbar">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
            （{weekdayLabelOf(date)}）
          </span>
          <button
            className={date === shiftDateStr(todayStr(), -1) ? "btn sm" : "btn sm ghost"}
            onClick={() => setDate(shiftDateStr(todayStr(), -1))}
          >
            昨日
          </button>
          <button
            className={date === todayStr() ? "btn sm" : "btn sm ghost"}
            onClick={() => setDate(todayStr())}
          >
            今日
          </button>
          <button
            className={date === shiftDateStr(todayStr(), 1) ? "btn sm" : "btn sm ghost"}
            onClick={() => setDate(shiftDateStr(todayStr(), 1))}
          >
            明日
          </button>
          <button className="btn sm" onClick={() => setForm(emptyShift(date))}>
            ＋ シフト追加（単日）
          </button>
          <button className="btn sm ghost" onClick={() => setMonthForm(emptyMonthForm(month))}>
            ＋ シフト追加（1ヶ月）
          </button>
        </div>

        {loading ? (
          <div className="empty">読み込み中…</div>
        ) : todays.length === 0 ? (
          <div className="empty">本日のシフト登録がありません</div>
        ) : (
          <div className="tb-scroll">
            <div className="tb" style={{ minWidth: BED_W + laneW + NOTE_W }}>
              <div className="tb-hours">
                <div className="tb-bedcol" style={{ width: BED_W, height: 33 }} />
                {hours.map((h) => (
                  <div className="tb-hour" key={h} style={{ width: HOUR_W }}>
                    {h}
                  </div>
                ))}
                <div className="tb-hour" style={{ width: NOTE_W }}>
                  メモ
                </div>
              </div>
              {todays.map((s) => (
                <div className="tb-row" key={s.id}>
                  <div className="tb-bed" style={{ width: BED_W }}>
                    <span className="b-name">{staffName(s.staffId)}</span>
                  </div>
                  <div className="tb-lane" style={{ width: laneW }}>
                    {gridMarks.map((g, i) => (
                      <div
                        className={g.major ? "tb-gridline" : "tb-gridline-minor"}
                        key={i}
                        style={{ left: g.pos }}
                      />
                    ))}
                    <div
                      className="tb-block"
                      style={blockStyle(toMin(s.start), toMin(s.end), staffColor(s.staffId, staff))}
                      onClick={() => setForm({ ...s })}
                    >
                      <div className="bl-course">
                        {s.start}-{s.end}
                      </div>
                    </div>
                  </div>
                  <div className="tb-note" style={{ width: NOTE_W }}>
                    {s.note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- 週間シフト ---- */}
      <div className="card">
        <div className="toolbar cal-toolbar">
          <button className="btn sm ghost" onClick={() => setDate(shiftDateStr(date, -7))}>
            ◀
          </button>
          <strong>
            {weekDays[0].dateStr} 〜 {weekDays[6].dateStr}
          </strong>
          <button className="btn sm ghost" onClick={() => setDate(shiftDateStr(date, 7))}>
            ▶
          </button>
        </div>
        <div className="shift-cal-head">
          {WEEK_LABEL.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="shift-cal-grid shift-cal-grid-week">
          {weekDays.map((d) => {
            const list = shiftsByDate[d.dateStr] || [];
            return (
              <div
                key={d.dateStr}
                className={`shift-cal-cell ${d.dateStr === date ? "today" : ""}`}
                onClick={() => setDate(d.dateStr)}
              >
                <div className="cal-date">{d.day}</div>
                {list.map((s) => (
                  <div key={s.id} className="cal-shift" style={{ color: staffColor(s.staffId, staff) }}>
                    {staffName(s.staffId)}
                    {s.start.slice(0, 2)}-{s.end.slice(0, 2)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- 月間シフト ---- */}
      <div className="card">
        <div className="toolbar cal-toolbar">
          <button className="btn sm ghost" onClick={() => shiftMonth(-1)}>
            ◀
          </button>
          <strong>{month}</strong>
          <button className="btn sm ghost" onClick={() => shiftMonth(1)}>
            ▶
          </button>
        </div>
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
                  <div key={s.id} className="cal-shift" style={{ color: staffColor(s.staffId, staff) }}>
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
    </div>

      {form && (
        <div className="modal-overlay" onClick={overlayClose(() => setForm(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{form.id ? "シフトを編集" : "シフトを追加"}</h3>
            <div className="field">
              <label>スタッフ</label>
              <select
                value={form.staffId}
                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              >
                <option value="">選択してください</option>
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
              <label>日付</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
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
            <div className="field">
              <label>メモ（研修など）</label>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="例：研修"
              />
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setForm(null)}>
                キャンセル
              </button>
              {form.id && (
                <button className="btn danger" onClick={() => del(form.id)} disabled={busy}>
                  削除
                </button>
              )}
              <button className="btn" onClick={save} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {monthForm && (
        <div className="modal-overlay" onClick={overlayClose(() => setMonthForm(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>シフトを1ヶ月まとめて追加</h3>
            <div className="field">
              <label>スタッフ</label>
              <select
                value={monthForm.staffId}
                onChange={(e) => setMonthForm({ ...monthForm, staffId: e.target.value })}
              >
                <option value="">選択してください</option>
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
              <label>対象の月</label>
              <input
                type="month"
                value={monthForm.month}
                onChange={(e) => setMonthForm(emptyMonthForm(e.target.value))}
              />
            </div>
            <div className="row">
              <div className="field">
                <label>開始</label>
                <TimeInput10
                  value={monthForm.start}
                  onChange={(v) => setMonthForm({ ...monthForm, start: v })}
                />
              </div>
              <div className="field">
                <label>終了</label>
                <TimeInput10
                  value={monthForm.end}
                  onChange={(v) => setMonthForm({ ...monthForm, end: v })}
                />
              </div>
            </div>
            <div className="field">
              <label>対象日（チェックした日だけ登録されます）</label>
              <div className="toolbar" style={{ marginTop: 0, marginBottom: 6 }}>
                <button className="btn sm ghost" onClick={() => toggleAllMonthDays(true)}>
                  全選択
                </button>
                <button className="btn sm ghost" onClick={() => toggleAllMonthDays(false)}>
                  全解除
                </button>
              </div>
              <div className="month-day-cal-head">
                {WEEK_LABEL.map((w, i) => (
                  <div key={w} className={i === 6 ? "sun" : i === 5 ? "sat" : ""}>
                    {w}
                  </div>
                ))}
              </div>
              <div className="month-day-checks">
                {Array.from({ length: weekdayOf(monthForm.month, 1) }).map((_, i) => (
                  <div key={`blank${i}`} className="month-day-blank" />
                ))}
                {Object.keys(monthForm.checked)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((d) => {
                    const w = weekdayOf(monthForm.month, d);
                    const wcls = w === 6 ? "sun" : w === 5 ? "sat" : "";
                    const dateStr = `${monthForm.month}-${String(d).padStart(2, "0")}`;
                    const existing = (shiftsByDate[dateStr] || []).find(
                      (s) => s.staffId === monthForm.staffId,
                    );
                    return (
                      <label key={d} className={`check month-day-check ${wcls}`}>
                        <input
                          type="checkbox"
                          checked={monthForm.checked[d]}
                          onChange={(e) =>
                            setMonthForm({
                              ...monthForm,
                              checked: { ...monthForm.checked, [d]: e.target.checked },
                            })
                          }
                        />
                        <span>
                          {d}
                          {existing && (
                            <span className="month-day-existing">
                              {existing.start}-{existing.end}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setMonthForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveMonthShifts} disabled={busy}>
                まとめて保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
