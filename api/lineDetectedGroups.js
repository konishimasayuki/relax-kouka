import { redis } from "./_redis.js";

const KEY = "line:detectedGroups";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "GET") return res.status(405).end();
    const list = (await redis.get(KEY)) || [];
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
