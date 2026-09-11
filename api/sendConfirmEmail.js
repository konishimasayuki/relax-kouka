import { redis, saveItem, listAll } from "./_redis.js";
import { sendEmail } from "./_email.js";
import {
  fillTemplate,
  DONE_SUBJECT_DEFAULT,
  DONE_BODY_DEFAULT,
} from "./_emailTemplates.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { record } = req.body || {};
    if (!record?.id || !record?.date) {
      return res.status(400).json({ error: "record（id・date）が必要です" });
    }
    if (!record.email) {
      return res.status(400).json({ error: "この予約にメールアドレスが入力されていません" });
    }

    const config = (await redis.get("notify:config")) || {};
    if (!config.resendApiKey) {
      return res.status(400).json({ error: "Resend APIキーが未設定です（設定タブで入力してください）" });
    }

    let storeName = "";
    if (record.storeId) {
      const stores = await listAll("store").catch(() => []);
      storeName = stores.find((s) => s.id === record.storeId)?.name || "";
    }

    const details = [
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

    await sendEmail(config.resendApiKey, config.resendFromEmail, record.email, subject, body);

    const sentAt = new Date().toISOString();
    const ns = `rec:${record.date}`;
    const updated = { ...record, confirmEmailSentAt: sentAt };
    const saved = await saveItem(ns, updated);

    return res.json({ ok: true, sentAt, record: saved });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
