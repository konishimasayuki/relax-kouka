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

  menus: () => req("menus"),
  saveMenu: (m) => req("menus", { method: "POST", body: JSON.stringify(m) }),
  deleteMenu: (id) => req(`menus?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  payrollRates: () => req("payrollRates"),
  savePayrollRate: (r) => req("payrollRates", { method: "POST", body: JSON.stringify(r) }),
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

export function courseLabel(course) {
  if (!course) return "";
  if (course.freeText?.trim()) return course.freeText.trim();
  const parts = (course.parts || [])
    .map((p) => COURSE_PARTS.find((x) => x.key === p)?.label)
    .filter(Boolean)
    .join("");
  const base = `${course.name || ""}${course.minutes || ""}`;
  return parts ? `${base}(${parts})` : base;
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

export function yen(n) {
  return `¥${Number(n || 0).toLocaleString("ja-JP")}`;
}

// 施術者ごとの色（タイムボード用）
const STAFF_COLORS = [
  "#1f6feb",
  "#e5484d",
  "#2fa84f",
  "#d99a00",
  "#8b5cf6",
  "#0ea5b7",
  "#e0699f",
  "#5b6b7b",
];

export function staffColor(staffId, staffList) {
  const idx = staffList.findIndex((s) => s.id === staffId);
  if (idx < 0) return "#5b6b7b";
  return STAFF_COLORS[idx % STAFF_COLORS.length];
}
