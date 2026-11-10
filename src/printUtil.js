// 印刷ボタン共通処理
// ・パソコン：今まで通りブラウザの印刷画面（window.print）
// ・スマホ：ホーム画面に追加したアプリ表示などでは window.print() が動かないことがあるため、
//   受付表・請求書をPDFにして「共有」から印刷・保存できるようにする

const HTML2CANVAS_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

function isMobileDevice() {
  const ua = navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod|Android/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const loadedScripts = {};
function loadScript(src) {
  if (!loadedScripts[src]) {
    loadedScripts[src] = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = () => {
        delete loadedScripts[src];
        reject(new Error("PDF作成用の部品を読み込めませんでした（通信状況を確認してください）"));
      };
      document.head.appendChild(el);
    });
  }
  return loadedScripts[src];
}

// 画面上に小さな案内を出す（作成中…／共有ボタン）
function showOverlay(html) {
  let el = document.getElementById("pdf-print-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "pdf-print-overlay";
    el.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div style="background:#fff;border-radius:14px;padding:20px 18px;max-width:340px;width:100%;text-align:center;font-size:14px;line-height:1.7;box-shadow:0 8px 30px rgba(0,0,0,.25)">${html}</div>`;
  return el;
}
function closeOverlay() {
  document.getElementById("pdf-print-overlay")?.remove();
}

/**
 * @param {object} opts
 * @param {string} opts.selector     1ページにしたい要素（受付表1枚・請求書1枚）のセレクタ
 * @param {"portrait"|"landscape"} opts.orientation  A4の向き
 * @param {string} opts.fileName     保存するPDFファイル名
 */
export async function printSheets({ selector, orientation = "portrait", fileName = "print.pdf" }) {
  if (!isMobileDevice()) {
    window.print();
    return;
  }

  const sheets = [...document.querySelectorAll(selector)];
  if (sheets.length === 0) {
    alert("印刷する内容がありません");
    return;
  }

  showOverlay("PDFを作成しています…<br><span style='font-size:12px;color:#888'>数秒かかります</span>");
  document.body.classList.add("pdf-capture");
  try {
    await Promise.all([loadScript(HTML2CANVAS_URL), loadScript(JSPDF_URL)]);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 6;

    for (let i = 0; i < sheets.length; i++) {
      const target = sheets[i].querySelector(".sheet") || sheets[i];
      const canvas = await window.html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        windowWidth: Math.max(target.scrollWidth, 1100),
        width: target.scrollWidth,
        height: target.scrollHeight,
      });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      // 1枚のページに収まるよう縦横比を保って縮小
      const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      if (i > 0) pdf.addPage("a4", orientation);
      pdf.addImage(img, "JPEG", (pageW - w) / 2, margin, w, h);
    }

    const blob = pdf.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    // 共有は「ボタンを押した直後」でないと端末に拒否されるため、改めてボタンを押してもらう
    const el = showOverlay(`
      <div style="font-weight:700;font-size:15px;margin-bottom:6px">PDFができました（${sheets.length}枚）</div>
      <div style="font-size:12.5px;color:#666;margin-bottom:14px">「共有」→「プリント」で印刷、または「ファイルに保存」できます</div>
      <button id="pdf-share-btn" style="width:100%;padding:12px;border:none;border-radius:10px;background:#1f6feb;color:#fff;font-size:15px;font-weight:700;margin-bottom:8px">📤 共有・印刷する</button>
      <button id="pdf-close-btn" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:10px;background:#fff;font-size:14px">閉じる</button>
    `);
    el.querySelector("#pdf-close-btn").onclick = () => {
      URL.revokeObjectURL(url);
      closeOverlay();
    };
    el.querySelector("#pdf-share-btn").onclick = async () => {
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: fileName });
        } else {
          // 共有に対応していない端末：PDFを開く（開いた画面の共有ボタンから印刷できる）
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } catch (e) {
        if (e?.name !== "AbortError") alert(`共有できませんでした: ${e.message}`);
      }
    };
  } catch (e) {
    closeOverlay();
    alert(`PDFの作成に失敗しました: ${e.message}`);
  } finally {
    document.body.classList.remove("pdf-capture");
  }
}
