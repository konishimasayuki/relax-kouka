import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { computeBusyRanges, computeFreeGaps, homeBuildingOf, toMin } from "../staffSchedule.js";

const HOUR_START = 11;
const HOUR_END = 24;

function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function SignageCongestion() {
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [config, setConfig] = useState({ refreshSec: 20, durationTiers: [30, 60, 90] });
  const [now, setNow] = useState(nowMin());
  const timerRef = useRef(null);

  const fetchAll = async () => {
    try {
      const dateStr = todayStr();
      const [st, sf, rec, sh, cfg] = await Promise.all([
        api.stores(),
        api.staff(),
        api.reception(dateStr),
        api.shifts(),
        api.signageConfig().catch(() => null),
      ]);
      setStores(st);
      setStaff(sf);
      setRecords(rec);
      setShifts(sh.filter((s) => s.date === dateStr));
      if (cfg) setConfig(cfg);
      setNow(nowMin());
    } catch {
      // サイネージは無人運用のため、通信エラーは表示を維持したまま次回更新を待つ
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchAll, (config.refreshSec || 20) * 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [config.refreshSec]);

  const homeBuilding = homeBuildingOf(stores);

  // 出勤しているスタッフ（店舗をまたいで全員）
  const staffIdsToday = Array.from(
    new Set([
      ...shifts.map((s) => s.staffId),
      ...records.filter((r) => r.staffId).map((r) => r.staffId),
    ]),
  );

  // スタッフごとの busy 区間・空き区間・シフト範囲
  const rows = staffIdsToday.map((staffId) => {
    const apps = records
      .filter((r) => r.staffId === staffId && r.startTime)
      .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    const busy = computeBusyRanges(apps, stores, homeBuilding);
    const staffShifts = shifts.filter((s) => s.staffId === staffId);
    const shiftEnd = staffShifts.length
      ? Math.max(...staffShifts.map((s) => toMin(s.end)))
      : HOUR_END * 60;
    const rangeStart = Math.max(now, HOUR_START * 60);
    const freeGaps = computeFreeGaps(busy, rangeStart, Math.min(shiftEnd, HOUR_END * 60));
    return { staffId, busy, freeGaps, shiftEnd };
  });

  // 案内可能人数（設定された分数ごとに、今すぐその長さの空きがあるスタッフの人数）
  const tierCounts = (config.durationTiers || [30, 60, 90]).map((mins) => {
    const count = rows.filter((r) => r.freeGaps.some((g) => g.end - g.start >= mins)).length;
    return { mins, count };
  });

  const totalMin = (HOUR_END - HOUR_START) * 60;
  const nowClamped = Math.max(HOUR_START * 60, Math.min(now, HOUR_END * 60));
  const pct = (min) => ((min - HOUR_START * 60) / totalMin) * 100;

  return (
    <div className="signage-congestion">
      <div className="signage-head">
        <div className="signage-time">
          {String(new Date().getHours()).padStart(2, "0")}:
          {String(new Date().getMinutes()).padStart(2, "0")} 現在
        </div>
        <div className="signage-title">ご案内可能状況</div>
      </div>

      <div className="signage-tiers">
        {tierCounts.map((t) => (
          <div className="signage-tier" key={t.mins}>
            <div className="signage-tier-mins">{t.mins}分コース</div>
            <div className="signage-tier-count">
              {t.count > 0 ? (
                <>
                  <span className="num">{t.count}</span>
                  <span className="unit">名 案内可能</span>
                </>
              ) : (
                <span className="none">満席</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="signage-grid-wrap">
        <div className="signage-grid-head">
          {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((h) => (
            <div key={h} className="signage-grid-hour" style={{ left: `${pct(h * 60)}%` }}>
              {h}
            </div>
          ))}
        </div>
        <div className="signage-grid-body">
          <div className="signage-now-line" style={{ left: `${pct(nowClamped)}%` }} />
          {rows.map((r) => (
            <div className="signage-grid-row" key={r.staffId}>
              {r.busy
                .filter((b) => b.end > now)
                .map((b, i) => {
                  const start = Math.max(b.start, HOUR_START * 60);
                  const end = Math.min(b.end, HOUR_END * 60);
                  if (end <= start) return null;
                  return (
                    <div
                      key={i}
                      className="signage-block busy"
                      style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }}
                    />
                  );
                })}
              {/* シフト終了以降は受付不可としてグレー表示 */}
              <div
                className="signage-block offduty"
                style={{
                  left: `${pct(Math.min(r.shiftEnd, HOUR_END * 60))}%`,
                  width: `${100 - pct(Math.min(r.shiftEnd, HOUR_END * 60))}%`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="signage-legend">
        <span>
          <i className="dot busy" /> ご案内中／移動
        </span>
        <span>
          <i className="dot free" /> 空き
        </span>
      </div>
    </div>
  );
}
