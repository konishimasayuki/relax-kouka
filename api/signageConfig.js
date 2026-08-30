import { redis } from "./_redis.js";

const KEY = "signage:config";

function emptyConfig() {
  return {
    refreshSec: 20,
    durationTiers: [30, 60, 90],
    slideDefaultSec: 8,
    slides: [], // { id, imageDataUrl, caption, seconds }
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const data = await redis.get(KEY);
      return res.json(data ? { ...emptyConfig(), ...data } : emptyConfig());
    }
    if (req.method === "POST") {
      const data = { ...emptyConfig(), ...req.body };
      await redis.set(KEY, data);
      return res.json(data);
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
