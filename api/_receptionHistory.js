import { redis } from "./_redis.js";

const MAX_ENTRIES = 300; // 1日あたり保持する履歴の上限

// 受付の新規登録・変更・削除を、日付ごとの履歴リストに追記する（ベストエフォート）
export async function logReceptionHistory(date, entry) {
  try {
    const key = `receptionHistory:${date}`;
    const record = { time: new Date().toISOString(), ...entry };
    await redis.rpush(key, JSON.stringify(record));
    await redis.ltrim(key, -MAX_ENTRIES, -1);
  } catch (e) {
    console.error("受付履歴の記録に失敗", e);
  }
}
