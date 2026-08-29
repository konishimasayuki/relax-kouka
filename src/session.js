// ログアウトされるまでセッションを保持する。
// dev-environment のルール（アプリデータに localStorage を使わない）に従い、
// セッション保持には Cookie を使う（Redisで管理するほどの機密情報ではないため）。

const COOKIE_NAME = "relax_session";
const MAX_AGE_SEC = 400 * 24 * 60 * 60; // ブラウザの上限(400日)いっぱいまで＝実質恒久保持

export function saveSession(session) {
  const value = encodeURIComponent(JSON.stringify(session));
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${MAX_AGE_SEC}; path=/; SameSite=Lax`;
}

export function loadSession() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export function clearSession() {
  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/`;
}
