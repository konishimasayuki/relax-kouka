import { totalMinutes } from "./api.js";

const TRAVEL_MIN = 20;

export function toMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 本店＝移動の起点・終点。isHomeフラグを優先し、未設定ならパレスを含む店舗を使う。
export function homeBuildingOf(stores) {
  const home = stores.find((s) => s.isHome) || stores.find((s) => s.building?.includes("パレス"));
  return home?.building || stores[0]?.building || "";
}

/**
 * あるスタッフの「その日の予約」から、施術中＋移動中（busy）の時間帯一覧を計算する。
 * タイムボードの移動ロジック（滞在単位でまとめて前後20分）と同じアルゴリズム。
 * 返り値: [{start, end}] の配列（分単位、ソート済み、施術・移動を区別せず結合はしない）
 */
export function computeBusyRanges(apps, stores, homeBuilding) {
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

// busyRanges（重なりなしにマージ済みでなくてもOK）から、[rangeStart, rangeEnd] の中にある空き区間を求める
export function computeFreeGaps(busyRanges, rangeStart, rangeEnd) {
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
