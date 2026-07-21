"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAYER_ICONS, randomIcon, randomGuestName } from "@/lib/icons";

// Landing page for players who scan the host's QR code. The room code
// comes straight from the URL (baked into the QR image), and a random
// name + avatar are pre-filled, so scanning and tapping "Tham gia" once
// is enough to join — no typing required. The player can still edit
// either field first if they want a name of their own.
export default function JoinByCodePage({ params }) {
  const code = params.code?.toUpperCase();
  const router = useRouter();

  const [name, setName] = useState(() => randomGuestName());
  const [icon, setIcon] = useState(() => randomIcon());
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function joinRoom(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Vui lòng nhập tên của bạn.");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tham gia được phòng");
      localStorage.setItem(`quiz_player_${code}`, data.playerId);
      router.push(`/play/${code}`);
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
          <p>
            Bạn vừa quét mã QR của quản trò — đã có sẵn tên và nhân vật ngẫu nhiên, bấm
            &quot;Tham gia&quot; là vào chơi ngay, hoặc đổi lại tên/nhân vật nếu muốn.
          </p>
        </div>

        <form className="card" onSubmit={joinRoom}>
          <h2>Vào phòng</h2>
          <p className="muted" style={{ marginBottom: 4 }}>Mã phòng</p>
          <div className="locked-code">{code}</div>

          <div className="field">
            <label>Tên hiển thị</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên của bạn"
              maxLength={20}
              autoFocus
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Chọn nhân vật đại diện</label>
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
          Không phải phòng của bạn? <a href="/">Về trang chủ để nhập mã khác</a>.
        </p>
      </div>
    </main>
  );
}
