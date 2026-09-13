import { deleteItem, listAll, saveItem } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const menus = await listAll("menu");

      // 既存メニューに「インターバル」が未設定のものがあれば、
      // 本店以外は20分・本店は0分をデフォルトとして一度だけ自動で補完して保存する。
      const missing = menus.filter((m) => m.interval === undefined);
      if (missing.length) {
        const stores = await listAll("store");
        const homeBuilding =
          stores.find((s) => s.isHome)?.building ||
          stores.find((s) => s.building?.includes("パレス"))?.building ||
          stores[0]?.building ||
          "";
        const buildingOf = (storeId) => stores.find((s) => s.id === storeId)?.building || "";

        await Promise.all(
          missing.map(async (m) => {
            m.interval = buildingOf(m.storeId) === homeBuilding ? 0 : 20;
            await saveItem("menu", m);
          }),
        );
      }

      return res.json(menus);
    }
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
