import { redis, saveItem } from "./_redis.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();
    const done = await redis.get("seed:done");
    if (done) return res.json({ seeded: false });

    const date = (req.body && req.body.date) || serverDate();

    const stores = [
      { name: "BODY RECESS（パレス2階）", building: "パレス", floor: "2F", beds: 7, active: true },
      { name: "BODY RECESS（宙館13階）", building: "宙館", floor: "13F", beds: 2, active: true },
      { name: "Spa the Ceada", building: "Ceada", floor: "", beds: 5, active: true },
    ];
    const savedStores = [];
    for (const s of stores) savedStores.push(await saveItem("store", s));

    const staff = [
      {
        name: "TEST三宅",
        loginId: "miyake",
        password: "1111",
        gender: "女",
        birthday: "1995-04-01",
        facial: true,
        pregnancy: true,
        active: true,
      },
      {
        name: "TEST佐藤",
        loginId: "sato",
        password: "2222",
        gender: "女",
        birthday: "1990-08-15",
        facial: false,
        pregnancy: false,
        active: true,
      },
      {
        name: "TEST竹田",
        loginId: "takeda",
        password: "3333",
        gender: "男",
        birthday: "1988-12-20",
        facial: true,
        pregnancy: false,
        active: true,
      },
    ];
    const savedStaff = [];
    for (const s of staff) savedStaff.push(await saveItem("staff", s));

    const custs = [
      {
        name: "TEST山田太郎",
        kana: "ヤマダタロウ",
        gender: "男",
        phone: "090-0000-0001",
        visits: 3,
        lastVisit: date,
      },
      {
        name: "TEST鈴木花子",
        kana: "スズキハナコ",
        gender: "女",
        phone: "090-0000-0002",
        visits: 1,
        lastVisit: date,
      },
    ];
    for (const c of custs) await saveItem("customer", c);

    const ns = `rec:${date}`;
    const recs = [
      {
        storeId: savedStores[0].id,
        bed: 1,
        customerName: "TEST山田",
        gender: "男",
        course: { code: "B", minutes: 60, parts: ["ho"] },
        staffId: savedStaff[0].id,
        startTime: "15:00",
        payment: "現金",
        amount: 5500,
        nominate: true,
      },
      {
        storeId: savedStores[2].id,
        bed: 1,
        customerName: "TEST鈴木",
        gender: "女",
        course: { code: "F", minutes: 40, parts: ["facial"] },
        staffId: savedStaff[0].id,
        startTime: "16:30",
        payment: "部屋付け",
        amount: 4400,
        room: "1014",
      },
      {
        storeId: savedStores[1].id,
        bed: 1,
        customerName: "TESTチャン",
        gender: "男",
        course: { code: "組", minutes: 90, parts: ["ho", "foot"] },
        staffId: savedStaff[1].id,
        startTime: "17:00",
        payment: "クレジット",
        amount: 9460,
      },
    ];
    for (const r of recs) await saveItem(ns, { ...r, date });

    await redis.set("seed:done", "1");
    return res.json({ seeded: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

function serverDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
