// Resend (https://resend.com) のAPIを使ったメール送信共通処理
export async function sendEmail(apiKey, from, to, subject, text) {
  if (!apiKey || !from) throw new Error("Resend APIキーまたは送信元メールアドレスが未設定です");
  if (!to) throw new Error("送信先メールアドレスが未指定です");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`メール送信失敗 (${resp.status}): ${body}`);
  }
  return true;
}
