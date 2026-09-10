import { redis } from "./_redis.js";

const KEY = "receptionHistory:all";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "GET") return res.status(405).end();

    const raw = await redis.lrange(KEY, 0, -1);
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
