import webpush from "web-push";
import { redis } from "./_redis.js";

// この端末だけにテスト通知を送る（スタッフが自分の端末で通知が届くか確認するため）
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).end();
    const sub = req.body?.subscription;
    if (!sub?.endpoint) return res.status(400).json({ error: "subscription が必要です" });

    const config = await redis.get("push:config");
    if (!config?.publicKey || !config?.privateKey) {
      return res.status(400).json({ error: "通知の設定（VAPIDキー）が未設定です。管理者に依頼してください。" });
    }
    webpush.setVapidDetails(config.subject || "mailto:admin@example.com", config.publicKey, config.privateKey);
    await webpush.sendNotification(
      sub,
      JSON.stringify({ title: "テスト通知", body: "この端末で通知を受け取れます ✅", url: "/" }),
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.body || e?.message || e) });
  }
}
