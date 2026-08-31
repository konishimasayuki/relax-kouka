import { useEffect, useState } from "react";
import { useApp } from "../App.jsx";
import { COURSE_COLORS, api, sortByOrder, yen } from "../api.js";
import { overlayClose } from "../modalUtils.js";

function emptyMenu(storeId) {
  return {
    id: "",
    storeId: storeId || "",
    name: "",
    displayName: "",
    minutes: 60,
    price: 0,
    color: "blue",
    order: 0,
  };
}

function emptyExtension(storeId) {
  return {
    id: "",
    storeId: storeId || "",
    name: "",
    displayName: "",
    minutes: 10,
    price: 0,
    color: "blue",
    order: 0,
  };
}

function emptyOption(storeId) {
  return {
    id: "",
    storeId: storeId || "",
    name: "",
    displayName: "",
    minutes: 10,
    price: 0,
    color: "blue",
    order: 0,
  };
}

export default function Pricing() {
  const { stores, menus, options, extensions, refreshMaster, isAdminUser } = useApp();
  const [storeId, setStoreId] = useState("");
  const [tab, setTab] = useState("course");
  const [form, setForm] = useState(null);
  const [optionForm, setOptionForm] = useState(null);
  const [extensionForm, setExtensionForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (stores.length && !storeId) setStoreId(stores[0].id);
  }, [stores, storeId]);

  const list = sortByOrder(menus.filter((m) => m.storeId === storeId));
  const optionList = sortByOrder(options.filter((o) => o.storeId === storeId));
  const extensionList = sortByOrder(extensions.filter((e) => e.storeId === storeId));

  // 隣同士のorderを入れ替えて並び替える
  const moveMenu = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const a = list[index];
    const b = list[target];
    setBusy(true);
    try {
      await Promise.all([
        api.saveMenu({ ...a, order: b.order ?? target }),
        api.saveMenu({ ...b, order: a.order ?? index }),
      ]);
      await refreshMaster();
    } catch (e) {
      alert(`並び替え失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const moveOption = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= optionList.length) return;
    const a = optionList[index];
    const b = optionList[target];
    setBusy(true);
    try {
      await Promise.all([
        api.saveOption({ ...a, order: b.order ?? target }),
        api.saveOption({ ...b, order: a.order ?? index }),
      ]);
      await refreshMaster();
    } catch (e) {
      alert(`並び替え失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const moveExtension = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= extensionList.length) return;
    const a = extensionList[index];
    const b = extensionList[target];
    setBusy(true);
    try {
      await Promise.all([
        api.saveExtension({ ...a, order: b.order ?? target }),
        api.saveExtension({ ...b, order: a.order ?? index }),
      ]);
      await refreshMaster();
    } catch (e) {
      alert(`並び替え失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const saveExtension = async () => {
    if (!extensionForm.name.trim()) return alert("延長名を入力してください");
    setBusy(true);
    try {
      const payload = extensionForm.id
        ? extensionForm
        : {
            ...extensionForm,
            order: extensionList.length
              ? Math.max(...extensionList.map((e, i) => e.order ?? i)) + 1
              : 0,
          };
      await api.saveExtension(payload);
      await refreshMaster();
      setExtensionForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delExtension = async (id) => {
    if (!confirm("この延長料金を削除しますか？")) return;
    await api.deleteExtension(id);
    await refreshMaster();
  };

  const save = async () => {
    if (!form.name.trim()) return alert("コース名を入力してください");
    setBusy(true);
    try {
      // 新規追加時は末尾に並ぶよう、現在の最大orderの次の値を割り当てる
      const payload = form.id
        ? form
        : { ...form, order: list.length ? Math.max(...list.map((m, i) => m.order ?? i)) + 1 : 0 };
      await api.saveMenu(payload);
      await refreshMaster();
      setForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const del = async (id) => {
    if (!confirm("このコースを削除しますか？")) return;
    await api.deleteMenu(id);
    await refreshMaster();
  };

  const saveOption = async () => {
    if (!optionForm.name.trim()) return alert("オプション名を入力してください");
    setBusy(true);
    try {
      const payload = optionForm.id
        ? optionForm
        : {
            ...optionForm,
            order: optionList.length
              ? Math.max(...optionList.map((o, i) => o.order ?? i)) + 1
              : 0,
          };
      await api.saveOption(payload);
      await refreshMaster();
      setOptionForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delOption = async (id) => {
    if (!confirm("このオプションを削除しますか？")) return;
    await api.deleteOption(id);
    await refreshMaster();
  };

  const colorOf = (key) => COURSE_COLORS.find((c) => c.key === key);

  return (
    <div>
      <div className="page-head">
        <h2>料金</h2>
      </div>

      <div className="toolbar">
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className={tab === "course" ? "btn sm" : "btn sm gray"}
          onClick={() => setTab("course")}
        >
          コース
        </button>
        <button
          className={tab === "option" ? "btn sm" : "btn sm gray"}
          onClick={() => setTab("option")}
        >
          オプション
        </button>
        <button
          className={tab === "extension" ? "btn sm" : "btn sm gray"}
          onClick={() => setTab("extension")}
        >
          延長
        </button>
      </div>

      {tab === "course" && (
        <div>
          <div className="toolbar">
            <button className="btn sm" onClick={() => setForm(emptyMenu(storeId))}>
              ＋ コース追加
            </button>
          </div>

          {list.length === 0 ? (
            <div className="empty">この店舗のコースがまだ登録されていません</div>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>色</th>
                    <th>コース名</th>
                    <th>表示名</th>
                    <th className="num">時間</th>
                    <th className="num">料金</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((m, i) => (
                    <tr key={m.id}>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            background: colorOf(m.color)?.hex || "#999",
                          }}
                        />
                      </td>
                      <td>{m.name}</td>
                      <td>{m.displayName || <span className="muted">—</span>}</td>
                      <td className="num">{m.minutes}分</td>
                      <td className="num">{yen(m.price)}</td>
                      <td>
                        <button
                          className="btn sm gray"
                          style={{ padding: "2px 8px" }}
                          onClick={() => moveMenu(i, -1)}
                          disabled={i === 0 || busy}
                        >
                          ▲
                        </button>{" "}
                        <button
                          className="btn sm gray"
                          style={{ padding: "2px 8px" }}
                          onClick={() => moveMenu(i, 1)}
                          disabled={i === list.length - 1 || busy}
                        >
                          ▼
                        </button>{" "}
                        <button className="btn sm ghost" onClick={() => setForm({ ...m })}>
                          編集
                        </button>{" "}
                        {isAdminUser && (
                          <button className="btn sm danger" onClick={() => del(m.id)}>
                            削除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "option" && (
        <div>
          <div className="toolbar">
            <button className="btn sm" onClick={() => setOptionForm(emptyOption(storeId))}>
              ＋ オプション追加
            </button>
          </div>

          {optionList.length === 0 ? (
            <div className="empty">この店舗のオプションがまだ登録されていません</div>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>色</th>
                    <th>オプション名</th>
                    <th>表示名</th>
                    <th className="num">時間</th>
                    <th className="num">料金</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {optionList.map((o, i) => (
                    <tr key={o.id}>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            background: colorOf(o.color)?.hex || "#999",
                          }}
                        />
                      </td>
                      <td>{o.name}</td>
                      <td>{o.displayName || <span className="muted">—</span>}</td>
                      <td className="num">{o.minutes}分</td>
                      <td className="num">{yen(o.price)}</td>
                      <td>
                        <button
                          className="btn sm gray"
                          style={{ padding: "2px 8px" }}
                          onClick={() => moveOption(i, -1)}
                          disabled={i === 0 || busy}
                        >
                          ▲
                        </button>{" "}
                        <button
                          className="btn sm gray"
                          style={{ padding: "2px 8px" }}
                          onClick={() => moveOption(i, 1)}
                          disabled={i === optionList.length - 1 || busy}
                        >
                          ▼
                        </button>{" "}
                        <button className="btn sm ghost" onClick={() => setOptionForm({ ...o })}>
                          編集
                        </button>{" "}
                        {isAdminUser && (
                          <button className="btn sm danger" onClick={() => delOption(o.id)}>
                            削除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            ※ オプションは受付登録時にコースへ追加でき、時間・料金がコースに合算されます（例：40分コース＋20分オプション＝60分施術）。
          </div>
        </div>
      )}

      {tab === "extension" && (
        <div>
          <div className="toolbar">
            <button className="btn sm" onClick={() => setExtensionForm(emptyExtension(storeId))}>
              ＋ 延長を追加
            </button>
          </div>

          {extensionList.length === 0 ? (
            <div className="empty">この店舗の延長料金がまだ登録されていません</div>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>色</th>
                    <th>延長名</th>
                    <th>表示名</th>
                    <th className="num">時間</th>
                    <th className="num">料金</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {extensionList.map((e, i) => (
                    <tr key={e.id}>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            background: colorOf(e.color)?.hex || "#999",
                          }}
                        />
                      </td>
                      <td>{e.name}</td>
                      <td>{e.displayName || <span className="muted">—</span>}</td>
                      <td className="num">{e.minutes}分</td>
                      <td className="num">{yen(e.price)}</td>
                      <td>
                        <button
                          className="btn sm gray"
                          style={{ padding: "2px 8px" }}
                          onClick={() => moveExtension(i, -1)}
                          disabled={i === 0 || busy}
                        >
                          ▲
                        </button>{" "}
                        <button
                          className="btn sm gray"
                          style={{ padding: "2px 8px" }}
                          onClick={() => moveExtension(i, 1)}
                          disabled={i === extensionList.length - 1 || busy}
                        >
                          ▼
                        </button>{" "}
                        <button className="btn sm ghost" onClick={() => setExtensionForm({ ...e })}>
                          編集
                        </button>{" "}
                        {isAdminUser && (
                          <button className="btn sm danger" onClick={() => delExtension(e.id)}>
                            削除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            ※ 延長は受付登録時にコースへ追加でき、時間・料金がコースに合算されます。
          </div>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={overlayClose(() => setForm(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{form.id ? "コースを編集" : "コースを追加"}</h3>
            <div className="field">
              <label>店舗</label>
              <select
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>コース名</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例：オイルリンパ"
              />
            </div>
            <div className="field">
              <label>表示名（タイムボードに表示する名前）</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="例：オイル（空欄ならコース名を表示）"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>時間（分）</label>
                <input
                  type="number"
                  value={form.minutes}
                  onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>料金</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="field">
              <label>色（タイムボードの表示色）</label>
              <div className="checks">
                {COURSE_COLORS.map((c) => (
                  <label
                    className="check"
                    key={c.key}
                    style={{
                      border:
                        form.color === c.key ? `2px solid ${c.hex}` : "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "4px 10px",
                    }}
                  >
                    <input
                      type="radio"
                      name="course-color"
                      checked={form.color === c.key}
                      onChange={() => setForm({ ...form, color: c.key })}
                    />
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: c.hex,
                        marginRight: 2,
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={save} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {optionForm && (
        <div className="modal-overlay" onClick={overlayClose(() => setOptionForm(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{optionForm.id ? "オプションを編集" : "オプションを追加"}</h3>
            <div className="field">
              <label>店舗</label>
              <select
                value={optionForm.storeId}
                onChange={(e) => setOptionForm({ ...optionForm, storeId: e.target.value })}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>オプション名</label>
              <input
                value={optionForm.name}
                onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                placeholder="例：背中集中"
              />
            </div>
            <div className="field">
              <label>表示名（タイムボードに表示する名前）</label>
              <input
                value={optionForm.displayName}
                onChange={(e) => setOptionForm({ ...optionForm, displayName: e.target.value })}
                placeholder="例：背中（空欄ならオプション名を表示）"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>時間（分）</label>
                <input
                  type="number"
                  value={optionForm.minutes}
                  onChange={(e) =>
                    setOptionForm({ ...optionForm, minutes: Number(e.target.value) })
                  }
                />
              </div>
              <div className="field">
                <label>料金</label>
                <input
                  type="number"
                  value={optionForm.price}
                  onChange={(e) => setOptionForm({ ...optionForm, price: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="field">
              <label>色（タイムボードの表示色）</label>
              <div className="checks">
                {COURSE_COLORS.map((c) => (
                  <label
                    className="check"
                    key={c.key}
                    style={{
                      border:
                        optionForm.color === c.key
                          ? `2px solid ${c.hex}`
                          : "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "4px 10px",
                    }}
                  >
                    <input
                      type="radio"
                      name="option-color"
                      checked={optionForm.color === c.key}
                      onChange={() => setOptionForm({ ...optionForm, color: c.key })}
                    />
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: c.hex,
                        marginRight: 2,
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setOptionForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveOption} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {extensionForm && (
        <div className="modal-overlay" onClick={overlayClose(() => setExtensionForm(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{extensionForm.id ? "延長を編集" : "延長を追加"}</h3>
            <div className="field">
              <label>店舗</label>
              <select
                value={extensionForm.storeId}
                onChange={(e) => setExtensionForm({ ...extensionForm, storeId: e.target.value })}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>延長名</label>
              <input
                value={extensionForm.name}
                onChange={(e) => setExtensionForm({ ...extensionForm, name: e.target.value })}
                placeholder="例：10分延長"
              />
            </div>
            <div className="field">
              <label>表示名（タイムボードに表示する名前）</label>
              <input
                value={extensionForm.displayName}
                onChange={(e) =>
                  setExtensionForm({ ...extensionForm, displayName: e.target.value })
                }
                placeholder="例：延長（空欄なら延長名を表示）"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>時間（分）</label>
                <input
                  type="number"
                  value={extensionForm.minutes}
                  onChange={(e) =>
                    setExtensionForm({ ...extensionForm, minutes: Number(e.target.value) })
                  }
                />
              </div>
              <div className="field">
                <label>料金</label>
                <input
                  type="number"
                  value={extensionForm.price}
                  onChange={(e) =>
                    setExtensionForm({ ...extensionForm, price: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label>色（タイムボードの表示色）</label>
              <div className="checks">
                {COURSE_COLORS.map((c) => (
                  <label
                    className="check"
                    key={c.key}
                    style={{
                      border:
                        extensionForm.color === c.key
                          ? `2px solid ${c.hex}`
                          : "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "4px 10px",
                    }}
                  >
                    <input
                      type="radio"
                      name="extension-color"
                      checked={extensionForm.color === c.key}
                      onChange={() => setExtensionForm({ ...extensionForm, color: c.key })}
                    />
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: c.hex,
                        marginRight: 2,
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setExtensionForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveExtension} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
