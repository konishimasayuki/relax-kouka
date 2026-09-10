import { redis } from "./_redis.js";
import { sendEmail } from "./_email.js";

const KEY = "notify:config";

// 実際の「ご予約申請の確認メール」と同じ文面・同じサンプルデータでテスト送信する
function confirmSampleText(type) {
  const lines = [
    "山田 花子 様",
    "",
    "この度はご予約のお申し込みをいただき、誠にありがとうございます。",
    "以下の内容でご予約申請を承りました。",
    "",
    "―――――――――――――――――",
    "希望日時: 9/5（土） 15:00〜",
  ];
  if (type === "massage") {
    lines.push("メニュー: レギュラー 60分", "オプション: なし", "金額: ¥8,000");
  } else {
    lines.push("コース: お試し 20分（¥2,800）", "人数: 1名");
  }
  lines.push(
    "―――――――――――――――――",
    "",
    "【ご確認ください】",
    "この時点では、ご予約はまだ確定しておりません。",
    "スタッフが空き状況を確認したうえで、あらためて「ご予約確定」のご連絡メールをお送りいたします。",
    "確定のご連絡が届くまで、今しばらくお待ちくださいますようお願いいたします。",
    "",
    "※これはテスト送信です。実際の申請内容確認メールと同じ文面です。",
  );
  return lines.join("\n");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { to, type } = req.body || {};
    if (!to) return res.status(400).json({ error: "to (送信先メールアドレス) が必要です" });
    const config = (await redis.get(KEY)) || {};
    const target = type === "fortune" ? "fortune" : "massage";
    await sendEmail(
      config.resendApiKey,
      config.resendFromEmail,
      to,
      "【テスト】ご予約申請の確認（RE:LAX）",
      confirmSampleText(target),
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
