import { redis } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const date = req.query.date || (req.body && req.body.date);
    if (!date) return res.status(400).json({ error: "date required" });
    const key = `receptionmeta:${date}`;

    if (req.method === "GET") {
      const data = await redis.get(key);
      return res.json(
        data || { date, guestCount: "", childCount: "", inbound: "", signature: "" },
      );
    }
    if (req.method === "POST") {
      const data = { ...req.body, date };
      await redis.set(key, data);
      return res.json(data);
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
