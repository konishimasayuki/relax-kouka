import { redis } from "./_redis.js";
import { sendEmail } from "./_email.js";

const KEY = "notify:config";

function sampleSubject() {
  return "【テスト送信】RE:LAX 予約通知メール";
}

function sampleText() {
  return [
    "これはテスト送信です。",
    "",
    "実際の運用では、以下のようなメールが自動送信される予定です。",
    "・予約申請を受け付けた際の「申請内容の確認メール」",
    "・サロン側で空き状況を確認したうえでの「予約確定メール」",
    "",
    "※このメールはRE:LAX予約システムのテスト送信機能から送られています。",
  ].join("\n");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ error: "to (送信先メールアドレス) が必要です" });
    const config = (await redis.get(KEY)) || {};
    await sendEmail(config.resendApiKey, config.resendFromEmail, to, sampleSubject(), sampleText());
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
