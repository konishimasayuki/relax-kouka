import { redis } from "./_redis.js";

const KEY = "receptionHistory:all";
const MAX_ENTRIES = 1000; // 全体で保持する履歴の上限

// 受付の新規登録・変更・削除を、日付をまたいだ1本の履歴リストに追記する（ベストエフォート）
export async function logReceptionHistory(date, entry) {
  try {
    const record = { time: new Date().toISOString(), date, ...entry };
    await redis.rpush(KEY, JSON.stringify(record));
    await redis.ltrim(KEY, -MAX_ENTRIES, -1);
  } catch (e) {
    console.error("受付履歴の記録に失敗", e);
  }
}
