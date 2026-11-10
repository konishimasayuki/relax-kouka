// 印刷ボタン共通処理
// ・パソコン：今まで通りブラウザの印刷画面（window.print）
// ・スマホ：ホーム画面に追加したアプリ表示などでは window.print() が動かないことがあるため、
//   受付表・請求書をPDFにして「共有」から印刷・保存できるようにする

// 旧版 html2canvas 1.4.1 は iPhone の Safari が返す oklab() などの新しい色形式を読めずに失敗するため、
// それらに対応した後継版 html2canvas-pro を使う（使い方は同じ：window.html2canvas）
const HTML2CANVAS_URL =
  "https://cdn.jsdelivr.net/npm/html2canvas-pro@2.5.2/dist/html2canvas-pro.min.js";
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

// 撮影用のコピーを作る。
// 画面上の受付表はスマホだと「ページの途中にある」「枠の中で横スクロールされている」ため、
// そのまま撮影すると位置がずれて崩れる。コピーを画面左上の幅固定の枠に置いてから撮影する。
function makeCaptureClone(sheetEl) {
  const src = sheetEl.querySelector(".sheet") || sheetEl;
  const width = Math.max(src.scrollWidth, src.offsetWidth, 1080);
  const clone = src.cloneNode(true);

  // 入力欄・選択欄・チェックの「今の値」はコピーされないので移し替える
  const from = src.querySelectorAll("input, select, textarea");
  const to = clone.querySelectorAll("input, select, textarea");
  from.forEach((el, i) => {
    const t = to[i];
    if (!t) return;
    if (el.type === "checkbox" || el.type === "radio") {
      t.checked = el.checked;
      if (el.checked) t.setAttribute("checked", "");
      else t.removeAttribute("checked");
    } else if (el.tagName === "SELECT") {
      [...t.options].forEach((o, j) => {
        if (j === el.selectedIndex) o.setAttribute("selected", "");
        else o.removeAttribute("selected");
      });
      t.selectedIndex = el.selectedIndex;
    } else {
      t.value = el.value;
      t.setAttribute("value", el.value);
    }
  });

  const wrap = document.createElement("div");
  // reception-sheet / payroll-sheet のクラスは残して印刷用のCSSを効かせる（sheet-scrollの枠・横スクロールは外す）
  wrap.className = sheetEl.className.replace("sheet-scroll", "").trim() + " pdf-capture-wrap";
  wrap.style.cssText = `position:fixed;left:0;top:0;width:${width}px;background:#fff;z-index:-1;overflow:visible;margin:0;padding:0;border:none;box-shadow:none;`;
  wrap.appendChild(clone);
  document.body.appendChild(wrap);
  return { wrap, width };
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

    const savedScroll = { x: window.scrollX, y: window.scrollY };
    window.scrollTo(0, 0);
    for (let i = 0; i < sheets.length; i++) {
      const { wrap, width } = makeCaptureClone(sheets[i]);
      let canvas;
      try {
        canvas = await window.html2canvas(wrap, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: width,
        });
      } finally {
        wrap.remove();
      }
      const img = canvas.toDataURL("image/jpeg", 0.92);
      // 1枚のページに収まるよう縦横比を保って縮小
      const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      if (i > 0) pdf.addPage("a4", orientation);
      pdf.addImage(img, "JPEG", (pageW - w) / 2, margin, w, h);
    }
    window.scrollTo(savedScroll.x, savedScroll.y);

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
