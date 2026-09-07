import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { computeBusyRanges, computeFreeGaps, homeBuildingOf, toMin } from "../staffSchedule.js";

const HOUR_START = 11;
const HOUR_END = 23; // 11時〜23時まで表示
const WEEK_LABEL = ["日", "月", "火", "水", "木", "金", "土"];

function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function dateStrOf(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function labelOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const youbi = WEEK_LABEL[new Date(y, m - 1, d).getDay()];
  return `${m}/${d}（${youbi}）`;
}

// あるスタッフの、その日の空き区間（シフト時間の範囲内）を求める
function staffFreeGapsForDay(staffId, dateRecords, dateShifts, stores, homeBuilding) {
  const staffShifts = dateShifts.filter((s) => s.staffId === staffId);
  if (!staffShifts.length) return [];
  const shiftStart = Math.min(...staffShifts.map((s) => toMin(s.start)));
  const shiftEnd = Math.max(...staffShifts.map((s) => toMin(s.end)));
  const rangeStart = Math.max(shiftStart, HOUR_START * 60);
  const rangeEnd = Math.min(shiftEnd, HOUR_END * 60 + 60);
  if (rangeStart >= rangeEnd) return [];

  const apps = dateRecords
    .filter((r) => r.staffId === staffId && r.startTime)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const busy = computeBusyRanges(apps, stores, homeBuilding);
  return computeFreeGaps(busy, rangeStart, rangeEnd);
}

function isFreeAt(freeGaps, slotStart, duration) {
  return freeGaps.some((g) => g.start <= slotStart && g.end >= slotStart + duration);
}

export default function SignageCongestion() {
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [recordsByDate, setRecordsByDate] = useState({});
  const [shifts, setShifts] = useState([]);
  const [config, setConfig] = useState({ refreshSec: 20 });
  const [now, setNow] = useState(nowMin());
  const timerRef = useRef(null);

  const dates = [dateStrOf(0), dateStrOf(1)]; // 今日・明日

  const fetchAll = async () => {
    try {
      const [st, sf, recToday, recTomorrow, allShifts, cfg] = await Promise.all([
        api.stores(),
        api.staff(),
        api.reception(dates[0]),
        api.reception(dates[1]),
        api.shifts(),
        api.signageConfig().catch(() => null),
      ]);
      setStores(st);
      setStaff(sf);
      setRecordsByDate({ [dates[0]]: recToday, [dates[1]]: recTomorrow });
      setShifts(allShifts);
      if (cfg) setConfig(cfg);
      setNow(nowMin());
    } catch {
      // サイネージは無人運用のため、通信エラーは表示を維持したまま次回更新を待つ
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchAll, (config.refreshSec || 20) * 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [config.refreshSec]);

  const homeBuilding = homeBuildingOf(stores);
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  // 日付ごとに、スタッフごとの空き区間を計算
  const gapsByDate = {};
  for (const dateStr of dates) {
    const dateRecords = recordsByDate[dateStr] || [];
    const dateShifts = shifts.filter((s) => s.date === dateStr);
    const staffIds = Array.from(
      new Set([
        ...dateShifts.map((s) => s.staffId),
        ...dateRecords.filter((r) => r.staffId).map((r) => r.staffId),
      ]),
    );
    const byStaff = {};
    for (const staffId of staffIds) {
      byStaff[staffId] = staffFreeGapsForDay(staffId, dateRecords, dateShifts, stores, homeBuilding);
    }
    gapsByDate[dateStr] = { staffIds, byStaff };
  }

  // 各セル（日付×時間）の記号を判定
  function symbolFor(dateStr, hour) {
    const slotStart = hour * 60;
    const isToday = dateStr === dates[0];
    if (isToday && slotStart <= now) return { text: "closed" };

    const { staffIds, byStaff } = gapsByDate[dateStr] || { staffIds: [], byStaff: {} };
    const count60 = staffIds.filter((id) => isFreeAt(byStaff[id], slotStart, 60)).length;
    if (count60 >= 2) return { text: "◎", cls: "double" };
    if (count60 >= 1) return { text: "○", cls: "single" };
    const count30 = staffIds.filter((id) => isFreeAt(byStaff[id], slotStart, 30)).length;
    if (count30 >= 1) return { text: "△", cls: "triangle" };
    return { text: "-" };
  }

  return (
    <div className="signage-congestion">
      <div className="signage-head">
        <div className="signage-time">
          {String(new Date().getHours()).padStart(2, "0")}:
          {String(new Date().getMinutes()).padStart(2, "0")} 現在
        </div>
        <div className="signage-title">ご案内可能状況</div>
      </div>

      <div className="signage-table-wrap">
        <table className="signage-table">
          <thead>
            <tr>
              <th className="signage-th-time">日時</th>
              {dates.map((d, i) => (
                <th key={d} className={i === 0 ? "signage-th-today" : "signage-th-tomorrow"}>
                  {labelOf(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h}>
                <td className="signage-td-time">{String(h).padStart(2, "0")}:00</td>
                {dates.map((d) => {
                  const sym = symbolFor(d, h);
                  return (
                    <td key={d} className="signage-td-cell">
                      {sym.text === "closed" ? (
                        <span className="signage-closed">受付終了</span>
                      ) : sym.text === "-" ? (
                        <span className="signage-dash">－</span>
                      ) : (
                        <span className={`signage-symbol sym-${sym.cls}`}>{sym.text}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="signage-legend">
        <span>◎ 2名以上ご案内可</span>
        <span>○ 1名ご案内可</span>
        <span>△ 短いコースのみ空きあり</span>
        <span>－ 空きなし</span>
      </div>
    </div>
  );
}
