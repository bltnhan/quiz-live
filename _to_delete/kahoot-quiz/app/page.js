"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAYER_ICONS } from "@/lib/icons";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState(null); // null | 'join'
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(PLAYER_ICONS[0]);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function createRoom() {
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được phòng");
      localStorage.setItem(`quiz_host_${data.code}`, data.hostToken);
      router.push(`/host/${data.code}`);
    } catch (e) {
      setError(e.message);
      setCreating(false);
    }
  }

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

  return (
    <main className="page">
      <div className="wrap">
        <div className="brand">
          <h1>🎯 Quiz Live</h1>
          <p>Trò chơi trắc nghiệm trực tiếp — 3 vòng, dựa trên thông điệp của quản trò</p>
        </div>

        {mode !== "join" && (
          <div className="card">
            <h2>Bắt đầu</h2>
            <p className="muted" style={{ marginTop: -6, marginBottom: 18 }}>
              Chọn vai trò của bạn cho ván chơi này.
            </p>
            <div className="field">
              <button className="btn btn-green" onClick={createRoom} disabled={creating}>
                {creating ? "Đang tạo phòng..." : "🧑‍🏫 Tôi là Quản trò — Tạo phòng mới"}
              </button>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <button className="btn btn-blue" onClick={() => setMode("join")}>
                📱 Tôi là Người chơi — Tham gia bằng mã phòng
              </button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <form className="card" onSubmit={joinRoom}>
            <h2>Tham gia phòng</h2>
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
            <div className="field">
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
            <div className="row" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMode(null)}
              >
                Quay lại
              </button>
              <button type="submit" className="btn btn-blue" disabled={joining}>
                {joining ? "Đang vào..." : "Tham gia"}
              </button>
            </div>
          </form>
        )}

        {mode !== "join" && error && (
          <div className="card">
            <div className="error" style={{ marginTop: 0 }}>{error}</div>
          </div>
        )}

        <p className="footer-note">
          Quản trò tạo phòng trên máy tính/máy chiếu, người chơi vào bằng điện thoại với mã phòng.
        </p>
      </div>
    </main>
  );
}
