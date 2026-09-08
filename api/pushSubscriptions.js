import { redis } from "./_redis.js";

// 購読情報は endpoint をキーにして重複なく保存する
const NS = "push:subs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
      const sub = req.body;
      if (!sub?.endpoint) return res.status(400).json({ error: "endpoint required" });
      const id = Buffer.from(sub.endpoint).toString("base64url").slice(0, 100);
      await redis.set(`${NS}:${id}`, sub);
      const ids = (await redis.get(`${NS}:ids`)) || [];
      if (!ids.includes(id)) {
        ids.push(id);
        await redis.set(`${NS}:ids`, ids);
      }
      return res.json({ ok: true });
    }
    if (req.method === "DELETE") {
      const { endpoint } = req.body || {};
      if (!endpoint) return res.status(400).json({ error: "endpoint required" });
      const id = Buffer.from(endpoint).toString("base64url").slice(0, 100);
      await redis.del(`${NS}:${id}`);
      const ids = ((await redis.get(`${NS}:ids`)) || []).filter((x) => x !== id);
      await redis.set(`${NS}:ids`, ids);
      return res.status(204).end();
    }
    if (req.method === "GET") {
      const ids = (await redis.get(`${NS}:ids`)) || [];
      if (!ids.length) return res.json([]);
      const keys = ids.map((id) => `${NS}:${id}`);
      const vals = await redis.mget(...keys);
      return res.json(vals.filter(Boolean));
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
