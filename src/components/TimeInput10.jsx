// 24時（終了時刻に残業などで24:00を指定できるように）も選べるようにする
const ALL_HOURS = [...Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), "24"];
const MINUTES = ["00", "10", "20", "30", "40", "50"];

/**
 * iOSのネイティブtime入力はstep属性を無視するため、
 * 時・分を別々のselectにして確実に10分刻みにする。
 * props: value("HH:MM"), onChange(value), className, minHour（この時より前の時間を選択肢から除外。既定0＝制限なし）
 */
export default function TimeInput10({ value, onChange, className = "", minHour = 0 }) {
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
