const ALL_HOURS = [...Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), "24"];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/**
 * 1分刻みの時刻入力（出勤・退勤時刻など、細かい修正が必要な場面用）。
 * TimeInput10と同じ使い方：props value("HH:MM"), onChange(value), className, minHour
 */
export default function TimeInput1({ value, onChange, className = "", minHour = 0 }) {
  const [h, m] = (value || "").split(":");
  const HOURS = ALL_HOURS.filter((x) => x === "24" || Number(x) >= minHour);

  const setHour = (nh) => onChange(nh && m ? `${nh}:${m}` : nh ? `${nh}:00` : "");
  const setMinute = (nm) => onChange(h ? `${h}:${nm || "00"}` : "");

  return (
    <span className={`time10 ${className}`}>
      <select value={h || ""} onChange={(e) => setHour(e.target.value)}>
        <option value="">--</option>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      ：
      <select value={m || ""} onChange={(e) => setMinute(e.target.value)}>
        <option value="">--</option>
        {MINUTES.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </span>
  );
}
