import { redis } from "./_redis.js";
import { sendLineMessage } from "./_line.js";

const KEY = "notify:config";

function massageSampleText() {
  return [
    "【予約通知テスト（マッサージ）】",
    "希望日時: 9/5（土） 15:00〜",
    "お名前: 山田 花子",
    "お電話番号: 090-1234-5678",
    "お部屋番号: 705",
    "メニュー: レギュラー 60分",
    "オプション: なし",
    "金額: ¥8,000",
    "",
    "※これはテスト送信です",
  ].join("\n");
}

function fortuneSampleText() {
  return [
    "【予約通知テスト（占い）】",
    "コース: お試し 20分（¥2,800）",
    "希望日時: 9/5（土） 15:00〜",
    "お名前: 山田 花子",
    "お電話番号: 090-1234-5678",
    "お部屋番号: 705",
    "人数: 1名",
    "",
    "※これはテスト送信です",
  ].join("\n");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { target } = req.body || {};
    if (target !== "massage" && target !== "fortune") {
      return res.status(400).json({ error: "target must be 'massage' or 'fortune'" });
    }
    const config = (await redis.get(KEY)) || {};
    const to = target === "massage" ? config.massageGroupId : config.fortuneGroupId;
    const text = target === "massage" ? massageSampleText() : fortuneSampleText();
    await sendLineMessage(config.lineToken, to, text);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
