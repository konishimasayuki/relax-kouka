import { useEffect, useState } from "react";
import { api } from "../api.js";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_MB = 3;

export default function SignageSettings() {
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newTierInput, setNewTierInput] = useState("");
  const [newSlideFile, setNewSlideFile] = useState(null);
  const [newSlideCaption, setNewSlideCaption] = useState("");
  const [newSlideSeconds, setNewSlideSeconds] = useState("");

  const load = async () => setConfig(await api.signageConfig());

  useEffect(() => {
    load();
  }, []);

  const save = async (patch) => {
    setBusy(true);
    try {
      const saved = await api.saveSignageConfig({ ...config, ...patch });
      setConfig(saved);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!config) return <div className="empty">読み込み中…</div>;

  const addTier = () => {
    const n = Number(newTierInput);
    if (!n || n <= 0) return alert("分数を入力してください");
    if (config.durationTiers.includes(n)) return;
    save({ durationTiers: [...config.durationTiers, n].sort((a, b) => a - b) });
    setNewTierInput("");
  };

  const removeTier = (n) => {
    save({ durationTiers: config.durationTiers.filter((x) => x !== n) });
  };

  const addSlide = async () => {
    if (!newSlideFile) return alert("画像を選択してください");
    if (newSlideFile.size > MAX_IMAGE_MB * 1024 * 1024) {
      return alert(`画像は${MAX_IMAGE_MB}MB以下にしてください`);
    }
    const dataUrl = await readFileAsDataUrl(newSlideFile);
    const slide = {
      id: `${Date.now()}`,
      imageDataUrl: dataUrl,
      caption: newSlideCaption,
      seconds: Number(newSlideSeconds) || 0,
    };
    await save({ slides: [...config.slides, slide] });
    setNewSlideFile(null);
    setNewSlideCaption("");
    setNewSlideSeconds("");
  };

  const removeSlide = (id) => {
    if (!confirm("このスライドを削除しますか？")) return;
    save({ slides: config.slides.filter((s) => s.id !== id) });
  };

  const moveSlide = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= config.slides.length) return;
    const list = [...config.slides];
    [list[index], list[target]] = [list[target], list[index]];
    save({ slides: list });
  };

  return (
    <div>
      <div className="page-head">
        <h2>サイネージ設定</h2>
      </div>

      <div className="card">
        <strong>画面プレビュー</strong>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <button
            className="btn sm"
            onClick={() => window.open("/signage-congestion", "_blank", "width=540,height=960")}
          >
            画面1（混雑状況・縦長）を開く
          </button>
          <button
            className="btn sm"
            onClick={() => window.open("/signage-promo", "_blank", "width=960,height=540")}
          >
            画面2（宣伝・横長）を開く
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          実際にサイネージ用テレビに繋いだブラウザでも、それぞれ /signage-congestion（画面1）・
          /signage-promo（画面2）を開いてください。
        </div>
      </div>

      <div className="card">
        <strong>画面1：混雑状況の設定</strong>
        <div className="field" style={{ marginTop: 10 }}>
          <label>自動更新間隔（秒）</label>
          <input
            type="number"
            value={config.refreshSec}
            onChange={(e) => save({ refreshSec: Number(e.target.value) || 20 })}
            style={{ maxWidth: 120 }}
          />
        </div>
        <div className="field">
          <label>「ご案内可能」に表示する施術時間（分）</label>
          <div className="checks">
            {config.durationTiers.map((n) => (
              <span key={n} className="pill">
                {n}分{" "}
                <button
                  className="btn sm ghost"
                  style={{ padding: "0 6px", marginLeft: 4 }}
                  onClick={() => removeTier(n)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              type="number"
              value={newTierInput}
              onChange={(e) => setNewTierInput(e.target.value)}
              placeholder="例：45"
              style={{ maxWidth: 120 }}
            />
            <button className="btn sm" onClick={addTier} disabled={busy}>
              追加
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <strong>画面2：宣伝スライドの設定</strong>
        <div className="field" style={{ marginTop: 10 }}>
          <label>1枚あたりの標準表示秒数（個別指定がない場合）</label>
          <input
            type="number"
            value={config.slideDefaultSec}
            onChange={(e) => save({ slideDefaultSec: Number(e.target.value) || 8 })}
            style={{ maxWidth: 120 }}
          />
        </div>

        {config.slides.length === 0 ? (
          <div className="empty">スライドが登録されていません</div>
        ) : (
          config.slides.map((s, i) => (
            <div className="card" key={s.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img
                src={s.imageDataUrl}
                alt=""
                style={{ width: 80, height: 45, objectFit: "cover", borderRadius: 6 }}
              />
              <div style={{ flex: 1 }}>
                <div>{s.caption || <span className="muted">（キャプションなし）</span>}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  表示秒数: {s.seconds || `標準(${config.slideDefaultSec}秒)`}
                </div>
              </div>
              <button className="btn sm ghost" onClick={() => moveSlide(i, -1)} disabled={i === 0}>
                ▲
              </button>
              <button
                className="btn sm ghost"
                onClick={() => moveSlide(i, 1)}
                disabled={i === config.slides.length - 1}
              >
                ▼
              </button>
              <button className="btn sm danger" onClick={() => removeSlide(s.id)}>
                削除
              </button>
            </div>
          ))
        )}

        <div className="card">
          <strong>＋ スライドを追加</strong>
          <div className="field" style={{ marginTop: 8 }}>
            <label>画像（{MAX_IMAGE_MB}MBまで）</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewSlideFile(e.target.files[0] || null)}
            />
          </div>
          <div className="row">
            <div className="field">
              <label>キャプション（任意）</label>
              <input value={newSlideCaption} onChange={(e) => setNewSlideCaption(e.target.value)} />
            </div>
            <div className="field">
              <label>表示秒数（空欄で標準）</label>
              <input
                type="number"
                value={newSlideSeconds}
                onChange={(e) => setNewSlideSeconds(e.target.value)}
              />
            </div>
          </div>
          <button className="btn sm" onClick={addSlide} disabled={busy}>
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
