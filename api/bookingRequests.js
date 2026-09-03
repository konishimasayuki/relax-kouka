import { deleteItem, listAll, saveItem } from "./_redis.js";

const NS = "bookingRequests";

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
      const data = {
        ...body,
        status: body.status || "new",
        createdAt: body.createdAt || new Date().toISOString(),
      };
      const saved = await saveItem(NS, data);
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
