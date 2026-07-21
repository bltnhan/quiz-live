"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLAYER_ICONS } from "@/lib/icons";

export default function HomePage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(PLAYER_ICONS[0]);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [creating, setCreating] = useState(false);

  const [openRooms, setOpenRooms] = useState(null); // null = still loading
  const [roomsError, setRoomsError] = useState(false);

  // Lets a player pick a currently-open room instead of typing/scanning a
  // code — refreshed regularly since rooms open and fill up while this
  // page just sits there in someone's browser.
  useEffect(() => {
    let stop = false;
    async function loadRooms() {
      try {
        const res = await fetch("/api/rooms/list", { cache: "no-store" });
        const data = await res.json();
        if (!stop && res.ok) {
          setOpenRooms(data.rooms || []);
          setRoomsError(false);
        } else if (!stop) {
          setRoomsError(true);
        }
      } catch {
        if (!stop) setRoomsError(true);
      }
    }
    loadRooms();
    const id = setInterval(loadRooms, 3000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  async function joinRoom(e) {
    e.preventDefault();
    setError("");
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError("Vui lòng nhập mã phòng.");
      return;
    }
    if (!name.trim()) {
      setError("Vui lòng nhập tên của bạn.");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${cleanCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tham gia được phòng");
      localStorage.setItem(`quiz_player_${cleanCode}`, data.playerId);
      router.push(`/play/${cleanCode}`);
    } catch (e) {
      setError(e.message);
      setJoining(false);
    }
  }

  async function loginAsHost(e) {
    e.preventDefault();
    setLoginError("");
    if (!password) {
      setLoginError("Vui lòng nhập mật khẩu.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/host/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sai mật khẩu quản trò.");
      // Remembered so the dashboard (and its "Tạo phòng mới" button) can
      // create rooms without asking for the password again every time.
      localStorage.setItem("quiz_host_password", password);
      router.push("/host");
    } catch (e) {
      setLoginError(e.message);
      setCreating(false);
    }
  }

  return (
    <main className="page">
      <button
        type="button"
        className="corner-btn"
        onClick={() => {
          setShowLogin(true);
          setLoginError("");
          setPassword("");
        }}
      >
        🔐 Quản trò
      </button>

      <div className="wrap">
        <div className="brand">
          <h1>🎯 Quiz Live</h1>
          <p>Trò chơi trắc nghiệm trực tiếp — 3 vòng, dựa trên thông điệp của quản trò</p>
        </div>

        <div className="card">
          <h2>Phòng đang mở</h2>
          {openRooms === null ? (
            <p className="muted">Đang tải danh sách phòng...</p>
          ) : openRooms.length === 0 ? (
            <p className="muted">
              {roomsError
                ? "Không tải được danh sách phòng, thử lại sau."
                : "Chưa có phòng nào đang mở. Nhờ quản trò tạo phòng, hoặc quét mã QR / nhập mã bên dưới."}
            </p>
          ) : (
            <div className="room-pick-list">
              {openRooms.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  className="room-pick-btn"
                  onClick={() => router.push(`/join/${r.code}`)}
                >
                  <span className="room-pick-code">{r.code}</span>
                  <span className="room-pick-count">👥 {r.playerCount} người</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <form className="card" onSubmit={joinRoom}>
          <h2>Hoặc nhập mã phòng thủ công</h2>
          <div className="field">
            <label>Mã phòng</label>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VD: 7K2QX"
              maxLength={6}
              autoCapitalize="characters"
            />
          </div>
          <div className="field">
            <label>Tên hiển thị</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên của bạn"
              maxLength={20}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Chọn icon đại diện</label>
            <div className="icon-grid">
              {PLAYER_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  className={"icon-btn" + (icon === ic ? " selected" : "")}
                  onClick={() => setIcon(ic)}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn btn-blue" disabled={joining} style={{ marginTop: 16 }}>
            {joining ? "Đang vào..." : "Tham gia"}
          </button>
        </form>

        <p className="footer-note">
          Quản trò đăng nhập ở góc trên bên phải để tạo phòng trên máy tính/máy chiếu, người
          chơi vào bằng điện thoại với mã phòng.
        </p>
      </div>

      {showLogin && (
        <div className="modal-overlay" onClick={() => !creating && setShowLogin(false)}>
          <form
            className="card modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={loginAsHost}
          >
            <h2>Đăng nhập Quản trò</h2>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Mật khẩu</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu quản trò"
                autoFocus
              />
            </div>
            {loginError && <div className="error">{loginError}</div>}
            <div className="row" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={creating}
                onClick={() => setShowLogin(false)}
              >
                Huỷ
              </button>
              <button type="submit" className="btn btn-green" disabled={creating}>
                {creating ? "Đang vào..." : "Đăng nhập"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
