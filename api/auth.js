export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { loginId, password } = req.body || {};
  if (loginId === "z" && password === "z") return res.json({ role: "admin" });
  if (loginId === "a" && password === "a") return res.json({ role: "debug" });
  return res.status(401).json({ error: "invalid" });
}
