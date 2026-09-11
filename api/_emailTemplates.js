// 予約申請メールのテンプレート（設定タブから編集可能）と、差し込み処理の共通モジュール

export const CONFIRM_SUBJECT_DEFAULT = "【ご予約申請の確認】RE:LAX";
export const CONFIRM_BODY_DEFAULT = `{name} 様

この度はご予約のお申し込みをいただき、誠にありがとうございます。
以下の内容でご予約申請を承りました。

―――――――――――――――――
店舗: {store}
希望日時: {desiredDate} {desiredTime}
{details}
―――――――――――――――――

【ご確認ください】
この時点では、ご予約はまだ確定しておりません。
スタッフが空き状況を確認したうえで、あらためて「ご予約確定」のご連絡メールをお送りいたします。
確定のご連絡が届くまで、今しばらくお待ちくださいますようお願いいたします。

※このメールは自動送信です。`;

export const DONE_SUBJECT_DEFAULT = "【ご予約確定のお知らせ】RE:LAX";
export const DONE_BODY_DEFAULT = `{name} 様

お待たせいたしました。空き状況を確認し、下記の内容でご予約が確定いたしましたのでご連絡いたします。

―――――――――――――――――
店舗: {store}
確定日時: {desiredDate} {desiredTime}
{details}
―――――――――――――――――

ご来店の際は、店舗（{store}）をお間違えのないようお気をつけてお越しくださいませ。
スタッフ一同お待ちしております。

※このメールは自動送信です。`;

// マッサージ／占いで項目が違うため、テンプレート側は {details} という
// ひとつの差し込み枠にまとめる（本文側で条件分岐しなくて済むように）
export function detailsBlockFor(r) {
  if (r.type === "massage") {
    return [
      `メニュー: ${r.menu || "-"}`,
      `オプション: ${r.option || "なし"}`,
      `金額: ${r.price || "-"}`,
    ].join("\n");
  }
  return [`コース: ${r.course || "-"}`, `人数: ${r.people || "-"}`].join("\n");
}

export function fillTemplate(tpl, vars) {
  return String(tpl || "").replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m));
}
