// PC幅（サイドバー常時表示になる900px以上）かどうかを判定する。
// PCではモーダルの背景（灰色部分）をクリックしても誤操作で閉じないよう、
// 閉じる処理はこの判定を通してから呼び出す。
export function isDesktopWidth() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches;
}

// モーダルの背景（.modal-overlay）のonClickにそのまま渡すためのラッパー。
// PC幅では何もせず、モバイル幅の時だけonCloseを呼ぶ。
export function overlayClose(onClose) {
  return () => {
    if (!isDesktopWidth()) onClose();
  };
}
