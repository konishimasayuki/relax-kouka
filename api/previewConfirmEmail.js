import { redis, listAll } from "./_redis.js";
import {
  fillTemplate,
  DONE_SUBJECT_DEFAULT,
  DONE_BODY_DEFAULT,
} from "./_emailTemplates.js";

// sendConfirmEmail.js と同じ文面組み立てロジック（実際には送らず、件名・本文を返すだけ）
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { record, type } = req.body || {};
    if (!record?.date) {
      return res.status(400).json({ error: "record（date）が必要です" });
    }

    const config = (await redis.get("notify:config")) || {};
    const isFortune = type === "fortune";

    let storeName = "";
    if (isFortune) {
      storeName = "杉の泉";
    } else if (record.storeId) {
      const stores = await listAll("store").catch(() => []);
      storeName = stores.find((s) => s.id === record.storeId)?.name || "";
    }

    const details = isFortune
      ? [
          `コース: ${record.minutes ? `${record.minutes}分` : "-"}`,
          `金額: ¥${Number(record.price || 0).toLocaleString("ja-JP")}`,
        ].join("\n")
      : [
          `メニュー: ${record.course?.displayName || record.course?.name || record.course?.freeText || "-"}`,
          record.course?.optionName ? `オプション: ${record.course.optionName}` : null,
          `金額: ¥${Number(record.amount || 0).toLocaleString("ja-JP")}`,
        ]
          .filter(Boolean)
          .join("\n");

    const subject = config.doneEmailSubject || DONE_SUBJECT_DEFAULT;
    const body = fillTemplate(config.doneEmailBody || DONE_BODY_DEFAULT, {
      name: record.customerName || "お客様",
      store: storeName || "-",
      desiredDate: record.date,
      desiredTime: record.startTime || "",
      details,
    });

    return res.json({ subject, body });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
