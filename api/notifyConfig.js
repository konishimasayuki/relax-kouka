import { redis } from "./_redis.js";

const KEY = "notify:config";

function emptyConfig() {
  return {
    lineToken: "",
    massageGroupId: "",
    fortuneGroupId: "",
    resendApiKey: "",
    resendFromEmail: "",
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
