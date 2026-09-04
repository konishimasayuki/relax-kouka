import { redis } from "./_redis.js";

const KEY = "payroll:commissionRates";

function emptyConfig() {
  return {
    bodyRecess: {
      base: { until11: 55, from11to15: 50, from15to23: 45 },
      earlyLeave: { until11: 55, from11to15: 45, from15to23: 40 },
    },
    ceada: {
      base: { until11: 50, from11to15: 50, from15to23: 45 },
      earlyLeave: { until11: 50, from11to15: 45, from15to23: 40 },
    },
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const data = await redis.get(KEY);
      const empty = emptyConfig();
      if (!data) return res.json(empty);
      // 保存済みデータに新しいフィールドが増えていた場合も欠けなく返す
      return res.json({
        bodyRecess: { ...empty.bodyRecess, ...data.bodyRecess },
        ceada: { ...empty.ceada, ...data.ceada },
      });
    }
    if (req.method === "POST") {
      const empty = emptyConfig();
      const body = req.body || {};
      const data = {
        bodyRecess: { ...empty.bodyRecess, ...body.bodyRecess },
        ceada: { ...empty.ceada, ...body.ceada },
      };
      await redis.set(KEY, data);
      return res.json(data);
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
