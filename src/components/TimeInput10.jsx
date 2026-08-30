// 24時（終了時刻に残業などで24:00を指定できるように）も選べるようにする
const HOURS = [...Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), "24"];
const MINUTES = ["00", "10", "20", "30", "40", "50"];

/**
 * iOSのネイティブtime入力はstep属性を無視するため、
 * 時・分を別々のselectにして確実に10分刻みにする。
 * props: value("HH:MM"), onChange(value), className
 */
export default function TimeInput10({ value, onChange, className = "" }) {
  const [h, m] = (value || "").split(":");

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
