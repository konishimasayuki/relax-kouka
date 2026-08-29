import { redis } from "./_redis.js";

const DENOMS = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1];

function emptyMeta(date, storeId) {
  return {
    date,
    storeId,
    cashOver: "",
    note: "",
    responsible: "",
    cashier: "",
    tenantManager: "",
    creator: "",
    denoms: Object.fromEntries(DENOMS.map((d) => [d, ""])),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const date = req.query.date || (req.body && req.body.date);
    const storeId = req.query.storeId || (req.body && req.body.storeId);
    if (!date || !storeId) return res.status(400).json({ error: "date and storeId required" });
    const key = `dailyreport:${date}:${storeId}`;

    if (req.method === "GET") {
      const data = await redis.get(key);
      return res.json(data || emptyMeta(date, storeId));
    }
    if (req.method === "POST") {
      const data = { ...emptyMeta(date, storeId), ...req.body, date, storeId };
      await redis.set(key, data);
      return res.json(data);
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
