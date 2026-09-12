import { useEffect, useRef, useState } from "react";

// ブラウザ標準の音声認識（Web Speech API）を使用。
// - サーバー側の音声処理基盤が無い状態でもすぐ動かせる、最も手早い実装方法。
// - Chromeの「マイク」として、VR-D179AのVR OUTを繋いだPCのライン入力を選択して使う想定。
// - 現状は「スタッフ・お客様」の話者自動分離までは行っていない（1本の文字起こしとして流れる）。
//   VR-D179Aの出力が実際にステレオ（送受話分離）かどうかを確認できたら、
//   左右チャンネルを別々に認識にかける形に拡張できる（次のステップ）。
const SpeechRecognitionCtor =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

function timeLabel() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CallTranscriptWidget() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaker, setSpeaker] = useState("staff"); // "staff" | "customer"（次に確定するテキストのタグ）
  const speakerRef = useRef("staff"); // onresultコールバック内で最新値を参照するため
  const [lines, setLines] = useState([]); // [{ time, text, speaker }]
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false); // onendでの自動再起動判定用（stateの非同期更新を待たない）
  const listRef = useRef(null);

  const setSpeakerTag = (s) => {
    speakerRef.current = s;
    setSpeaker(s);
  };

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // 片付けなので失敗は無視
      }
    };
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [lines, interim]);

  const startListening = () => {
    if (!SpeechRecognitionCtor) {
      setError("このブラウザは音声認識に対応していません（Google Chromeでお使いください）");
      return;
    }
    setError("");
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      if (finalText.trim()) {
        setLines((prev) => [
          ...prev,
          { time: timeLabel(), text: finalText.trim(), speaker: speakerRef.current },
        ]);
        setInterim("");
      } else {
        setInterim(interimText);
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("マイクの使用が許可されていません。ブラウザの設定を確認してください。");
        listeningRef.current = false;
        setListening(false);
      }
      // "no-speech" 等は無音が続いただけなので無視して継続（onendで自動再起動する）
    };

    recognition.onend = () => {
      // Chromeは無音や一定時間で自動停止することがあるため、
      // まだ「聞き取り中」のつもりなら自動で再開する
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          // 既に開始中などの一時的なエラーは無視
        }
      }
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch (err) {
      setError(`開始に失敗しました: ${err.message}`);
      listeningRef.current = false;
      setListening(false);
    }
  };

  const stopListening = () => {
    listeningRef.current = false;
    setListening(false);
    setInterim("");
    try {
      recognitionRef.current?.stop();
    } catch {
      // 停止操作の失敗は無視して良い
    }
  };

  const clearLines = () => {
    if (lines.length && !confirm("表示中の文字起こしを消去しますか？")) return;
    setLines([]);
  };

  return (
    <div className="call-transcript-widget desktop-only-block">
      {open ? (
        <div className="call-transcript-panel">
          <div className="call-transcript-head">
            <span>📞 通話文字起こし</span>
            <button className="ct-collapse-btn" onClick={() => setOpen(false)} title="折りたたむ">
              ▾
            </button>
          </div>

          <div className="call-transcript-speaker">
            <button
              className={speaker === "customer" ? "ct-speaker-btn active customer" : "ct-speaker-btn"}
              onClick={() => setSpeakerTag("customer")}
            >
              お客様が話す
            </button>
            <button
              className={speaker === "staff" ? "ct-speaker-btn active staff" : "ct-speaker-btn"}
              onClick={() => setSpeakerTag("staff")}
            >
              スタッフが話す
            </button>
          </div>

          <div className="call-transcript-body" ref={listRef}>
            {lines.length === 0 && !interim && (
              <div className="ct-empty">
                「開始」を押し、話している方に合わせて上のボタン（お客様／スタッフ）を切り替えながらお使いください。
                <br />
                （現状は音声だけからの自動的な話し手分けはまだ未対応です）
              </div>
            )}
            {lines.map((l, i) => (
              <div className={`ct-line ct-${l.speaker || "staff"}`} key={i}>
                <span className="ct-tag">{l.speaker === "customer" ? "お客様" : "スタッフ"}</span>
                <span className="ct-time">{l.time}</span>
                <span className="ct-text">{l.text}</span>
              </div>
            ))}
            {interim && (
              <div className={`ct-line ct-interim ct-${speaker}`}>
                <span className="ct-tag">{speaker === "customer" ? "お客様" : "スタッフ"}</span>
                <span className="ct-time">{timeLabel()}</span>
                <span className="ct-text">{interim}</span>
              </div>
            )}
          </div>

          {error && <div className="ct-error">{error}</div>}

          <div className="call-transcript-actions">
            {listening ? (
              <button className="btn sm danger" onClick={stopListening}>
                ■ 停止
              </button>
            ) : (
              <button className="btn sm" onClick={startListening}>
                ▶ 開始
              </button>
            )}
            <button className="btn sm gray" onClick={clearLines} disabled={!lines.length}>
              消去
            </button>
            <button className="btn sm gray" disabled title="録音機能は今後追加予定です">
              ⏺ 録音（準備中）
            </button>
          </div>
        </div>
      ) : (
        <button className="call-transcript-fab" onClick={() => setOpen(true)}>
          📞{listening && <span className="ct-fab-dot" />}
        </button>
      )}
    </div>
  );
}
