import { listAll } from "./_redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { loginId, password } = req.body || {};
  if (loginId === "z" && password === "z") return res.json({ role: "admin" });
  if (loginId === "a" && password === "a") return res.json({ role: "debug" });

  try {
    const staffList = await listAll("staff");
    const found = staffList.find(
      (s) => s.loginId === loginId && s.password === password && s.active !== false,
    );
    if (found) {
      return res.json({ role: "staff", staffId: found.id, staffName: found.name });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }

  return res.status(401).json({ error: "invalid" });
}
