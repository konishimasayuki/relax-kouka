import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { api } from "../api.js";
import { overlayClose } from "../modalUtils.js";

// Vercelのサーバーレス関数はリクエストボディが約4.5MBまでという制限があり、
// base64化すると元のファイルサイズの約1.33倍になるため、安全のため3MBに制限する
const MAX_FILE_MB = 3;

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DebugRequests() {
  const { staff } = useApp();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openThreadId, setOpenThreadId] = useState(null);
  const [newThreadForm, setNewThreadForm] = useState(null); // { staffId, title, body, file }
  const [busy, setBusy] = useState(false);

  const loadThreads = async () => {
    setLoading(true);
    try {
      setThreads(await api.debugThreads());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  const staffName = (id) => staff.find((s) => s.id === id)?.name || "不明";

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
    [threads],
  );

  const attachFile = async (file) => {
    if (!file) return null;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`ファイルは${MAX_FILE_MB}MB以下にしてください`);
      return null;
    }
    const dataUrl = await readFileAsDataUrl(file);
    return { fileDataUrl: dataUrl, fileName: file.name, fileType: file.type };
  };

  const createThread = async () => {
    if (!newThreadForm.staffId) return alert("依頼者（スタッフ）を選択してください");
    if (!newThreadForm.title.trim()) return alert("件名を入力してください");
    if (!newThreadForm.body.trim()) return alert("依頼内容を入力してください");
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const thread = await api.saveDebugThread({
        id: "",
        title: newThreadForm.title,
        staffId: newThreadForm.staffId,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
      const attachment = await attachFile(newThreadForm.file);
      await api.saveDebugMessage({
        id: "",
        threadId: thread.id,
        author: "staff",
        body: newThreadForm.body,
        createdAt: now,
        ...attachment,
      });
      await loadThreads();
      setNewThreadForm(null);
      setOpenThreadId(thread.id);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delThread = async (id) => {
    if (!confirm("このスレッドを削除しますか？（返信もすべて削除されます）")) return;
    await api.deleteDebugThread(id);
    await loadThreads();
    if (openThreadId === id) setOpenThreadId(null);
  };

  const closeThread = async (t, status) => {
    await api.saveDebugThread({ ...t, status, updatedAt: new Date().toISOString() });
    await loadThreads();
  };

  return (
    <div>
      <div className="page-head">
        <h2>デバッグ依頼</h2>
      </div>

      <div className="toolbar">
        <button
          className="btn sm"
          onClick={() => setNewThreadForm({ staffId: staff[0]?.id || "", title: "", body: "", file: null })}
        >
          ＋ 新規スレッド
        </button>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : sortedThreads.length === 0 ? (
        <div className="empty">依頼スレッドがまだありません</div>
      ) : (
        sortedThreads.map((t) => (
          <div className="card" key={t.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <strong>{t.title}</strong>{" "}
                {t.status === "closed" && <span className="pill gray">対応済み</span>}
                <div className="muted" style={{ fontSize: 13 }}>
                  依頼者: {staffName(t.staffId)} ／ 更新: {fmtDateTime(t.updatedAt)}
                </div>
              </div>
              <button className="btn sm" onClick={() => setOpenThreadId(t.id)}>
                開く
              </button>
              <button className="btn sm danger" onClick={() => delThread(t.id)}>
                削除
              </button>
            </div>
          </div>
        ))
      )}

      {newThreadForm && (
        <div className="modal-overlay" onClick={overlayClose(() => setNewThreadForm(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>新規スレッド</h3>
            <div className="field">
              <label>依頼者（スタッフ）</label>
              <select
                value={newThreadForm.staffId}
                onChange={(e) => setNewThreadForm({ ...newThreadForm, staffId: e.target.value })}
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>件名</label>
              <input
                value={newThreadForm.title}
                onChange={(e) => setNewThreadForm({ ...newThreadForm, title: e.target.value })}
                placeholder="例：受付一覧表に◯◯の項目を追加してほしい"
              />
            </div>
            <div className="field">
              <label>依頼内容</label>
              <textarea
                rows={5}
                value={newThreadForm.body}
                onChange={(e) => setNewThreadForm({ ...newThreadForm, body: e.target.value })}
              />
            </div>
            <div className="field">
              <label>写真・ファイル添付（任意、{MAX_FILE_MB}MBまで）</label>
              <input
                type="file"
                accept="image/*,.pdf,.txt,.csv,.xlsx,.docx"
                onChange={(e) => setNewThreadForm({ ...newThreadForm, file: e.target.files[0] })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setNewThreadForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={createThread} disabled={busy}>
                送信
              </button>
            </div>
          </div>
        </div>
      )}

      {openThreadId && (
        <ThreadDetail
          threadId={openThreadId}
          thread={threads.find((t) => t.id === openThreadId)}
          staffName={staffName}
          onClose={() => setOpenThreadId(null)}
          onCloseThread={closeThread}
          onChanged={loadThreads}
        />
      )}
    </div>
  );
}

function ThreadDetail({ threadId, thread, staffName, onClose, onCloseThread, onChanged }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.debugMessages(threadId);
      setMessages([...list].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [threadId]);

  const send = async () => {
    if (!reply.trim() && !file) return;
    setBusy(true);
    try {
      let attachment = null;
      if (file) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          alert(`ファイルは${MAX_FILE_MB}MB以下にしてください`);
          setBusy(false);
          return;
        }
        const dataUrl = await readFileAsDataUrl(file);
        attachment = { fileDataUrl: dataUrl, fileName: file.name, fileType: file.type };
      }
      const now = new Date().toISOString();
      await api.saveDebugMessage({
        id: "",
        threadId,
        author: "admin",
        body: reply,
        createdAt: now,
        ...attachment,
      });
      if (thread) await onCloseThread(thread, thread.status); // updatedAtだけ更新するため同じstatusで保存
      setReply("");
      setFile(null);
      await load();
      await onChanged();
    } catch (e) {
      alert(`送信失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delMessage = async (id) => {
    if (!confirm("このメッセージを削除しますか？")) return;
    await api.deleteDebugMessage(id, threadId);
    await load();
  };

  return (
    <div className="modal-overlay" onClick={overlayClose(onClose)}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <h3>{thread?.title}</h3>
        <p className="muted" style={{ marginTop: -8 }}>
          依頼者: {thread ? staffName(thread.staffId) : ""}
        </p>

        <div className="debug-thread-messages">
          {loading ? (
            <div className="empty">読み込み中…</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`debug-message ${m.author === "admin" ? "admin" : ""}`}>
                <div className="debug-message-head">
                  <strong>{m.author === "admin" ? "管理者" : "依頼者"}</strong>
                  <span className="muted">{fmtDateTime(m.createdAt)}</span>
                  <button className="btn sm danger" onClick={() => delMessage(m.id)}>
                    削除
                  </button>
                </div>
                {m.body && <div className="debug-message-body">{m.body}</div>}
                {m.fileDataUrl && m.fileType?.startsWith("image/") && (
                  <img src={m.fileDataUrl} alt={m.fileName} className="debug-message-image" />
                )}
                {m.fileDataUrl && !m.fileType?.startsWith("image/") && (
                  <a href={m.fileDataUrl} download={m.fileName} className="debug-message-file">
                    📎 {m.fileName}
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        <div className="field">
          <label>返信</label>
          <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
        </div>
        <div className="field">
          <label>写真・ファイル添付（任意）</label>
          <input
            type="file"
            accept="image/*,.pdf,.txt,.csv,.xlsx,.docx"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </div>

        <div className="modal-actions">
          <button className="btn gray" onClick={onClose}>
            閉じる
          </button>
          {thread?.status !== "closed" ? (
            <button
              className="btn sm ghost"
              onClick={() => thread && onCloseThread(thread, "closed")}
            >
              対応済みにする
            </button>
          ) : (
            <button
              className="btn sm ghost"
              onClick={() => thread && onCloseThread(thread, "open")}
            >
              未対応に戻す
            </button>
          )}
          <button className="btn" onClick={send} disabled={busy}>
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
