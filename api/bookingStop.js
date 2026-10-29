import { redis } from "./_redis.js";

const KEY = "booking:stop";
const HISTORY_KEY = "booking:stopHistory";
const HISTORY_MAX = 100;

// キーごとに「停止した日付」だけを保持する。その日付が今日でなければ
// （日付が変わっていれば）自動的に「停止していない」扱いになる仕組み。
// 例: { "store-xxxx": "2026-10-20", fortune: "2026-10-20" }
// 履歴は「誰が・いつ・何を・停止/解除したか」を新しい順に最大100件保持する。
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const data = (await redis.get(KEY)) || {};
      const history = (await redis.get(HISTORY_KEY)) || [];
      return res.json({ ...data, _history: history });
    }
    if (req.method === "POST") {
      const { key, date, actorName, label } = req.body || {};
      if (!key) return res.status(400).json({ error: "key が必要です" });
      const data = (await redis.get(KEY)) || {};
      if (date) {
        data[key] = date;
      } else {
        delete data[key];
      }
      await redis.set(KEY, data);

      const history = (await redis.get(HISTORY_KEY)) || [];
      const entry = {
        key,
        label: label || key,
        action: date ? "stop" : "resume",
        actorName: actorName || "不明",
        at: new Date().toISOString(),
      };
      const updatedHistory = [entry, ...history].slice(0, HISTORY_MAX);
      await redis.set(HISTORY_KEY, updatedHistory);

      return res.json({ ...data, _history: updatedHistory });
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
