import { listAll } from "./_redis.js";

const TRAVEL_MIN = 20;
const HOUR_START = 11;
const HOUR_END = 23;

function toMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function totalMinutes(course) {
  return (
    Number(course?.minutes || 0) +
    Number(course?.optionMinutes || 0) +
    Number(course?.extensionMinutes || 0)
  );
}
function homeBuildingOf(stores) {
  const home = stores.find((s) => s.isHome) || stores.find((s) => s.building?.includes("パレス"));
  return home?.building || stores[0]?.building || "";
}
// タイムボードの移動ロジックと同じアルゴリズム（滞在単位でまとめて前後20分を移動時間として確保）
function computeBusyRanges(apps, stores, homeBuilding) {
  const buildingOf = (storeId) => stores.find((s) => s.id === storeId)?.building || "";
  const busy = [];
  const stays = [];
  for (const r of apps) {
    const bld = buildingOf(r.storeId);
    const last = stays[stays.length - 1];
    if (last && last.building === bld) {
      last.apps.push(r);
    } else {
      stays.push({ building: bld, apps: [r] });
    }
  }
  for (const stay of stays) {
    for (const r of stay.apps) {
      const s = toMin(r.startTime);
      busy.push({ start: s, end: s + (totalMinutes(r.course) || 60) });
    }
    if (homeBuilding && stay.building !== homeBuilding) {
      const first = stay.apps[0];
      const last = stay.apps[stay.apps.length - 1];
      const firstStart = toMin(first.startTime);
      const lastEnd = toMin(last.startTime) + (totalMinutes(last.course) || 60);
      busy.push({ start: firstStart - TRAVEL_MIN, end: firstStart });
      busy.push({ start: lastEnd, end: lastEnd + TRAVEL_MIN });
    }
  }
  return busy.sort((a, b) => a.start - b.start);
}
function computeFreeGaps(busyRanges, rangeStart, rangeEnd) {
  const sorted = [...busyRanges]
    .map((r) => ({ start: Math.max(r.start, rangeStart), end: Math.min(r.end, rangeEnd) }))
    .filter((r) => r.start < r.end)
    .sort((a, b) => a.start - b.start);
  const gaps = [];
  let cursor = rangeStart;
  for (const r of sorted) {
    if (r.start > cursor) gaps.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < rangeEnd) gaps.push({ start: cursor, end: rangeEnd });
  return gaps;
}
function isFreeAt(freeGaps, slotStart, duration) {
  return freeGaps.some((g) => g.start <= slotStart && g.end >= slotStart + duration);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "GET") return res.status(405).end();
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "date required" });
    const duration = Number(req.query.minDuration) || 30;

    const [stores, shifts, records] = await Promise.all([
      listAll("store"),
      listAll("shift"),
      listAll(`rec:${date}`),
    ]);

    const homeBuilding = homeBuildingOf(stores);
    const dateShifts = shifts.filter((s) => s.date === date);
    const staffIds = Array.from(new Set(dateShifts.map((s) => s.staffId)));

    const gapsByStaff = {};
    for (const staffId of staffIds) {
      const staffShifts = dateShifts.filter((s) => s.staffId === staffId);
      const shiftStart = Math.min(...staffShifts.map((s) => toMin(s.start)));
      const shiftEnd = Math.max(...staffShifts.map((s) => toMin(s.end)));
      const rangeStart = Math.max(shiftStart, HOUR_START * 60);
      const rangeEnd = Math.min(shiftEnd, HOUR_END * 60 + 60);
      if (rangeStart >= rangeEnd) {
        gapsByStaff[staffId] = [];
        continue;
      }
      const apps = records
        .filter((r) => r.staffId === staffId && r.startTime)
        .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
      const busy = computeBusyRanges(apps, stores, homeBuilding);
      gapsByStaff[staffId] = computeFreeGaps(busy, rangeStart, rangeEnd);
    }

    // Vercelのサーバーは基本的にUTCで動作するため、getHours()等をそのまま使うと
    // 日本時間との9時間のズレで「今日判定」や「現在時刻」が誤ることがある。
    // ここでは常に日本時間(UTC+9)で明示的に計算する。
    const nowUtcMs = Date.now();
    const jst = new Date(nowUtcMs + 9 * 60 * 60 * 1000);
    const todayStr = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}-${String(jst.getUTCDate()).padStart(2, "0")}`;
    const isToday = date === todayStr;
    const nowMin = jst.getUTCHours() * 60 + jst.getUTCMinutes();

    const slots = [];
    for (let m = HOUR_START * 60; m <= 22 * 60 + 30; m += 30) slots.push(m);

    const result = slots.map((slotStart) => {
      if (isToday && slotStart <= nowMin) return { time: minToHHMM(slotStart), status: "closed" };
      const count = staffIds.filter((id) => isFreeAt(gapsByStaff[id] || [], slotStart, duration)).length;
      return { time: minToHHMM(slotStart), status: count > 0 ? "open" : "full" };
    });

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
