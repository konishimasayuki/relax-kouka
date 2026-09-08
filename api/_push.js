import webpush from "web-push";
import { redis } from "./_redis.js";

const PUSH_CONFIG_KEY = "push:config";
const SUBS_NS = "push:subs";

// 保存されている全ての購読デバイスへ通知を送る（無効になった購読は自動で削除）
export async function sendPushToAll(title, body, url) {
  const config = await redis.get(PUSH_CONFIG_KEY);
  if (!config?.publicKey || !config?.privateKey) return; // 未設定なら何もしない（ベストエフォート）

  webpush.setVapidDetails(config.subject || "mailto:admin@example.com", config.publicKey, config.privateKey);

  const ids = (await redis.get(`${SUBS_NS}:ids`)) || [];
  if (!ids.length) return;

  const keys = ids.map((id) => `${SUBS_NS}:${id}`);
  const subs = (await redis.mget(...keys)).filter(Boolean);

  const payload = JSON.stringify({ title, body, url: url || "/" });

  const staleIds = [];
  await Promise.all(
    subs.map(async (sub, i) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (e) {
        // 410/404 は購読が無効になっている（アンインストール等）ので後で掃除する
        if (e?.statusCode === 410 || e?.statusCode === 404) staleIds.push(ids[i]);
      }
    }),
  );

  if (staleIds.length) {
    const remaining = ids.filter((id) => !staleIds.includes(id));
    await redis.set(`${SUBS_NS}:ids`, remaining);
    await Promise.all(staleIds.map((id) => redis.del(`${SUBS_NS}:${id}`)));
  }
}
