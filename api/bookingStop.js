import { redis } from "./_redis.js";

const KEY = "booking:stop";

// キーごとに「停止した日付」だけを保持する。その日付が今日でなければ
// （日付が変わっていれば）自動的に「停止していない」扱いになる仕組み。
// 例: { "store-xxxx": "2026-10-20", fortune: "2026-10-20" }
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const data = (await redis.get(KEY)) || {};
      return res.json(data);
    }
    if (req.method === "POST") {
      const { key, date } = req.body || {};
      if (!key) return res.status(400).json({ error: "key が必要です" });
      const data = (await redis.get(KEY)) || {};
      if (date) {
        data[key] = date;
      } else {
        delete data[key];
      }
      await redis.set(KEY, data);
      return res.json(data);
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
