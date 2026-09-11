import { redis } from "./_redis.js";
import {
  CONFIRM_SUBJECT_DEFAULT,
  CONFIRM_BODY_DEFAULT,
  DONE_SUBJECT_DEFAULT,
  DONE_BODY_DEFAULT,
} from "./_emailTemplates.js";

const KEY = "notify:config";

function emptyConfig() {
  return {
    lineToken: "",
    massageGroupId: "",
    fortuneGroupId: "",
    resendApiKey: "",
    resendFromEmail: "",
    confirmEmailSubject: CONFIRM_SUBJECT_DEFAULT,
    confirmEmailBody: CONFIRM_BODY_DEFAULT,
    doneEmailSubject: DONE_SUBJECT_DEFAULT,
    doneEmailBody: DONE_BODY_DEFAULT,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const data = await redis.get(KEY);
      const merged = data ? { ...emptyConfig(), ...data } : emptyConfig();
      return res.json(fallbackTemplates(merged));
    }
    if (req.method === "POST") {
      const data = fallbackTemplates({ ...emptyConfig(), ...req.body });
      await redis.set(KEY, data);
      return res.json(data);
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

// 件名・本文を空欄で保存（＝デフォルトに戻したい）場合に、空文字のまま保持されず
// きちんとデフォルト文面にフォールバックするようにする
function fallbackTemplates(data) {
  return {
    ...data,
    confirmEmailSubject: data.confirmEmailSubject || CONFIRM_SUBJECT_DEFAULT,
    confirmEmailBody: data.confirmEmailBody || CONFIRM_BODY_DEFAULT,
    doneEmailSubject: data.doneEmailSubject || DONE_SUBJECT_DEFAULT,
    doneEmailBody: data.doneEmailBody || DONE_BODY_DEFAULT,
  };
}
