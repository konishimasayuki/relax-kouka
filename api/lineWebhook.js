import { redis } from "./_redis.js";

const KEY = "line:detectedGroups";
const MAX_ENTRIES = 20;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // LINEプラットフォームは200を素早く返すことを期待するので、まず即座に応答する。
  // （検証・保存に失敗しても200を返す：LINE側からのリトライ地獄を避けるため）
  try {
    const events = req.body?.events || [];
    for (const ev of events) {
      const source = ev.source || {};
      if (source.type === "group" && source.groupId) {
        const entry = {
          groupId: source.groupId,
          time: new Date().toISOString(),
          sampleEventType: ev.type || "",
        };
        const list = (await redis.get(KEY)) || [];
        // 同じgroupIdが既にあれば時刻だけ更新して先頭へ
        const filtered = list.filter((x) => x.groupId !== entry.groupId);
        const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);
        await redis.set(KEY, updated);
      }
    }
  } catch (e) {
    console.error("LINE webhook処理失敗", e);
  }

  return res.status(200).json({ ok: true });
}
