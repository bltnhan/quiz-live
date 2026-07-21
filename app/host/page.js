"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Host dashboard shown right after logging in — separate from any
// specific room. The "Tạo phòng mới" button is the explicit step that
// actually creates a room; once created, players immediately see it in
// the home page's "Phòng đang mở" list and can scan the host's QR code
// to join it.
export default function HostDashboardPage() {
  const router = useRouter();
  const [password, setPassword] = useState(undefined); // undefined = checking, null = not logged in
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("quiz_host_password");
    setPassword(saved || null);
  }, []);

  async function createRoom() {
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được phòng");
      localStorage.setItem(`quiz_host_${data.code}`, data.hostToken);
      router.push(`/host/${data.code}`);
    } catch (e) {
      setError(e.message);
      setCreating(false);
    }
  }

  function logout() {
    localStorage.removeItem("quiz_host_password");
    router.push("/");
  }

  if (password === undefined) {
    return (
      <main className="page">
        <div className="wrap card center-text">Đang kiểm tra đăng nhập...</div>
      </main>
    );
  }

  if (password === null) {
    return (
      <main className="page">
        <div className="wrap card center-text">
          <h2>Bạn chưa đăng nhập quản trò</h2>
          <p className="muted">Quay lại trang chủ và đăng nhập bằng mật khẩu quản trò trước.</p>
          <button className="btn btn-blue" onClick={() => router.push("/")}>
            Về trang chủ
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="wrap">
        <div className="brand">
          <h1>🎯 Bảng điều khiển Quản trò</h1>
          <p>Tạo phòng mới để bắt đầu — người chơi sẽ thấy phòng này trong danh sách trên trang chủ hoặc quét mã QR để vào thẳng.</p>
        </div>

        <div className="card center-text">
          <h2>Tạo phòng mới</h2>
          <p className="muted">
            Mỗi lần bấm sẽ tạo một phòng chơi mới với mã ngẫu nhiên. Sau khi tạo, bạn sẽ vào
            thẳng màn hình điều khiển của phòng đó.
          </p>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-green" disabled={creating} onClick={createRoom} style={{ marginTop: 10 }}>
            {creating ? "Đang tạo..." : "➕ Tạo phòng mới"}
          </button>
        </div>

        <p className="footer-note">
          <button type="button" className="link-btn" onClick={logout}>
            Đăng xuất quản trò
          </button>
        </p>
      </div>
    </main>
  );
}
