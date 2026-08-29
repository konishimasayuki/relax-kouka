import { deleteItem, listAll, saveItem } from "./_redis.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return res.json(await listAll("menu"));
    if (req.method === "POST") return res.json(await saveItem("menu", req.body || {}));
    if (req.method === "DELETE") {
      await deleteItem("menu", req.query.id);
      return res.status(204).end();
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
