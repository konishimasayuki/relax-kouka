import { redis } from "./_redis.js";
import { deleteItem, listAll, saveItem } from "./_redis.js";
import { sendLineMessage } from "./_line.js";
import { sendEmail } from "./_email.js";

const NS = "bookingRequests";
const NOTIFY_KEY = "notify:config";

function lineTextFor(r) {
  if (r.type === "massage") {
    return [
      "【新規予約申請（マッサージ）】",
      `希望日時: ${r.desiredDate || "-"} ${r.desiredTime || ""}`,
      `お名前: ${r.name || "-"}`,
      `お電話番号: ${r.phone || "-"}`,
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
    `お部屋番号: ${r.room || "-"}`,
    `人数: ${r.people || "-"}`,
  ].join("\n");
}

function confirmEmailText(r) {
  const lines = [
    `${r.name || "お客様"} 様`,
    "",
    "この度はご予約のお申し込みをいただき、誠にありがとうございます。",
    "以下の内容でお申し込みを受け付けました。空き状況を確認のうえ、あらためて確定のご連絡をいたします。",
    "",
    `希望日時: ${r.desiredDate || "-"} ${r.desiredTime || ""}`,
  ];
  if (r.type === "massage") {
    lines.push(`メニュー: ${r.menu || "-"}`, `オプション: ${r.option || "なし"}`, `金額: ${r.price || "-"}`);
  } else {
    lines.push(`コース: ${r.course || "-"}`, `人数: ${r.people || "-"}`);
  }
  lines.push("", "※このメールは自動送信です。");
  return lines.join("\n");
}

function doneEmailText(r) {
  const lines = [
    `${r.name || "お客様"} 様`,
    "",
    "お待たせいたしました。空き状況を確認し、下記の内容でご予約が確定いたしました。",
    "",
    `確定日時: ${r.desiredDate || "-"} ${r.desiredTime || ""}`,
  ];
  if (r.type === "massage") {
    lines.push(`メニュー: ${r.menu || "-"}`, `オプション: ${r.option || "なし"}`, `金額: ${r.price || "-"}`);
  } else {
    lines.push(`コース: ${r.course || "-"}`, `人数: ${r.people || "-"}`);
  }
  lines.push("", "当日はお気をつけてお越しくださいませ。", "", "※このメールは自動送信です。");
  return lines.join("\n");
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
    if (saved.email && config.resendApiKey && config.resendFromEmail) {
      await sendEmail(
        config.resendApiKey,
        config.resendFromEmail,
        saved.email,
        "【ご予約申請の確認】RE:LAX",
        confirmEmailText(saved),
      );
    }
  } catch (e) {
    console.error("確認メール送信失敗", e);
  }
}

async function notifyOnDone(saved, config) {
  try {
    if (saved.email && config.resendApiKey && config.resendFromEmail) {
      await sendEmail(
        config.resendApiKey,
        config.resendFromEmail,
        saved.email,
        "【ご予約確定のお知らせ】RE:LAX",
        doneEmailText(saved),
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
