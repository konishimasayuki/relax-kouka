import { useState } from "react";
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
};

export default function Settings() {
  const { stores, staff, refreshMaster, isAdminUser } = useApp();
  const [tab, setTab] = useState("store");
  const [storeForm, setStoreForm] = useState(null);
  const [staffForm, setStaffForm] = useState(null);
  const [busy, setBusy] = useState(false);

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
    </div>
  );
}
