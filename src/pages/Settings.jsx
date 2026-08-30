import { useEffect, useState } from "react";
import { useApp } from "../App.jsx";
import { api } from "../api.js";

const emptyStore = {
  id: "",
  name: "",
  building: "",
  floor: "",
  beds: 3,
  active: true,
  isHome: false,
};
const emptyStaff = {
  id: "",
  name: "",
  loginId: "",
  password: "",
  gender: "女",
  birthday: "",
  facial: false,
  pregnancy: false,
  isAdmin: false,
  active: true,
  commissionRate: 45,
};
const emptyFortuneStaff = { id: "", name: "", loginId: "", password: "" };
const emptyMaterial = { id: "", name: "", unit: "個", order: 0, genreId: "" };
const emptyGenre = { id: "", name: "" };

// orderで並び替え。未設定（既存データ）は元の配列順を維持しつつ末尾扱いにする
function sortMaterials(list) {
  return [...list]
    .map((m, i) => ({ ...m, _idx: i }))
    .sort((a, b) => {
      const ao = a.order ?? a._idx;
      const bo = b.order ?? b._idx;
      return ao - bo;
    });
}

export default function Settings() {
  const { stores, staff, refreshMaster, isAdminUser } = useApp();
  const [tab, setTab] = useState("store");
  const [storeForm, setStoreForm] = useState(null);
  const [staffForm, setStaffForm] = useState(null);
  const [fortuneStaffList, setFortuneStaffList] = useState([]);
  const [fortuneStaffForm, setFortuneStaffForm] = useState(null);
  const [materialList, setMaterialList] = useState([]);
  const [materialForm, setMaterialForm] = useState(null);
  const [genreList, setGenreList] = useState([]);
  const [genreForm, setGenreForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tab === "fortuneStaff") api.fortuneStaff().then(setFortuneStaffList).catch(() => {});
    if (tab === "material") {
      api
        .materials()
        .then((list) => setMaterialList(sortMaterials(list)))
        .catch(() => {});
      api.materialGenres().then(setGenreList).catch(() => {});
    }
    if (tab === "materialGenre") {
      api.materialGenres().then(setGenreList).catch(() => {});
    }
  }, [tab]);

  const saveStore = async () => {
    if (!storeForm.name.trim()) return alert("店舗名を入力してください");
    setBusy(true);
    try {
      await api.saveStore(storeForm);
      // 本店は常に1店舗のみ。ONにした場合は他店舗のフラグを解除する
      if (storeForm.isHome) {
        for (const s of stores) {
          if (s.id !== storeForm.id && s.isHome) {
            await api.saveStore({ ...s, isHome: false });
          }
        }
      }
      await refreshMaster();
      setStoreForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delStore = async (id) => {
    if (!confirm("この店舗を削除しますか？")) return;
    await api.deleteStore(id);
    await refreshMaster();
  };

  const saveStaff = async () => {
    if (!staffForm.name.trim()) return alert("氏名を入力してください");
    if (!staffForm.loginId.trim()) return alert("IDを入力してください");
    setBusy(true);
    try {
      await api.saveStaff(staffForm);
      await refreshMaster();
      setStaffForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delStaff = async (id) => {
    if (!confirm("このスタッフを削除しますか？")) return;
    await api.deleteStaff(id);
    await refreshMaster();
  };

  const reloadFortuneStaff = () => api.fortuneStaff().then(setFortuneStaffList);

  const saveFortuneStaff = async () => {
    if (!fortuneStaffForm.name.trim()) return alert("氏名を入力してください");
    if (!fortuneStaffForm.loginId.trim()) return alert("IDを入力してください");
    setBusy(true);
    try {
      await api.saveFortuneStaff(fortuneStaffForm);
      await reloadFortuneStaff();
      setFortuneStaffForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delFortuneStaff = async (id) => {
    if (!confirm("この占いスタッフを削除しますか？")) return;
    await api.deleteFortuneStaff(id);
    await reloadFortuneStaff();
  };

  const reloadMaterials = () =>
    api.materials().then((list) => setMaterialList(sortMaterials(list)));

  const saveMaterial = async () => {
    if (!materialForm.name.trim()) return alert("資材名を入力してください");
    setBusy(true);
    try {
      // 新規追加時は末尾に並ぶよう、現在の最大orderの次の値を割り当てる
      const payload = materialForm.id
        ? materialForm
        : {
            ...materialForm,
            order: materialList.length
              ? Math.max(...materialList.map((m, i) => m.order ?? i)) + 1
              : 0,
          };
      await api.saveMaterial(payload);
      await reloadMaterials();
      setMaterialForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delMaterial = async (id) => {
    if (!confirm("この資材を削除しますか？（履歴は残ります）")) return;
    await api.deleteMaterial(id);
    await reloadMaterials();
  };

  // 隣同士のorderを入れ替えて並び替える
  const moveMaterial = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= materialList.length) return;
    const a = materialList[index];
    const b = materialList[targetIndex];
    const aOrder = a.order ?? index;
    const bOrder = b.order ?? targetIndex;
    setBusy(true);
    try {
      await Promise.all([
        api.saveMaterial({ ...a, order: bOrder }),
        api.saveMaterial({ ...b, order: aOrder }),
      ]);
      await reloadMaterials();
    } catch (e) {
      alert(`並び替え失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const reloadGenres = () => api.materialGenres().then(setGenreList);

  const saveGenre = async () => {
    if (!genreForm.name.trim()) return alert("ジャンル名を入力してください");
    setBusy(true);
    try {
      await api.saveMaterialGenre(genreForm);
      await reloadGenres();
      setGenreForm(null);
    } catch (e) {
      alert(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const delGenre = async (id) => {
    if (!confirm("このジャンルを削除しますか？（該当資材のジャンルは未設定に戻ります）")) return;
    await api.deleteMaterialGenre(id);
    await reloadGenres();
  };

  const genreName = (id) => genreList.find((g) => g.id === id)?.name || "";

  return (
    <div>
      <div className="page-head">
        <h2>設定</h2>
      </div>

      <div className="toolbar">
        <button
          className={tab === "store" ? "btn sm" : "btn sm gray"}
          onClick={() => setTab("store")}
        >
          店舗登録
        </button>
        <button
          className={tab === "staff" ? "btn sm" : "btn sm gray"}
          onClick={() => setTab("staff")}
        >
          スタッフ登録
        </button>
        <button
          className={tab === "fortuneStaff" ? "btn sm" : "btn sm gray"}
          onClick={() => setTab("fortuneStaff")}
        >
          スタッフ登録（占い）
        </button>
        <button
          className={tab === "material" ? "btn sm" : "btn sm gray"}
          onClick={() => setTab("material")}
        >
          資材登録
        </button>
        <button
          className={tab === "materialGenre" ? "btn sm" : "btn sm gray"}
          onClick={() => setTab("materialGenre")}
        >
          資材ジャンル登録
        </button>
      </div>

      {tab === "store" && (
        <div>
          <div className="toolbar">
            <button className="btn sm" onClick={() => setStoreForm({ ...emptyStore })}>
              ＋ 店舗を追加
            </button>
          </div>
          {stores.length === 0 && <div className="empty">店舗が登録されていません</div>}
          {stores.map((s) => (
            <div className="card" key={s.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <strong>{s.name}</strong>{" "}
                  {s.isHome && <span className="pill">本店</span>}
                  <div className="muted" style={{ fontSize: 13 }}>
                    {s.building} {s.floor} ／ ベッド {s.beds}台
                    {!s.active && <span className="pill gray" style={{ marginLeft: 6 }}>停止中</span>}
                  </div>
                </div>
                <button className="btn sm ghost" onClick={() => setStoreForm({ ...s })}>
                  編集
                </button>
                {isAdminUser && (
                  <button className="btn sm danger" onClick={() => delStore(s.id)}>
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "staff" && (
        <div>
          <div className="toolbar">
            <button className="btn sm" onClick={() => setStaffForm({ ...emptyStaff })}>
              ＋ スタッフを追加
            </button>
          </div>
          {staff.length === 0 && <div className="empty">スタッフが登録されていません</div>}
          {staff.map((s) => (
            <div className="card" key={s.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <strong>{s.name}</strong>{" "}
                  <span className="pill gray">{s.gender}</span>{" "}
                  {s.isAdmin && <span className="pill">管理者</span>}{" "}
                  {s.facial && <span className="pill">F可</span>}{" "}
                  {s.pregnancy && <span className="pill green">妊婦可</span>}
                  <div className="muted" style={{ fontSize: 13 }}>
                    ID: {s.loginId} ／ PW: {s.password} ／ 生年月日: {s.birthday || "—"}
                  </div>
                </div>
                <button className="btn sm ghost" onClick={() => setStaffForm({ ...s })}>
                  編集
                </button>
                {isAdminUser && (
                  <button className="btn sm danger" onClick={() => delStaff(s.id)}>
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "fortuneStaff" && (
        <div>
          <div className="toolbar">
            <button className="btn sm" onClick={() => setFortuneStaffForm({ ...emptyFortuneStaff })}>
              ＋ 占いスタッフを追加
            </button>
          </div>
          {fortuneStaffList.length === 0 && (
            <div className="empty">占いスタッフが登録されていません</div>
          )}
          {fortuneStaffList.map((s) => (
            <div className="card" key={s.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <strong>{s.name}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    ID: {s.loginId} ／ PW: {s.password}
                  </div>
                </div>
                <button className="btn sm ghost" onClick={() => setFortuneStaffForm({ ...s })}>
                  編集
                </button>
                {isAdminUser && (
                  <button className="btn sm danger" onClick={() => delFortuneStaff(s.id)}>
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "material" && (
        <div>
          <div className="toolbar">
            <button className="btn sm" onClick={() => setMaterialForm({ ...emptyMaterial })}>
              ＋ 資材を追加
            </button>
          </div>
          {materialList.length === 0 && <div className="empty">資材が登録されていません</div>}
          {materialList.map((m, i) => (
            <div className="card" key={m.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button
                    className="btn sm gray"
                    style={{ padding: "2px 8px" }}
                    onClick={() => moveMaterial(i, -1)}
                    disabled={i === 0 || busy}
                  >
                    ▲
                  </button>
                  <button
                    className="btn sm gray"
                    style={{ padding: "2px 8px" }}
                    onClick={() => moveMaterial(i, 1)}
                    disabled={i === materialList.length - 1 || busy}
                  >
                    ▼
                  </button>
                </div>
                <div style={{ flex: 1 }}>
                  <strong>{m.name}</strong>{" "}
                  {m.genreId && <span className="pill">{genreName(m.genreId)}</span>}
                  <div className="muted" style={{ fontSize: 13 }}>
                    単位: {m.unit}
                  </div>
                </div>
                <button className="btn sm ghost" onClick={() => setMaterialForm({ ...m })}>
                  編集
                </button>
                {isAdminUser && (
                  <button className="btn sm danger" onClick={() => delMaterial(m.id)}>
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "materialGenre" && (
        <div>
          <div className="toolbar">
            <button className="btn sm" onClick={() => setGenreForm({ ...emptyGenre })}>
              ＋ ジャンルを追加
            </button>
          </div>
          {genreList.length === 0 && <div className="empty">ジャンルが登録されていません</div>}
          {genreList.map((g) => (
            <div className="card" key={g.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <strong>{g.name}</strong>
                </div>
                <button className="btn sm ghost" onClick={() => setGenreForm({ ...g })}>
                  編集
                </button>
                {isAdminUser && (
                  <button className="btn sm danger" onClick={() => delGenre(g.id)}>
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {storeForm && (
        <div className="modal-overlay" onClick={() => setStoreForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{storeForm.id ? "店舗を編集" : "店舗を追加"}</h3>
            <div className="field">
              <label>店舗名</label>
              <input
                value={storeForm.name}
                onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                placeholder="BODY RECESS（パレス2階）"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>建物（移動判定に使用）</label>
                <input
                  value={storeForm.building}
                  onChange={(e) => setStoreForm({ ...storeForm, building: e.target.value })}
                  placeholder="パレス / 宙館 / Ceada"
                />
              </div>
              <div className="field">
                <label>フロア</label>
                <input
                  value={storeForm.floor}
                  onChange={(e) => setStoreForm({ ...storeForm, floor: e.target.value })}
                  placeholder="2F"
                />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>ベッド台数</label>
                <input
                  type="number"
                  value={storeForm.beds}
                  onChange={(e) =>
                    setStoreForm({ ...storeForm, beds: Number(e.target.value) })
                  }
                />
              </div>
              <div className="field">
                <label>状態</label>
                <select
                  value={storeForm.active ? "1" : "0"}
                  onChange={(e) =>
                    setStoreForm({ ...storeForm, active: e.target.value === "1" })
                  }
                >
                  <option value="1">稼働中</option>
                  <option value="0">停止中</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="check">
                <input
                  type="checkbox"
                  checked={storeForm.isHome}
                  onChange={(e) => setStoreForm({ ...storeForm, isHome: e.target.checked })}
                />
                本店にする（スタッフは基本この店舗にいる想定で移動時間を計算）
              </label>
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              ※ 本店以外の建物への移動は前後20分を自動確保します（同じ建物が連続する場合、間の移動は不要）。
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setStoreForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveStore} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {staffForm && (
        <div className="modal-overlay" onClick={() => setStaffForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{staffForm.id ? "スタッフを編集" : "スタッフを追加"}</h3>
            <div className="field">
              <label>氏名</label>
              <input
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
              />
            </div>
            <div className="row">
              <div className="field">
                <label>ID</label>
                <input
                  value={staffForm.loginId}
                  onChange={(e) => setStaffForm({ ...staffForm, loginId: e.target.value })}
                  autoCapitalize="none"
                />
              </div>
              <div className="field">
                <label>パスワード（表示）</label>
                <input
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>性別</label>
                <select
                  value={staffForm.gender}
                  onChange={(e) => setStaffForm({ ...staffForm, gender: e.target.value })}
                >
                  <option value="女">女</option>
                  <option value="男">男</option>
                </select>
              </div>
              <div className="field">
                <label>生年月日</label>
                <input
                  type="date"
                  value={staffForm.birthday}
                  onChange={(e) => setStaffForm({ ...staffForm, birthday: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>権限</label>
              <div className="checks">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={staffForm.isAdmin}
                    onChange={(e) => setStaffForm({ ...staffForm, isAdmin: e.target.checked })}
                  />
                  管理者権限（ダッシュボード・料金・顧客名簿・設定が閲覧可能）
                </label>
              </div>
            </div>
            <div className="field">
              <label>基本歩合率（％）</label>
              <input
                type="number"
                value={staffForm.commissionRate}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, commissionRate: Number(e.target.value) })
                }
                placeholder="45"
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                ※ 給料タブの初期値です。実際の率は日ごとに変わる場合があるため、給料タブ側で日別に変更できます。
              </div>
            </div>
            <div className="field">
              <label>対応可否</label>
              <div className="checks">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={staffForm.facial}
                    onChange={(e) => setStaffForm({ ...staffForm, facial: e.target.checked })}
                  />
                  フェイシャル可
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={staffForm.pregnancy}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, pregnancy: e.target.checked })
                    }
                  />
                  妊婦対応可
                </label>
              </div>
            </div>
            <div className="field">
              <label>状態</label>
              <select
                value={staffForm.active ? "1" : "0"}
                onChange={(e) => setStaffForm({ ...staffForm, active: e.target.value === "1" })}
              >
                <option value="1">在籍</option>
                <option value="0">退職・停止</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setStaffForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveStaff} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {fortuneStaffForm && (
        <div className="modal-overlay" onClick={() => setFortuneStaffForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{fortuneStaffForm.id ? "占いスタッフを編集" : "占いスタッフを追加"}</h3>
            <div className="field">
              <label>氏名</label>
              <input
                value={fortuneStaffForm.name}
                onChange={(e) =>
                  setFortuneStaffForm({ ...fortuneStaffForm, name: e.target.value })
                }
              />
            </div>
            <div className="row">
              <div className="field">
                <label>ID</label>
                <input
                  value={fortuneStaffForm.loginId}
                  onChange={(e) =>
                    setFortuneStaffForm({ ...fortuneStaffForm, loginId: e.target.value })
                  }
                  autoCapitalize="none"
                />
              </div>
              <div className="field">
                <label>パスワード（表示）</label>
                <input
                  value={fortuneStaffForm.password}
                  onChange={(e) =>
                    setFortuneStaffForm({ ...fortuneStaffForm, password: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setFortuneStaffForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveFortuneStaff} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {materialForm && (
        <div className="modal-overlay" onClick={() => setMaterialForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{materialForm.id ? "資材を編集" : "資材を追加"}</h3>
            <div className="field">
              <label>資材名</label>
              <input
                value={materialForm.name}
                onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                placeholder="例：オイル（大瓶）"
              />
            </div>
            <div className="field">
              <label>単位</label>
              <input
                value={materialForm.unit}
                onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                placeholder="例：本 / 個 / 枚"
              />
            </div>
            <div className="field">
              <label>ジャンル</label>
              <select
                value={materialForm.genreId || ""}
                onChange={(e) => setMaterialForm({ ...materialForm, genreId: e.target.value })}
              >
                <option value="">未設定</option>
                {genreList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {genreList.length === 0 && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  ※ ジャンルは「資材ジャンル登録」タブで先に登録してください
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setMaterialForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveMaterial} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {genreForm && (
        <div className="modal-overlay" onClick={() => setGenreForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{genreForm.id ? "ジャンルを編集" : "ジャンルを追加"}</h3>
            <div className="field">
              <label>ジャンル名</label>
              <input
                value={genreForm.name}
                onChange={(e) => setGenreForm({ ...genreForm, name: e.target.value })}
                placeholder="例：オイル類 / タオル類 / 消耗品"
              />
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setGenreForm(null)}>
                キャンセル
              </button>
              <button className="btn" onClick={saveGenre} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
