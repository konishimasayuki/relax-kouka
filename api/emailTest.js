import { redis } from "./_redis.js";
import { sendEmail } from "./_email.js";
import { fillTemplate, detailsBlockFor, CONFIRM_SUBJECT_DEFAULT, CONFIRM_BODY_DEFAULT } from "./_emailTemplates.js";

const KEY = "notify:config";

// サンプルデータ（マッサージ／占い）。実際の申請内容確認メールと同じテンプレート・同じ差し込み処理を使う。
function sampleRequest(type) {
  if (type === "fortune") {
    return {
      type: "fortune",
      name: "山田 花子",
      desiredDate: "2026-09-05",
      desiredTime: "15:00",
      course: "お試し 20分（¥2,800）",
      people: "1",
    };
  }
  return {
    type: "massage",
    name: "山田 花子",
    desiredDate: "2026-09-05",
    desiredTime: "15:00",
    menu: "レギュラー 60分",
    option: "なし",
    price: "¥8,000",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { to, type } = req.body || {};
    if (!to) return res.status(400).json({ error: "to (送信先メールアドレス) が必要です" });
    const config = (await redis.get(KEY)) || {};
    const sample = sampleRequest(type === "fortune" ? "fortune" : "massage");

    const subject = `【テスト】${config.confirmEmailSubject || CONFIRM_SUBJECT_DEFAULT}`;
    const body = fillTemplate(config.confirmEmailBody || CONFIRM_BODY_DEFAULT, {
      name: sample.name,
      desiredDate: sample.desiredDate,
      desiredTime: sample.desiredTime,
      details: detailsBlockFor(sample),
    }) + "\n\n※これはテスト送信です。実際の申請内容確認メールと同じテンプレートを使用しています。";

    await sendEmail(config.resendApiKey, config.resendFromEmail, to, subject, body);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
