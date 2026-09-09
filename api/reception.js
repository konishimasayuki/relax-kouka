import { deleteItem, listAll, redis, saveItem } from "./_redis.js";
import { sendPushToAll } from "./_push.js";

// 通知機能は一旦不使用（trueに戻せばすぐ再開できます）
const PUSH_NOTIFICATIONS_ENABLED = false;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const date = req.query.date || (req.body && req.body.date);
    if (!date) return res.status(400).json({ error: "date required" });
    const ns = `rec:${date}`;

    if (req.method === "GET") return res.json(await listAll(ns));
    if (req.method === "POST") {
      const body = req.body || {};
      const isNew = !body.id;
      const previous = isNew ? null : await redis.get(`${ns}:${body.id}`);
      const saved = await saveItem(ns, { ...body, date });

      // タイムボードへの登録・変更をプッシュ通知（ベストエフォート。失敗しても保存自体は成功させる）
      if (PUSH_NOTIFICATIONS_ENABLED) {
        try {
          const name = saved.customerName || "（お客様名未入力）";
          const time = saved.startTime ? `${saved.startTime}〜` : "時間未定";
          if (isNew) {
            await sendPushToAll(
              "予約が登録されました",
              `${date} ${time} ${name}様`,
              "/",
            );
          } else if (previous) {
            const changed =
              previous.startTime !== saved.startTime ||
              previous.staffId !== saved.staffId ||
              previous.customerName !== saved.customerName ||
              previous.storeId !== saved.storeId;
            if (changed) {
              await sendPushToAll(
                "予約が変更されました",
                `${date} ${time} ${name}様`,
                "/",
              );
            }
          }
        } catch (e) {
          console.error("push通知失敗", e);
        }
      }

      return res.json(saved);
    }
    if (req.method === "DELETE") {
      await deleteItem(ns, req.query.id);
      return res.status(204).end();
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
