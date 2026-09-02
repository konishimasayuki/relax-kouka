// LINE Messaging API（push message）への送信共通処理
export async function sendLineMessage(token, to, text) {
  if (!token || !to) throw new Error("LINEトークンまたは送信先グループIDが未設定です");
  const resp = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`LINE送信失敗 (${resp.status}): ${body}`);
  }
  return true;
}
