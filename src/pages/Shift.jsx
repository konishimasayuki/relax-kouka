import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api, staffColor } from "../api.js";

const HOUR_START = 8;
const HOUR_END = 24;
const HOUR_W = 44;
const MIN_W = HOUR_W / 60;
const WEEK_LABEL = ["日", "月", "火", "水", "木", "金", "土"];

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

function emptyShift(date) {
  return { id: "", staffId: "", date, start: "11:00", end: "23:00", note: "" };
}

export default function Shift() {
  const { staff, date, setDate } = useApp();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(() => date.slice(0, 7));
  const [form, setForm] = useState(null);
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
  const laneW = (HOUR_END - HOUR_START) * HOUR_W;
  const BED_W = 84;

  const blockStyle = (startMin, endMin, color) => ({
    left: (startMin - HOUR_START * 60) * MIN_W,
    width: Math.max((endMin - startMin) * MIN_W - 2, 10),
    background: color,
  });

  return (
    <div>
      <div className="page-head">
        <h2>シフト</h2>
      </div>

      {/* ---- 本日のシフト ---- */}
      <div className="card">
        <div className="toolbar">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn sm" onClick={() => setForm(emptyShift(date))}>
            ＋ シフト追加
          </button>
        </div>

        {loading ? (
          <div className="empty">読み込み中…</div>
        ) : todays.length === 0 ? (
          <div className="empty">本日のシフト登録がありません</div>
        ) : (
          <div className="tb-scroll">
            <div className="tb" style={{ minWidth: BED_W + laneW }}>
              <div className="tb-hours">
                <div className="tb-bedcol" style={{ width: BED_W, height: 33 }} />
                {hours.map((h) => (
                  <div className="tb-hour" key={h} style={{ width: HOUR_W }}>
                    {h}
                  </div>
                ))}
              </div>
              {todays.map((s) => (
                <div className="tb-row" key={s.id}>
                  <div className="tb-bed" style={{ width: BED_W }}>
                    <span className="b-name">{staffName(s.staffId)}</span>
                  </div>
                  <div className="tb-lane" style={{ width: laneW }}>
                    {hours.map((h, i) => (
                      <div className="tb-gridline" key={h} style={{ left: i * HOUR_W }} />
                    ))}
                    <div
                      className="tb-block"
                      style={blockStyle(toMin(s.start), toMin(s.end), staffColor(s.staffId, staff))}
                      onClick={() => setForm({ ...s })}
                    >
                      <div className="bl-course">
                        {s.start}-{s.end}
                      </div>
                      {s.note && <div className="bl-name">{s.note}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- 月間シフト ---- */}
      <div className="card">
        <div className="toolbar">
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

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
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
                <input
                  type="time"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                />
              </div>
              <div className="field">
                <label>終了</label>
                <input
                  type="time"
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                />
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
    </div>
  );
}
