import { redis } from "./_redis.js";
import { deleteItem, listAll, saveItem } from "./_redis.js";
import { sendLineMessage } from "./_line.js";
import { sendEmail } from "./_email.js";
import { sendPushToAll } from "./_push.js";

const NS = "bookingRequests";
const NOTIFY_KEY = "notify:config";

function lineTextFor(r) {
  if (r.type === "massage") {
    return [
      "【新規予約申請（マッサージ）】",
      `希望日時: ${r.desiredDate || "-"} ${r.desiredTime || ""}`,
      `お名前: ${r.name || "-"}`,
      `お電話番号: ${r.phone || "-"}`,
      `メールアドレス: ${r.email || "-"}`,
      `お部屋番号: ${r.room || "-"}`,
      `メニュー: ${r.menu || "-"}`,
      `オプション: ${r.option || "なし"}`,
      `金額: ${r.price || "-"}`,
    ].join("\n");
  }
  return [
    "【新規予約申請（占い）】",
    `コース: ${r.course || "-"}`,
    `希望日時: ${r.desiredDate || "-"} ${r.desiredTime || ""}`,
    `お名前: ${r.name || "-"}`,
    `お電話番号: ${r.phone || "-"}`,
    `メールアドレス: ${r.email || "-"}`,
    `お部屋番号: ${r.room || "-"}`,
    `人数: ${r.people || "-"}`,
  ].join("\n");
}

import { fillTemplate, detailsBlockFor, CONFIRM_SUBJECT_DEFAULT, CONFIRM_BODY_DEFAULT, DONE_SUBJECT_DEFAULT, DONE_BODY_DEFAULT } from "./_emailTemplates.js";

function confirmEmailSubject(config) {
  return config.confirmEmailSubject || CONFIRM_SUBJECT_DEFAULT;
}
function confirmEmailText(r, config) {
  return fillTemplate(config.confirmEmailBody || CONFIRM_BODY_DEFAULT, {
    name: r.name || "お客様",
    desiredDate: r.desiredDate || "-",
    desiredTime: r.desiredTime || "",
    details: detailsBlockFor(r),
  });
}

function doneEmailSubject(config) {
  return config.doneEmailSubject || DONE_SUBJECT_DEFAULT;
}
function doneEmailText(r, config) {
  return fillTemplate(config.doneEmailBody || DONE_BODY_DEFAULT, {
    name: r.name || "お客様",
    desiredDate: r.desiredDate || "-",
    desiredTime: r.desiredTime || "",
    details: detailsBlockFor(r),
  });
}

// LINE通知・メール送信は失敗しても予約申請の保存自体は成功させる（通知はベストエフォート）
async function notifyOnCreate(saved, config) {
  try {
    const groupId = saved.type === "massage" ? config.massageGroupId : config.fortuneGroupId;
    if (config.lineToken && groupId) {
      await sendLineMessage(config.lineToken, groupId, lineTextFor(saved));
    }
  } catch (e) {
    console.error("LINE通知（新規申請）失敗", e);
  }
  try {
    const title =
      saved.type === "massage" ? "新規予約申請（マッサージ）" : "新規予約申請（占い）";
    const time = saved.desiredTime ? `${saved.desiredTime}〜` : "時間未定";
    const body = `${saved.desiredDate || ""} ${time} ${saved.name || ""}様`;
    await sendPushToAll(title, body, "/");
  } catch (e) {
    console.error("アプリ通知（新規申請）失敗", e);
  }
  try {
    if (saved.email && config.resendApiKey) {
      await sendEmail(
        config.resendApiKey,
        config.resendFromEmail,
        saved.email,
        confirmEmailSubject(config),
        confirmEmailText(saved, config),
      );
    }
  } catch (e) {
    console.error("確認メール送信失敗", e);
  }
}

async function notifyOnDone(saved, config) {
  try {
    if (saved.email && config.resendApiKey) {
      await sendEmail(
        config.resendApiKey,
        config.resendFromEmail,
        saved.email,
        doneEmailSubject(config),
        doneEmailText(saved, config),
      );
    }
  } catch (e) {
    console.error("確定メール送信失敗", e);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const list = await listAll(NS);
      // 新しいものが上に来るよう作成日時の降順で返す
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return res.json(list);
    }
    if (req.method === "POST") {
      const body = req.body || {};
      const isNew = !body.id;
      const previous = isNew ? null : await redis.get(`${NS}:${body.id}`);

      const data = {
        ...body,
        status: body.status || "new",
        createdAt: body.createdAt || new Date().toISOString(),
      };
      const saved = await saveItem(NS, data);

      const config = (await redis.get(NOTIFY_KEY)) || {};
      if (isNew) {
        await notifyOnCreate(saved, config);
      } else if (previous && previous.status !== "done" && saved.status === "done") {
        await notifyOnDone(saved, config);
      }

      return res.json(saved);
    }
    if (req.method === "DELETE") {
      await deleteItem(NS, req.query.id);
      return res.status(204).end();
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
