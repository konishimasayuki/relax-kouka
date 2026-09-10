// Resend (https://resend.com) のAPIを使ったメール送信共通処理
// 独自ドメイン未設定の場合、Resendが用意しているテスト用の共有ドメインで送信する
const RESEND_DEFAULT_FROM = "RE:LAX予約 <onboarding@resend.dev>";

export async function sendEmail(apiKey, from, to, subject, text) {
  const sender = from || RESEND_DEFAULT_FROM;
  if (!apiKey) throw new Error("Resend APIキーが未設定です");
  if (!to) throw new Error("送信先メールアドレスが未指定です");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from: sender, to, subject, text }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`メール送信失敗 (${resp.status}): ${body}`);
  }
  return true;
}
