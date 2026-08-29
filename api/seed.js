import { redis, saveItem } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).end();
    const done = await redis.get("seed:done");
    if (done) return res.json({ seeded: false });

    const date = (req.body && req.body.date) || serverDate();

    const stores = [
      {
        name: "BODY RECESS（パレス2階）",
        building: "パレス",
        floor: "2F",
        beds: 7,
        active: true,
        isHome: true,
      },
      {
        name: "BODY RECESS（宙館13階）",
        building: "宙館",
        floor: "13F",
        beds: 2,
        active: true,
      },
      {
        name: "Spa the Ceada",
        building: "Ceada",
        floor: "",
        beds: 5,
        active: true,
      },
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
        isAdmin: true,
        commissionRate: 45,
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
        isAdmin: false,
        commissionRate: 45,
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
        isAdmin: false,
        commissionRate: 45,
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

    const menuDefs = [
      { storeId: savedStores[0].id, name: "ボディオイル", displayName: "オイル", minutes: 60, price: 5500, color: "blue" },
      { storeId: savedStores[0].id, name: "ボディオイル", displayName: "オイル", minutes: 90, price: 8000, color: "blue" },
      { storeId: savedStores[0].id, name: "フェイシャル", displayName: "顔", minutes: 40, price: 4400, color: "green" },
      { storeId: savedStores[1].id, name: "組み合わせ", displayName: "組合", minutes: 90, price: 9460, color: "purple" },
      { storeId: savedStores[2].id, name: "フェイシャル", displayName: "顔", minutes: 40, price: 4400, color: "green" },
    ];
    const savedMenus = [];
    for (const m of menuDefs) savedMenus.push(await saveItem("menu", m));

    const ns = `rec:${date}`;
    const recs = [
      {
        storeId: savedStores[0].id,
        bed: "1",
        customerName: "TEST山田",
        gender: "男",
        course: {
          menuId: savedMenus[0].id,
          name: savedMenus[0].name,
          displayName: savedMenus[0].displayName,
          minutes: savedMenus[0].minutes,
          color: savedMenus[0].color,
          parts: ["ho"],
        },
        staffId: savedStaff[0].id,
        startTime: "15:00",
        payment: "現金",
        amount: savedMenus[0].price,
        nominate: true,
      },
      {
        storeId: savedStores[2].id,
        bed: "1",
        customerName: "TEST鈴木",
        gender: "女",
        course: {
          menuId: savedMenus[4].id,
          name: savedMenus[4].name,
          displayName: savedMenus[4].displayName,
          minutes: savedMenus[4].minutes,
          color: savedMenus[4].color,
          parts: ["facial"],
        },
        staffId: savedStaff[0].id,
        startTime: "16:30",
        payment: "部屋付け",
        amount: savedMenus[4].price,
        room: "1014",
      },
      {
        storeId: savedStores[1].id,
        bed: "1",
        customerName: "TESTチャン",
        gender: "男",
        course: {
          menuId: savedMenus[3].id,
          name: savedMenus[3].name,
          displayName: savedMenus[3].displayName,
          minutes: savedMenus[3].minutes,
          color: savedMenus[3].color,
          parts: ["ho", "foot"],
        },
        staffId: savedStaff[1].id,
        startTime: "17:00",
        payment: "クレジット",
        amount: savedMenus[3].price,
      },
    ];
    for (const r of recs) await saveItem(ns, { ...r, date });

    const fortuneStaffDefs = [
      { name: "メグ", loginId: "megu", password: "1234" },
      { name: "リナ", loginId: "rina", password: "1234" },
      { name: "カノア", loginId: "kanoa", password: "1234" },
      { name: "つち", loginId: "tsuchi", password: "1234" },
    ];
    for (const s of fortuneStaffDefs) await saveItem("fortunestaff", s);

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
