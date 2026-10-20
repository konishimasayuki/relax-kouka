import { redis } from "./_redis.js";
import { sendEmail } from "./_email.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { to, subject, body } = req.body || {};
    if (!to) return res.status(400).json({ error: "送信先メールアドレスが必要です" });
    if (!subject?.trim()) return res.status(400).json({ error: "件名を入力してください" });
    if (!body?.trim()) return res.status(400).json({ error: "本文を入力してください" });

    const config = (await redis.get("notify:config")) || {};
    if (!config.resendApiKey) {
      return res.status(400).json({ error: "Resend APIキーが未設定です（設定タブで入力してください）" });
    }

    await sendEmail(config.resendApiKey, config.resendFromEmail, to, subject, body);

    return res.json({ ok: true, sentAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
