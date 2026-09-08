import { redis } from "./_redis.js";
import webpush from "web-push";

const KEY = "push:config";

function emptyConfig() {
  return {
    publicKey: "",
    privateKey: "",
    subject: "mailto:admin@example.com",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const data = await redis.get(KEY);
      // 公開鍵だけを返すオプション（フロントの購読処理はpublicKeyしか使わない）
      if (req.query.publicOnly === "1") {
        return res.json({ publicKey: data?.publicKey || "" });
      }
      return res.json(data ? { ...emptyConfig(), ...data } : emptyConfig());
    }
    if (req.method === "POST") {
      const body = req.body || {};
      let { publicKey, privateKey, subject } = body;
      // キー未指定 or 「再生成」指定時はここで新しいVAPIDキーを発行する
      if (body.regenerate || !publicKey || !privateKey) {
        const keys = webpush.generateVAPIDKeys();
        publicKey = keys.publicKey;
        privateKey = keys.privateKey;
      }
      const data = { publicKey, privateKey, subject: subject || emptyConfig().subject };
      await redis.set(KEY, data);
      return res.json(data);
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
