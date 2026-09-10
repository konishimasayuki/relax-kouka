import { redis } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "date required" });
    if (req.method !== "GET") return res.status(405).end();

    const key = `receptionHistory:${date}`;
    const raw = await redis.lrange(key, 0, -1);
    const entries = raw
      .map((x) => {
        try {
          return typeof x === "string" ? JSON.parse(x) : x;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse(); // 新しい順

    return res.json(entries);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
