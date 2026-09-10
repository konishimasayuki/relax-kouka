import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { computeBusyRanges, computeFreeGaps, homeBuildingOf, toMin } from "../staffSchedule.js";

const HOUR_START = 11;
const HOUR_END = 23; // 営業終了時刻（空き判定に使用）
const LAST_SLOT_MIN = 22 * 60 + 30; // サイネージに表示する最後の時間枠
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

function isSetCourse(name) {
  return /^(松|竹|梅)/.test(name || "");
}
const SET_COURSE_DESC = "もみほぐし＋ドライヘッドスパ＋フットケア";

function isFreeAt(freeGaps, slotStart, duration) {
  return freeGaps.some((g) => g.start <= slotStart && g.end >= slotStart + duration);
}

export default function SignageCongestion() {
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [recordsByDate, setRecordsByDate] = useState({});
  const [shifts, setShifts] = useState([]);
  const [menus, setMenus] = useState([]);
  const [config, setConfig] = useState({ refreshSec: 20 });
  const [now, setNow] = useState(nowMin());
  const timerRef = useRef(null);

  const dates = [dateStrOf(0), dateStrOf(1)]; // 今日・明日

  const fetchAll = async () => {
    try {
      const [st, sf, recToday, recTomorrow, allShifts, allMenus, cfg] = await Promise.all([
        api.stores(),
        api.staff(),
        api.reception(dates[0]),
        api.reception(dates[1]),
        api.shifts(),
        api.menus().catch(() => []),
        api.signageConfig().catch(() => null),
      ]);
      setStores(st);
      setStaff(sf);
      setRecordsByDate({ [dates[0]]: recToday, [dates[1]]: recTomorrow });
      setShifts(allShifts);
      setMenus(allMenus);
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
  const homeStore =
    stores.find((s) => s.isHome) || stores.find((s) => s.building?.includes("パレス")) || stores[0];
  const menuList = [...menus]
    .filter((m) => m.storeId === homeStore?.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .slice(0, 12);

  // 30分刻みの時間スロット（分単位）。11:00〜23:00まで。
  const slots = [];
  for (let m = HOUR_START * 60; m <= LAST_SLOT_MIN; m += 30) slots.push(m);

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
  function symbolFor(dateStr, slotStart) {
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
      <div className="signage-layout">
        <div className="signage-left">
          <div className="signage-head">
            <div className="signage-time">
              {String(new Date().getHours()).padStart(2, "0")}:
              {String(new Date().getMinutes()).padStart(2, "0")} 現在
            </div>
            <div className="signage-title">ご案内可能状況</div>
          </div>

          <div
            className="signage-table-wrap"
            style={{ gridTemplateRows: `auto repeat(${slots.length}, minmax(0, 1fr))` }}
          >
            <div
              className="signage-row signage-row-head"
              style={{ gridTemplateColumns: `1fr repeat(${dates.length}, 2fr)` }}
            >
              <div className="signage-cell signage-th-time">日時</div>
              {dates.map((d, i) => (
                <div
                  key={d}
                  className={`signage-cell ${i === 0 ? "signage-th-today" : "signage-th-tomorrow"}`}
                >
                  {labelOf(d)}
                </div>
              ))}
            </div>
            {slots.map((slotStart) => {
              const hh = String(Math.floor(slotStart / 60)).padStart(2, "0");
              const mm = String(slotStart % 60).padStart(2, "0");
              return (
                <div
                  className="signage-row"
                  key={slotStart}
                  style={{ gridTemplateColumns: `1fr repeat(${dates.length}, 2fr)` }}
                >
                  <div className="signage-cell signage-td-time">
                    {hh}:{mm}
                  </div>
                  {dates.map((d) => {
                    const sym = symbolFor(d, slotStart);
                    return (
                      <div key={d} className="signage-cell signage-td-cell">
                        {sym.text === "closed" ? (
                          <span className="signage-closed">受付終了</span>
                        ) : sym.text === "-" ? (
                          <span className="signage-dash">－</span>
                        ) : (
                          <span className={`signage-symbol sym-${sym.cls}`}>{sym.text}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="signage-right">
          <div className="signage-menu-panel">
            <div className="signage-menu-deco-line" />
            <div className="signage-menu-eyebrow">MENU</div>
            <div className="signage-menu-heading">
              {homeStore?.name || "本日のメニュー"}
            </div>
            <div className="signage-menu-sub">ごゆっくりとお選びください</div>

            <div
              className="signage-menu-list"
              style={
                menuList.length
                  ? { display: "grid", gridTemplateRows: `repeat(${menuList.length}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {menuList.length === 0 ? (
                <div className="signage-menu-empty">メニュー準備中</div>
              ) : (
                menuList.map((m) => (
                  <div className="signage-menu-item" key={m.id}>
                    <div className="signage-menu-item-main">
                      <span className="signage-menu-item-name">{m.name}</span>
                      <span className="signage-menu-item-dots" />
                      <span className="signage-menu-item-price">
                        ¥{Number(m.price || 0).toLocaleString("ja-JP")}
                      </span>
                    </div>
                    {isSetCourse(m.name) ? (
                      <div className="signage-menu-item-time">{SET_COURSE_DESC}</div>
                    ) : (
                      m.minutes && <div className="signage-menu-item-time">{m.minutes}分</div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="signage-menu-deco-line bottom" />
          </div>
        </div>
      </div>
    </div>
  );
}
