import { useEffect, useState } from "react";
import { api } from "../api.js";

// base64url文字列をUint8Arrayに変換（PushManager.subscribeのapplicationServerKeyに必要）
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// 端末・ブラウザの状態を判定する（通知が使えない時に「何をすれば使えるか」を案内するため）
function detectEnv() {
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isInApp = /\bLine\/|FBAN|FBAV|Instagram|Twitter|MicroMessenger|YJApp/i.test(ua);
  const m = ua.match(/OS (\d+)_(\d+)/);
  const iosVersion = isIOS && m ? Number(m[1]) + Number(m[2]) / 100 : null;
  const pushApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return { isIOS, isAndroid, isStandalone, isInApp, iosVersion, pushApi };
}

// 使えない理由ごとの案内文
function UnsupportedGuide({ env }) {
  const box = { fontSize: 13, lineHeight: 1.8, margin: "6px 0 0", paddingLeft: 20 };
  if (env.isInApp) {
    return (
      <div>
        <p style={{ fontWeight: 700, margin: 0 }}>LINEなどのアプリ内ブラウザでは通知が使えません。</p>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          画面右上（または右下）のメニューから
          {env.isIOS ? "「Safariで開く」" : "「ブラウザで開く（Chrome）」"}
          を選んで開き直してください。
        </p>
      </div>
    );
  }
  if (env.isIOS && env.iosVersion !== null && env.iosVersion < 16.4) {
    return (
      <div>
        <p style={{ fontWeight: 700, margin: 0 }}>iOSのバージョンが古いため通知が使えません。</p>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          「設定」→「一般」→「ソフトウェアアップデート」でiOS 16.4以上に更新してください。
          （iPhone SE 第1世代・iPhone 7以前など、更新できない機種では使えません）
        </p>
      </div>
    );
  }
  if (env.isIOS && !env.isStandalone) {
    return (
      <div>
        <p style={{ fontWeight: 700, margin: 0 }}>
          iPhoneは「ホーム画面に追加」したアイコンから開くと通知が使えます。
        </p>
        <ol style={box}>
          <li>このページをSafariで開く</li>
          <li>画面下の共有ボタン（□に↑のマーク）をタップ</li>
          <li>「ホーム画面に追加」をタップ（「Webアプリとして開く」はオンのまま）→「追加」</li>
          <li>ホーム画面にできた「リラク管理」アイコンから開き直す</li>
          <li>もう一度ログインし、この「通知設定」で「通知をオンにする」を押す</li>
        </ol>
        <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
          ※ホーム画面のアイコンから開いた場合は、ログイン状態がSafariとは別になります。
        </p>
      </div>
    );
  }
  if (env.isAndroid) {
    return (
      <div>
        <p style={{ fontWeight: 700, margin: 0 }}>このブラウザでは通知が使えません。</p>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Google Chromeでこのページを開き直してください。（Chromeを最新版に更新するとより確実です）
        </p>
      </div>
    );
  }
  return (
    <div>
      <p style={{ fontWeight: 700, margin: 0 }}>このブラウザでは通知が使えません。</p>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
        iPhoneはSafari（ホーム画面に追加して開く）、AndroidやパソコンはGoogle Chromeの最新版で開いてください。
      </p>
    </div>
  );
}

// 「許可しない」を選んでしまった端末向けの案内
function DeniedGuide({ env }) {
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontWeight: 700, margin: 0, color: "#c0392b" }}>
        この端末では通知が「許可しない」になっています。
      </p>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 0", lineHeight: 1.8 }}>
        {env.isIOS
          ? "「設定」アプリ →「通知」→「リラク管理」→「通知を許可」をオンにしてから、もう一度このボタンを押してください。"
          : env.isAndroid
            ? "Chromeのアドレスバー左のアイコン →「権限」（または「サイトの設定」）→「通知」を「許可」にしてから、もう一度このボタンを押してください。それでも出ない場合は、端末の「設定」→「アプリ」→「Chrome」→「通知」もオンにしてください。"
            : "ブラウザのアドレスバー左の鍵アイコン →「通知」を「許可」にしてから、もう一度このボタンを押してください。"}
      </p>
    </div>
  );
}

export default function NotificationBell({ variant = "icon" }) {
  const [env] = useState(() => detectEnv());
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!env.pushApi) {
      setSupported(false);
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        setSubscribed(!!existing);
        // 既に購読済みならサーバー側にも登録し直しておく（サーバー側で消えていても復活させるため）
        if (existing && Notification.permission === "granted") {
          api.subscribePush(existing.toJSON()).catch(() => {});
        }
      } catch {
        setSupported(false);
      }
    })();
  }, [env]);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return; // 案内文（DeniedGuide）を画面に表示する
      const { publicKey } = await api.pushPublicKey();
      if (!publicKey) {
        alert("通知の設定がまだ完了していません。管理者に設定タブでの設定を依頼してください。");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.subscribePush(sub.toJSON());
      setSubscribed(true);
    } catch (e) {
      alert(`通知の有効化に失敗しました: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      alert(`通知の解除に失敗しました: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        alert("この端末はまだ通知がオンになっていません。");
        return;
      }
      await api.pushTest(sub.toJSON());
      alert("テスト通知を送りました。数秒以内に通知が届けばOKです。");
    } catch (e) {
      alert(`テスト通知の送信に失敗しました: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return variant === "button" ? <UnsupportedGuide env={env} /> : null;
  }

  if (variant === "button") {
    return (
      <div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className={subscribed ? "btn gray" : "btn"}
            disabled={busy}
            onClick={subscribed ? disable : enable}
          >
            {subscribed ? "🔔 通知をオフにする" : "🔕 通知をオンにする"}
          </button>
          {subscribed && (
            <button className="btn ghost" disabled={busy} onClick={sendTest}>
              📨 テスト通知を送る
            </button>
          )}
        </div>
        {subscribed && (
          <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
            この端末は通知オンです。
          </p>
        )}
        {!subscribed && permission === "denied" && <DeniedGuide env={env} />}
      </div>
    );
  }

  return (
    <button
      className="notif-bell"
      disabled={busy}
      onClick={subscribed ? disable : enable}
      title={subscribed ? "プッシュ通知：有効（タップで解除）" : "プッシュ通知を有効にする"}
    >
      {subscribed ? "🔔" : "🔕"}
    </button>
  );
}
