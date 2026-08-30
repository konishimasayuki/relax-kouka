import { deleteItem, listAll, saveItem } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") return res.json(await listAll("debugthread"));
    if (req.method === "POST") return res.json(await saveItem("debugthread", req.body || {}));
    if (req.method === "DELETE") {
      await deleteItem("debugthread", req.query.id);
      return res.status(204).end();
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
