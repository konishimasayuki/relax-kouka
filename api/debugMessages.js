import { deleteItem, listAll, saveItem } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const threadId = req.query.threadId || (req.body && req.body.threadId);
    if (!threadId) return res.status(400).json({ error: "threadId required" });
    const ns = `debugmessage:${threadId}`;

    if (req.method === "GET") return res.json(await listAll(ns));
    if (req.method === "POST") return res.json(await saveItem(ns, { ...req.body, threadId }));
    if (req.method === "DELETE") {
      await deleteItem(ns, req.query.id);
      return res.status(204).end();
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
