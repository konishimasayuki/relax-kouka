import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { PAYMENTS, api, courseLabel } from "../api.js";

function emptyRecord(storeId, date) {
  return {
    id: "",
    date: date || "",
    storeId: storeId || "",
    bed: "",
    customerName: "",
    gender: "女",
    course: {
      menuId: "",
      name: "",
      displayName: "",
      minutes: "",
      color: "",
      freeText: "",
    },
    pregnancy: false,
    nominate: false,
    staffId: "",
    startTime: "",
    payment: "現金",
    paymentNote: "",
    receptionist: "",
    room: "",
    phone: "",
    amount: 0,
    note: "",
  };
}

// 新フィールド追加前の古いレコードを開いてもundefinedにならないようマージする
function normalizeRecord(r) {
  const base = emptyRecord(r.storeId, r.date);
  return { ...base, ...r, course: { ...base.course, ...(r.course || {}) } };
}

export default function ReceptionList() {
  const { stores, staff, menus, date, setDate, ready } = useApp();
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRecords(await api.reception(date));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    if (ready) load();
  }, [date, ready]);

  // シフト（出勤スタッフ判定用）は全体を一括取得
  useEffect(() => {
    if (ready) api.shifts().then(setShifts).catch(() => {});
  }, [ready]);

  // 全店舗まとめて、開始時間順で1枚のシートに
  const view = useMemo(
    () =>
      [...records].sort((a, b) => {
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      }),
    [records],
  );

  const total = useMemo(
    () => view.reduce((s, r) => s + Number(r.amount || 0), 0),
    [view],
  );

  const save = async () => {
    if (!form.customerName.trim()) return alert("お客様名を入力してください");
    if (!form.date) return alert("施術日を入力してください");
    setBusy(true);
    try {
      const { _originalDate, ...payload } = form;
      await api.saveReception(payload);
      // 編集で施術日を変更した場合は、元の日付側のデータを削除して移動させる
      if (form.id && _originalDate && _originalDate !== form.date) {
        await api.deleteReception(form.id, _originalDate);
      }
      await load();
      setForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const del = async (id, recordDate) => {
    if (!confirm("この受付を削除しますか？")) return false;
    await api.deleteReception(id, recordDate || date);
    await load();
    return true;
  };

  const staffName = (id) => staff.find((s) => s.id === id)?.name || "";
  const storeMenus = useMemo(
    () => menus.filter((m) => m.storeId === form?.storeId),
    [menus, form?.storeId],
  );

  // 施術日にシフト登録されているスタッフのみ担当に選べるようにする
  const workingStaffIds = useMemo(() => {
    if (!form?.date) return [];
    return [...new Set(shifts.filter((s) => s.date === form.date).map((s) => s.staffId))];
  }, [shifts, form?.date]);

  const assignableStaff = useMemo(
    () =>
      staff.filter(
        (s) => s.active && (workingStaffIds.includes(s.id) || s.id === form?.staffId),
      ),
    [staff, workingStaffIds, form?.staffId],
  );

  // 店舗を変更したら、その店舗のメニューに合わせてコース選択をリセット
  const changeStore = (storeId) => {
    setForm({
      ...form,
      storeId,
      course: { ...form.course, menuId: "", name: "", displayName: "", minutes: "", color: "" },
    });
  };

  // メニューを選んだら、コース名・表示名・時間・色・金額を自動反映（金額は後から編集・消去可）
  const selectMenu = (menuId) => {
    const m = menus.find((x) => x.id === menuId);
    if (!m) {
      setForm({
        ...form,
        course: { ...form.course, menuId: "", name: "", displayName: "", minutes: "", color: "" },
      });
      return;
    }
    setForm({
      ...form,
      course: {
        ...form.course,
        menuId: m.id,
        name: m.name,
        displayName: m.displayName,
        minutes: m.minutes,
        color: m.color,
      },
      amount: m.price,
    });
  };

  // ---- 紙の受付表の再現用 ----
  const [yy, mm, dd] = date.split("-").map(Number);
  const reiwaYear = yy - 2018;
  const youbi = "日月火水木金土"[new Date(yy, mm - 1, dd).getDay()];
  const sheetRows = Math.max(20, view.length);
  const cashList = view.filter((r) => r.payment === "現金");
  const roomList = view.filter((r) => r.payment === "部屋付け");
  const sumOf = (list) => list.reduce((s, r) => s + Number(r.amount || 0), 0);
  const num = (n) => Number(n || 0).toLocaleString("ja-JP");

  const genderCell = (g) => (
    <>
      <span className={g === "男" ? "circled" : ""}>男</span>・
      <span className={g === "女" ? "circled" : ""}>女</span>
    </>
  );

  const payCell = (r) => (
    <>
      <span className={r.payment === "現金" ? "circled" : ""}>現</span>・
      <span className={r.payment === "部屋付け" ? "circled" : ""}>部</span>・
      <span className={r.payment === "クレジット" ? "circled" : ""}>クレ</span>
      {r.payment === "QR" && <span className="circled pay-extra">QR</span>}
      {r.payment === "その他" && <span className="circled pay-extra">{r.paymentNote || "他"}</span>}
    </>
  );

  return (
    <div>
      <div className="page-head">
        <h2>受付一覧表</h2>
      </div>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn sm" onClick={() => setForm(emptyRecord(stores[0]?.id, date))}>
          ＋ 受付追加
        </button>
      </div>

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : (
        <div className="sheet-scroll">
          <div className="sheet">
            <div className="sheet-head">
              <span className="sheet-title">Body Recess　受付表</span>
              <span>
                客数 <span className="ink-red">{view.length}</span> 名（内子供
                <span className="fill-blank" /> 名）　インバウンド
                <span className="fill-blank" /> 名
              </span>
              <span>
                令和 <span className="ink-red">{reiwaYear}</span> 年{" "}
                <span className="ink-red">{mm}</span> 月 <span className="ink-red">{dd}</span> 日（
                <span className="ink-red">{youbi}</span>）　NO. <span className="ink-red">1</span>
              </span>
            </div>

            <table className="sheet-table">
              <thead>
                <tr>
                  <th>
                    終了
                    <br />
                    チェック
                  </th>
                  <th>日付</th>
                  <th>NO</th>
                  <th>
                    ベッド
                    <br />
                    NO
                  </th>
                  <th>氏名</th>
                  <th>性別</th>
                  <th>コース</th>
                  <th>
                    クーポン
                    <br />
                    チェック
                  </th>
                  <th>指名</th>
                  <th>キャッチ</th>
                  <th>担当</th>
                  <th>開始時間</th>
                  <th>支払方法</th>
                  <th>受付者</th>
                  <th>部屋番号</th>
                  <th>電話番号</th>
                  <th>金額</th>
                  <th>
                    現金金額／釣銭
                    <br />
                    受領担当
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: sheetRows }, (_, i) => {
                  const r = view[i];
                  return (
                    <tr
                      key={r ? r.id : `empty-${i}`}
                      onClick={() =>
                        setForm(
                          r
                            ? { ...normalizeRecord(r), _originalDate: r.date }
                            : emptyRecord(stores[0]?.id, date),
                        )
                      }
                    >
                      <td className="c-center" />
                      <td className="c-center ink-red">{i === 0 ? `${mm}/${dd}` : ""}</td>
                      <td className="c-center c-no">{i + 1}</td>
                      <td className="c-center">{r?.bed || ""}</td>
                      <td className="c-name">
                        <div className="cell">
                          <span className="nm">{r?.customerName || ""}</span>
                          <span className="printed">様</span>
                        </div>
                      </td>
                      <td className="c-center printed">{genderCell(r?.gender || "")}</td>
                      <td className="c-course">
                        {r ? courseLabel(r.course) : ""}
                        {r?.pregnancy && <span className="printed">（妊）</span>}
                      </td>
                      <td className="c-center" />
                      <td className="c-center">{r?.nominate ? "○" : ""}</td>
                      <td className="c-center" />
                      <td className="c-center">{r ? staffName(r.staffId) : ""}</td>
                      <td className="c-center">
                        {r?.startTime || <span className="printed">：</span>}
                      </td>
                      <td className="c-center printed">{payCell(r || { payment: "" })}</td>
                      <td className="c-center">{r?.receptionist || ""}</td>
                      <td className="c-center">{r?.room || ""}</td>
                      <td className="c-center">{r?.phone || ""}</td>
                      <td className="c-amount ink-red">{r?.amount ? num(r.amount) : ""}</td>
                      <td className="c-center" />
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="sheet-foot">
              <div className="sf-left">
                <div>
                  青伝③（<span className="fill-blank" />）枚　合計（
                  <span className="fill-blank w" />）円
                </div>
                <div>
                  宙店（<span className="fill-blank" />）名　合計（
                  <span className="fill-blank w" />）円
                </div>
                <div>
                  レジ金５万チェック（<span className="fill-blank" />）Ｗチェック（
                  <span className="fill-blank" />）
                </div>
                <div>
                  通帳入金チェック（<span className="fill-blank" />）日　計　表（
                  <span className="fill-blank" />）
                </div>
                <div>
                  中間の現金チェック（<span className="fill-blank" />）時（
                  <span className="fill-blank" />）分
                </div>
              </div>
              <div className="sf-sign">サイン</div>
              <div className="sf-check">
                <div className="sf-check-head">リスト（磁石）確認</div>
                <div>時　担当</div>
                <div>時　担当</div>
                <div>時　担当</div>
                <div>時　担当</div>
              </div>
              <div className="sf-total">
                <div>
                  <span>現金</span>
                  <span>
                    <span className="ink-red">{cashList.length}</span> 件
                  </span>
                  <span>
                    <span className="ink-red">{num(sumOf(cashList))}</span> 円
                  </span>
                </div>
                <div>
                  <span>部屋掛け</span>
                  <span>
                    <span className="ink-red">{roomList.length}</span> 件
                  </span>
                  <span>
                    <span className="ink-red">{num(sumOf(roomList))}</span> 円
                  </span>
                </div>
                <div>
                  <span>合計</span>
                  <span>
                    <span className="ink-red">{view.length}</span> 件
                  </span>
                  <span>
                    <span className="ink-red">{num(total)}</span> 円
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal reception-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{form.id ? "受付を編集" : "受付を追加"}</h3>
              <button type="button" className="modal-close" onClick={() => setForm(null)} aria-label="閉じる">
                ✕
              </button>
            </div>

            <div className="row">
              <div className="field">
                <label>施術日</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="field">
                <label>開始時間</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>店舗</label>
                <select value={form.storeId} onChange={(e) => changeStore(e.target.value)}>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>ベッド</label>
                <input
                  value={form.bed}
                  onChange={(e) => setForm({ ...form, bed: e.target.value })}
                  placeholder="例：1 / オイルベッド"
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>お客様名</label>
                <input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>性別</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="女">女</option>
                  <option value="男">男</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>コース</label>
              {storeMenus.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  この店舗のコースがまだ登録されていません（料金タブで登録してください）
                </div>
              ) : (
                <select value={form.course.menuId} onChange={(e) => selectMenu(e.target.value)}>
                  <option value="">選択してください</option>
                  {storeMenus.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}（{m.minutes}分・{yen(m.price)}）
                    </option>
                  ))}
                </select>
              )}
              <input
                style={{ marginTop: 8 }}
                value={form.course.freeText}
                onChange={(e) =>
                  setForm({ ...form, course: { ...form.course, freeText: e.target.value } })
                }
                placeholder="コース自由記述（入力するとこちらが優先表示されます）"
              />
            </div>

            <div className="field">
              <div className="checks">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.nominate}
                    onChange={(e) => setForm({ ...form, nominate: e.target.checked })}
                  />
                  指名
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.pregnancy}
                    onChange={(e) => setForm({ ...form, pregnancy: e.target.checked })}
                  />
                  妊婦
                </label>
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>担当スタッフ</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                >
                  <option value="">未定</option>
                  {assignableStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {form.date && workingStaffIds.length === 0 && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    この日のシフト登録がありません（シフトタブで登録してください）
                  </div>
                )}
              </div>
              <div className="field">
                <label>金額</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>支払方法</label>
                <select
                  value={form.payment}
                  onChange={(e) => setForm({ ...form, payment: e.target.value })}
                >
                  {PAYMENTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              {form.payment === "その他" && (
                <div className="field">
                  <label>支払方法（自由記述）</label>
                  <input
                    value={form.paymentNote}
                    onChange={(e) => setForm({ ...form, paymentNote: e.target.value })}
                    placeholder="例：PayPay"
                  />
                </div>
              )}
            </div>

            <div className="row">
              <div className="field">
                <label>部屋番号</label>
                <input
                  value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                />
              </div>
              <div className="field">
                <label>携帯番号</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>受付者 / メモ</label>
              <input
                value={form.receptionist}
                onChange={(e) => setForm({ ...form, receptionist: e.target.value })}
                placeholder="受付者"
                style={{ marginBottom: 8 }}
              />
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="メモ"
              />
            </div>

            <div className="modal-actions">
              <button className="btn gray" onClick={() => setForm(null)}>
                キャンセル
              </button>
              {form.id && (
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={async () => {
                    if (await del(form.id, form._originalDate || form.date)) setForm(null);
                  }}
                >
                  削除
                </button>
              )}
              <button className="btn" onClick={save} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
