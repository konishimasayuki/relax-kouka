// API 呼び出しヘルパー
async function req(path, opts = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...opts,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  seed: (date) =>
    req("seed", { method: "POST", body: JSON.stringify({ date: date || todayStr() }) }),
  login: (loginId, password) =>
    req("auth", { method: "POST", body: JSON.stringify({ loginId, password }) }),

  stores: () => req("stores"),
  saveStore: (s) => req("stores", { method: "POST", body: JSON.stringify(s) }),
  deleteStore: (id) => req(`stores?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  staff: () => req("staff"),
  saveStaff: (s) => req("staff", { method: "POST", body: JSON.stringify(s) }),
  deleteStaff: (id) => req(`staff?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  customers: () => req("customers"),
  saveCustomer: (c) => req("customers", { method: "POST", body: JSON.stringify(c) }),
  deleteCustomer: (id) => req(`customers?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  reception: (date) => req(`reception?date=${encodeURIComponent(date)}`),
  saveReception: (r) => req("reception", { method: "POST", body: JSON.stringify(r) }),
  deleteReception: (id, date) =>
    req(`reception?id=${encodeURIComponent(id)}&date=${encodeURIComponent(date)}`, {
      method: "DELETE",
    }),

  receptionMeta: (date) => req(`receptionMeta?date=${encodeURIComponent(date)}`),
  saveReceptionMeta: (m) => req("receptionMeta", { method: "POST", body: JSON.stringify(m) }),

  shifts: () => req("shifts"),
  saveShift: (s) => req("shifts", { method: "POST", body: JSON.stringify(s) }),
  deleteShift: (id) => req(`shifts?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  breaks: () => req("breaks"),
  saveBreak: (b) => req("breaks", { method: "POST", body: JSON.stringify(b) }),
  deleteBreak: (id) => req(`breaks?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  attendance: (date) => req(`attendance?date=${encodeURIComponent(date)}`),
  saveAttendance: (a) => req("attendance", { method: "POST", body: JSON.stringify(a) }),
  deleteAttendance: (id, date) =>
    req(`attendance?id=${encodeURIComponent(id)}&date=${encodeURIComponent(date)}`, {
      method: "DELETE",
    }),

  menus: () => req("menus"),
  saveMenu: (m) => req("menus", { method: "POST", body: JSON.stringify(m) }),
  deleteMenu: (id) => req(`menus?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  options: () => req("options"),
  saveOption: (o) => req("options", { method: "POST", body: JSON.stringify(o) }),
  deleteOption: (id) => req(`options?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  extensions: () => req("extensions"),
  saveExtension: (e) => req("extensions", { method: "POST", body: JSON.stringify(e) }),
  deleteExtension: (id) => req(`extensions?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  coupons: () => req("coupons"),
  saveCoupon: (c) => req("coupons", { method: "POST", body: JSON.stringify(c) }),
  deleteCoupon: (id) => req(`coupons?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  debugThreads: () => req("debugThreads"),
  saveDebugThread: (t) => req("debugThreads", { method: "POST", body: JSON.stringify(t) }),
  deleteDebugThread: (id) => req(`debugThreads?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  debugMessages: (threadId) =>
    req(`debugMessages?threadId=${encodeURIComponent(threadId)}`),
  saveDebugMessage: (m) => req("debugMessages", { method: "POST", body: JSON.stringify(m) }),
  deleteDebugMessage: (id, threadId) =>
    req(
      `debugMessages?id=${encodeURIComponent(id)}&threadId=${encodeURIComponent(threadId)}`,
      { method: "DELETE" },
    ),

  signageConfig: () => req("signageConfig"),
  saveSignageConfig: (c) => req("signageConfig", { method: "POST", body: JSON.stringify(c) }),

  notifyConfig: () => req("notifyConfig"),
  saveNotifyConfig: (c) => req("notifyConfig", { method: "POST", body: JSON.stringify(c) }),
  testNotify: (target) => req("notifyTest", { method: "POST", body: JSON.stringify({ target }) }),
  testEmail: (to) => req("emailTest", { method: "POST", body: JSON.stringify({ to }) }),

  bookingRequests: () => req("bookingRequests"),
  saveBookingRequest: (r) =>
    req("bookingRequests", { method: "POST", body: JSON.stringify(r) }),
  deleteBookingRequest: (id) =>
    req(`bookingRequests?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  commissionRates: () => req("commissionRates"),
  saveCommissionRates: (c) =>
    req("commissionRates", { method: "POST", body: JSON.stringify(c) }),

  payrollRates: () => req("payrollRates"),
  savePayrollRate: (r) => req("payrollRates", { method: "POST", body: JSON.stringify(r) }),

  dailyReportMeta: (date, storeId) =>
    req(`dailyReportMeta?date=${encodeURIComponent(date)}&storeId=${encodeURIComponent(storeId)}`),
  saveDailyReportMeta: (m) => req("dailyReportMeta", { method: "POST", body: JSON.stringify(m) }),

  fortuneStaff: () => req("fortuneStaff"),
  saveFortuneStaff: (s) => req("fortuneStaff", { method: "POST", body: JSON.stringify(s) }),
  deleteFortuneStaff: (id) => req(`fortuneStaff?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  fortuneShifts: () => req("fortuneShifts"),
  saveFortuneShift: (s) => req("fortuneShifts", { method: "POST", body: JSON.stringify(s) }),
  deleteFortuneShift: (id) => req(`fortuneShifts?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  fortuneReservations: (date) =>
    req(`fortuneReservations?date=${encodeURIComponent(date)}`),
  saveFortuneReservation: (r) =>
    req("fortuneReservations", { method: "POST", body: JSON.stringify(r) }),
  deleteFortuneReservation: (id, date) =>
    req(
      `fortuneReservations?id=${encodeURIComponent(id)}&date=${encodeURIComponent(date)}`,
      { method: "DELETE" },
    ),

  materials: () => req("materials"),
  saveMaterial: (m) => req("materials", { method: "POST", body: JSON.stringify(m) }),
  deleteMaterial: (id) => req(`materials?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  materialGenres: () => req("materialGenres"),
  saveMaterialGenre: (g) => req("materialGenres", { method: "POST", body: JSON.stringify(g) }),
  deleteMaterialGenre: (id) =>
    req(`materialGenres?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  stockLogs: () => req("stockLogs"),
  saveStockLog: (l) => req("stockLogs", { method: "POST", body: JSON.stringify(l) }),
  deleteStockLog: (id) => req(`stockLogs?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// ---- コース定義 ----
// 部位: ほ=ほぐし 足=フット ハ=ハンド ヘ=ヘッド F=フェイシャル
export const COURSE_PARTS = [
  { key: "ho", label: "ほ" },
  { key: "foot", label: "足" },
  { key: "hand", label: "ハ" },
  { key: "head", label: "ヘ" },
  { key: "facial", label: "F" },
];

export const PAYMENTS = ["現金", "部屋付け", "クレジット", "QR", "その他"];

// 料金タブで各コースに設定する表示色（タイムボードのブロック色に使用）
export const COURSE_COLORS = [
  { key: "yellow", label: "黄", hex: "#d99a00" },
  { key: "green", label: "緑", hex: "#2fa84f" },
  { key: "red", label: "赤", hex: "#e5484d" },
  { key: "blue", label: "青", hex: "#1f6feb" },
  { key: "purple", label: "紫", hex: "#8b5cf6" },
];

export function courseColorHex(key) {
  return COURSE_COLORS.find((c) => c.key === key)?.hex || null;
}

// コースに紐づくオプションの表示名（未選択なら空文字）
export function optionLabel(course) {
  if (!course?.optionName) return "";
  return course.optionDisplayName?.trim() || course.optionName;
}

// コースに紐づく延長の表示名（未選択なら空文字）
export function extensionLabel(course) {
  if (!course?.extensionName) return "";
  return course.extensionDisplayName?.trim() || course.extensionName;
}

export function courseLabel(course) {
  if (!course) return "";
  let base;
  if (course.freeText?.trim()) {
    base = course.freeText.trim();
  } else {
    const parts = (course.parts || [])
      .map((p) => COURSE_PARTS.find((x) => x.key === p)?.label)
      .filter(Boolean)
      .join("");
    const b = `${course.name || ""}${course.minutes || ""}`;
    base = parts ? `${b}(${parts})` : b;
  }
  const opt = optionLabel(course);
  return opt ? `${base}＋${opt}` : base;
}

// タイムボードのブロックに表示するラベル（表示名優先、オプションがあれば追記）
export function courseBoardLabel(course) {
  if (!course) return "";
  const opt = optionLabel(course);
  if (course.displayName?.trim()) {
    return opt ? `${course.displayName.trim()}＋${opt}` : course.displayName.trim();
  }
  return courseLabel(course); // courseLabel側で既にオプションを含んでいる
}

// タイムボードはコースとオプションを別々の枠に分けて表示するため、
// オプション部分を含まない「コース単体」のラベルが必要
export function courseOnlyBoardLabel(course) {
  if (!course) return "";
  if (course.displayName?.trim()) return course.displayName.trim();
  if (course.freeText?.trim()) return course.freeText.trim();
  const parts = (course.parts || [])
    .map((p) => COURSE_PARTS.find((x) => x.key === p)?.label)
    .filter(Boolean)
    .join("");
  const base = `${course.name || ""}${course.minutes || ""}`;
  return parts ? `${base}(${parts})` : base;
}

// コース＋オプションの合計施術時間（分）
export function totalMinutes(course) {
  return (
    Number(course?.minutes || 0) +
    Number(course?.optionMinutes || 0) +
    Number(course?.extensionMinutes || 0)
  );
}

// ---- 日付ユーティリティ ----
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function thisMonthStr() {
  return todayStr().slice(0, 7);
}

// "YYYY-MM" の日数を返す
export function daysInMonth(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// "YYYY-MM" + 日 → "YYYY-MM-DD"
export function dateOfMonth(monthStr, day) {
  const [y, m] = monthStr.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function yen(n) {
  return `¥${Number(n || 0).toLocaleString("ja-JP")}`;
}

// 施術者ごとの色（タイムボード用）。30色から選んで登録できるようにする。
// スタッフに個別設定(s.color)があればそれを優先し、未設定ならこの並び順で自動割り当てする。
export const STAFF_COLOR_PALETTE = [
  "#1f6feb",
  "#e5484d",
  "#2fa84f",
  "#d99a00",
  "#8b5cf6",
  "#0ea5b7",
  "#e0699f",
  "#5b6b7b",
  "#ff7a45",
  "#16a34a",
  "#0891b2",
  "#7c3aed",
  "#db2777",
  "#ca8a04",
  "#dc2626",
  "#2563eb",
  "#059669",
  "#9333ea",
  "#f59e0b",
  "#0d9488",
  "#be123c",
  "#4f46e5",
  "#65a30d",
  "#c026d3",
  "#ea580c",
  "#0284c7",
  "#a21caf",
  "#15803d",
  "#b91c1c",
  "#6d28d9",
];
const STAFF_COLORS = STAFF_COLOR_PALETTE;

export function staffColor(staffId, staffList) {
  const idx = staffList.findIndex((s) => s.id === staffId);
  if (idx < 0) return "#5b6b7b";
  const s = staffList[idx];
  if (s?.color) return s.color;
  return STAFF_COLORS[idx % STAFF_COLORS.length];
}

// タイムボード・受付一覧表の担当表示用。ニックネーム未設定なら氏名を使う
export function staffDisplayName(s) {
  return s?.nickname?.trim() || s?.name || "";
}

// コース・オプションの並び順。料金タブで設定したorder順を優先し、
// 未設定（既存データ）は元の並び順を保ったまま後ろに回す。
export function sortByOrder(list) {
  return [...list]
    .map((x, i) => ({ ...x, _idx: i }))
    .sort((a, b) => (a.order ?? a._idx) - (b.order ?? b._idx));
}
