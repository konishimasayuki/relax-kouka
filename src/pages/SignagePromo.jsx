import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export default function SignagePromo() {
  const [config, setConfig] = useState({ slideDefaultSec: 8, slides: [] });
  const [index, setIndex] = useState(0);
  const slideTimerRef = useRef(null);
  const pollTimerRef = useRef(null);

  const load = async () => {
    try {
      const cfg = await api.signageConfig();
      setConfig(cfg);
    } catch {
      // 通信エラー時は前の内容を表示し続ける
    }
  };

  useEffect(() => {
    load();
    pollTimerRef.current = setInterval(load, 60000); // 内容変更に気づけるよう1分ごとに設定を確認
    return () => clearInterval(pollTimerRef.current);
  }, []);

  const slides = config.slides || [];

  useEffect(() => {
    clearTimeout(slideTimerRef.current);
    if (slides.length === 0) return;
    const current = slides[index % slides.length];
    const sec = current?.seconds || config.slideDefaultSec || 8;
    slideTimerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, sec * 1000);
    return () => clearTimeout(slideTimerRef.current);
    // eslint-disable-next-line
  }, [index, slides.length, config.slideDefaultSec]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
    // eslint-disable-next-line
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <div className="signage-promo empty">
        <p>宣伝スライドが登録されていません（設定→サイネージ設定から登録できます）</p>
      </div>
    );
  }

  const current = slides[index % slides.length];

  return (
    <div className="signage-promo">
      <img src={current.imageDataUrl} alt={current.caption || ""} className="signage-promo-image" />
      {current.caption && <div className="signage-promo-caption">{current.caption}</div>}
    </div>
  );
}
