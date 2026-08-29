import { courseLabel, yen } from "../api.js";

function toMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minToHHMM(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 店舗ごとの速報カード。
 * props: store, todayRecords, tomorrowRecords, staffCounts({morning, evening})
 */
export default function QuickReport({ store, todayRecords, tomorrowRecords, staffCounts }) {
  const count = todayRecords.length;
  const sales = todayRecords.reduce((s, r) => s + Number(r.amount || 0), 0);
  const bookings = [...tomorrowRecords]
    .filter((r) => r.startTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="card quick-report-card">
      <strong>{store.name}　Recess速報</strong>

      <div className="qr-row">
        <span>施術人数</span>
        <span className="qr-value">{count} 名</span>
      </div>
      <div className="qr-row">
        <span>売上げ</span>
        <span className="qr-value">{yen(sales)}</span>
      </div>

      <div className="muted" style={{ fontSize: 12, margin: "10px 0 4px" }}>
        明日の予約
      </div>
      {bookings.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>
          まだ予約はありません
        </div>
      ) : (
        <ul className="qr-booking-list">
          {bookings.map((r) => {
            const start = toMin(r.startTime);
            const mins = r.course?.minutes || 60;
            const end = start !== null ? minToHHMM(start + mins) : "";
            return (
              <li key={r.id}>
                {r.startTime}〜{end}　{courseLabel(r.course)}　{r.customerName}様
              </li>
            );
          })}
        </ul>
      )}

      <div className="muted" style={{ fontSize: 12, margin: "10px 0 4px" }}>
        明日スタッフ（全店舗合計）
      </div>
      <div className="qr-row">
        <span>11:00〜15:00</span>
        <span className="qr-value">{staffCounts.morning} 人</span>
      </div>
      <div className="qr-row">
        <span>15:00〜23:00</span>
        <span className="qr-value">{staffCounts.evening} 人</span>
      </div>
    </div>
  );
}
