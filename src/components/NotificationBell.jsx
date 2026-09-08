import { useEffect, useState } from "react";
import { api } from "../api.js";

// base64url文字列をUint8Arrayに変換（PushManager.subscribeのapplicationServerKeyに必要）
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function NotificationBell({ variant = "icon" }) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        setSubscribed(!!existing);
      } catch (e) {
        setSupported(false);
      }
    })();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        alert("通知が許可されませんでした。端末の設定から通知を許可してください。");
        return;
      }
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

  if (!supported) {
    return variant === "button" ? (
      <p className="muted" style={{ fontSize: 12.5 }}>
        この端末（ブラウザ）はプッシュ通知に対応していません。
      </p>
    ) : null;
  }

  if (variant === "button") {
    return (
      <button
        className={subscribed ? "btn gray" : "btn"}
        disabled={busy}
        onClick={subscribed ? disable : enable}
      >
        {subscribed ? "🔔 通知をオフにする" : "🔕 通知をオンにする"}
      </button>
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
