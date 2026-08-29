import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// index（idのリスト）+ 個別キーで管理。一覧は MGET でまとめて取得。
export async function listAll(ns) {
  const ids = await redis.lrange(`${ns}:ids`, 0, -1);
  if (!ids || ids.length === 0) return [];
  const keys = ids.map((id) => `${ns}:${id}`);
  const vals = await redis.mget(...keys);
  return vals.filter(Boolean);
}

export async function saveItem(ns, item) {
  const data = { ...item };
  if (!data.id) {
    data.id = genId(ns.replace(/[:]/g, "_"));
    await redis.rpush(`${ns}:ids`, data.id);
  }
  await redis.set(`${ns}:${data.id}`, data);
  return data;
}

export async function deleteItem(ns, id) {
  await redis.del(`${ns}:${id}`);
  await redis.lrem(`${ns}:ids`, 0, id);
}
