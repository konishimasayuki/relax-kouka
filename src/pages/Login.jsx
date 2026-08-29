import { useState } from "react";
import { api } from "../api.js";

export default function Login({ onLogin }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await api.login(loginId.trim(), password.trim());
      if (r?.role) {
        onLogin(r);
      } else {
        setErr("IDまたはパスワードが違います");
      }
    } catch {
      setErr("IDまたはパスワードが違います");
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>リラク業務管理</h1>
        <div className="sub">ログインしてください</div>
        <div className="field">
          <label>ID</label>
          <input
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            onKeyDown={onKey}
            autoCapitalize="none"
            autoComplete="username"
            placeholder="ID"
          />
        </div>
        <div className="field">
          <label>パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKey}
            autoComplete="current-password"
            placeholder="パスワード"
          />
        </div>
        {err && (
          <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{err}</div>
        )}
        <button className="btn" style={{ width: "100%" }} onClick={submit} disabled={busy}>
          {busy ? "確認中…" : "ログイン"}
        </button>
      </div>
    </div>
  );
}
