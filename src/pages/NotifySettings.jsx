import BookingStopPanel from "../components/BookingStopPanel.jsx";
import NotificationBell from "../components/NotificationBell.jsx";

// 管理者専用の「設定」ページとは別に、占い師個人ログイン・一般スタッフも含めて
// 誰でもアクセスできる、プッシュ通知のオン/オフだけに絞った軽量ページ。
export default function NotifySettings() {
  return (
    <div>
      <div className="page-head">
        <h2>通知設定</h2>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>プッシュ通知設定</h3>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          予約申請が届いた際など、通知を有効にした端末へアプリ通知が届きます。
          この端末での通知を、下のボタンでオン・オフできます。
        </p>

        <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
          <NotificationBell variant="button" />
        </div>

        <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>
          オン・オフはこの画面を開いた端末ごとに個別に切り替わります。他のスタッフの端末には影響しません。
          iPhoneの場合は「ホーム画面に追加」した状態（iOS16.4以降）でないと通知が届きません。
        </p>
      </div>

      <BookingStopPanel />
    </div>
  );
}
