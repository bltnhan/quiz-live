"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ROUND_TOPICS = { 1: "Pivot Excel", 2: "Excel Essential", 3: "PowerPoint Design" };
const OPTION_SHAPES = ["▲", "◆", "●", "■"];

// How long to auto-hold each "in-between" screen before the game
// advances itself. The actual question timer instead comes from the
// server (questionStartedAt + questionDuration), so it stays accurate
// even if this tab is backgrounded for a bit.
const ROUND_INTRO_MS = 3000;
const REVEAL_MS = 4500;

function Countdown({ questionStartedAt, questionDuration, serverTime }) {
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = serverTime - Date.now();
  }, [serverTime]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  if (!questionStartedAt) return null;
  const serverNow = now + offsetRef.current;
  const remaining = Math.max(0, questionStartedAt + questionDuration - serverNow);
  const pct = Math.max(0, Math.min(100, (remaining / questionDuration) * 100));
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div>
      <div className="timer-bar-bg">
        <div className="timer-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted center-text">{seconds > 0 ? `${seconds}s còn lại` : "Hết giờ"}</p>
    </div>
  );
}

export default function HostPage({ params }) {
  const code = params.code?.toUpperCase();
  const router = useRouter();
  const [hostToken, setHostToken] = useState(undefined); // undefined = loading, null = missing
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const autoTimerRef = useRef(null);

  useEffect(() => {
    const t = localStorage.getItem(`quiz_host_${code}`);
    setHostToken(t || null);
  }, [code]);

  useEffect(() => {
    if (!hostToken) return;
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/rooms/${code}/state`, {
          headers: { "x-host-token": hostToken },
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          if (!stop) setError(data.error || "Lỗi tải trạng thái phòng");
          return;
        }
        if (!stop) {
          setState(data);
          setError("");
        }
      } catch (e) {
        if (!stop) setError("Mất kết nối máy chủ, đang thử lại...");
      }
    }
    poll();
    const id = setInterval(poll, 1200);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [hostToken, code]);

  async function callApi(path, body) {
    setBusy(true);
    setActionError("");
    try {
      const res = await fetch(`/api/rooms/${code}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-host-token": hostToken },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");
      return data;
    } catch (e) {
      setActionError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    try {
      await callApi("/next", {});
    } catch {}
  }

  async function startRound(roundNumber) {
    try {
      await callApi("/round", { round: roundNumber });
    } catch {}
  }

  async function togglePause() {
    try {
      await callApi("/pause", { paused: !state.paused });
    } catch {}
  }

  // Ends the game from the round-3 leaderboard: that screen is auto-paused
  // (see server /next route), so we need to lift the pause before /next
  // can move the room into "finished".
  async function finishGame() {
    try {
      await callApi("/pause", { paused: false });
      await callApi("/next", {});
    } catch {}
  }

  async function handleUpload() {
    if (!uploadFile || !hostToken) return;
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      const res = await fetch(`/api/rooms/${code}/upload`, {
        method: "POST",
        headers: { "x-host-token": hostToken },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tải file thất bại.");
      setUploadFile(null);
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  }

  // Drives the whole "chạy liên tục" flow: whenever the round/question
  // phase changes (and the game isn't paused), schedule exactly one
  // auto-advance call for whenever that phase should end on its own.
  // Re-running only depends on the fields that actually mark a new phase,
  // so a poll tick that returns the same phase doesn't reset the timer.
  useEffect(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (!state || state.paused) return;

    const offset = state.serverTime - Date.now();
    const serverNow = () => Date.now() + offset;

    let delay = null;
    if (state.phase === "round_intro") {
      delay = ROUND_INTRO_MS;
    } else if (state.phase === "question" && state.questionStartedAt) {
      delay = state.questionStartedAt + state.questionDuration - serverNow() + 350;
    } else if (state.phase === "question_result") {
      delay = REVEAL_MS;
    }

    if (delay === null) return;
    delay = Math.max(300, delay);

    autoTimerRef.current = setTimeout(() => {
      next();
    }, delay);

    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.paused, state?.questionStartedAt, state?.questionIndex, state?.round]);

  if (hostToken === undefined) {
    return (
      <main className="page">
        <div className="wrap card center-text">Đang tải...</div>
      </main>
    );
  }

  if (hostToken === null) {
    return (
      <main className="page">
        <div className="wrap card center-text">
          <h2>Không tìm thấy quyền quản trò</h2>
          <p className="muted">
            Trình duyệt này không phải là nơi tạo phòng {code}. Hãy tạo phòng mới.
          </p>
          <button className="btn btn-blue" onClick={() => router.push("/")}>
            Về trang chủ
          </button>
        </div>
      </main>
    );
  }

  if (error && !state) {
    return (
      <main className="page">
        <div className="wrap card center-text">
          <h2>Không thể tải phòng</h2>
          <p className="error">{error}</p>
          <button className="btn btn-blue" onClick={() => router.push("/")}>
            Về trang chủ
          </button>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="page">
        <div className="wrap card center-text">Đang kết nối tới phòng {code}...</div>
      </main>
    );
  }

  const nextRoundNumber = state.round + 1;
  const nextTopic = ROUND_TOPICS[nextRoundNumber];
  const showPauseToggle =
    state.phase === "round_intro" || state.phase === "question" || state.phase === "question_result";

  return (
    <main className="page">
      <div className="wrap-wide">
        <div className="brand">
          <h1>🎯 Bảng điều khiển Quản trò</h1>
        </div>

        <div className="card">
          <p className="muted" style={{ marginBottom: 4 }}>Mã phòng — người chơi dùng mã này để vào</p>
          <div className="room-code">{code}</div>
          <p className="center-text muted">👥 {state.playerCount} người chơi đã tham gia</p>
        </div>

        {showPauseToggle && (
          <div className="card center-text">
            {state.paused && <p className="error" style={{ marginTop: 0 }}>⏸ Trò chơi đang tạm dừng</p>}
            <button
              className={state.paused ? "btn btn-green" : "btn btn-secondary"}
              disabled={busy}
              onClick={togglePause}
            >
              {state.paused ? "▶ Tiếp tục" : "⏸ Tạm ngưng"}
            </button>
          </div>
        )}

        {state.phase === "lobby" && (
          <div className="card">
            <h2>Người chơi trong phòng</h2>
            {state.playerCount === 0 ? (
              <p className="muted">Chưa có ai tham gia. Chia sẻ mã phòng phía trên nhé.</p>
            ) : (
              <div className="player-list">
                {state.players.map((p) => (
                  <span className="player-chip" key={p.id}>
                    <span className="icon">{p.icon}</span> {p.name}
                  </span>
                ))}
              </div>
            )}

            <h2 style={{ marginTop: 22 }}>Nạp thông điệp từ file Excel</h2>
            <p className="muted">
              Tải lên file Excel chứa thông điệp cho cả 3 vòng (dùng file mẫu đã cung cấp, hoặc
              file tự soạn với cột &quot;Vòng&quot; và cột &quot;Thông điệp&quot;). Hệ thống tự
              đọc và sinh 5 câu hỏi cho từng vòng — không cần nhập tay.
            </p>
            <div className="field">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="input"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
            {uploadError && <div className="error">{uploadError}</div>}
            <button
              type="button"
              className="btn btn-blue"
              disabled={uploading || !uploadFile}
              onClick={handleUpload}
              style={{ marginBottom: 16 }}
            >
              {uploading ? "Đang tải lên..." : "📤 Tải lên file Excel"}
            </button>

            {state.hasUpload && (
              <div>
                <p className="muted">
                  ✅ Đã nạp thông điệp{state.uploadedFileName ? ` từ ${state.uploadedFileName}` : ""}:
                </p>
                {[1, 2, 3].map((r) => (
                  <p key={r} className="muted" style={{ fontSize: 13 }}>
                    <strong>Vòng {r} — {ROUND_TOPICS[r]}:</strong>{" "}
                    {(state.uploadPreview && state.uploadPreview[r]) || "(đã nạp)"}
                    {state.uploadPreview && state.uploadPreview[r]?.length >= 220 ? "…" : ""}
                  </p>
                ))}
                {actionError && <div className="error">{actionError}</div>}
                <button className="btn btn-green" disabled={busy} onClick={() => startRound(1)}>
                  Bắt đầu Vòng 1 ▶
                </button>
              </div>
            )}
          </div>
        )}

        {state.phase === "round_intro" && (
          <div className="card center-text">
            <span className="topic-badge">Vòng {state.round} / 3</span>
            <p className="big-title">{state.topic}</p>
            <p className="muted">5 câu hỏi sắp bắt đầu tự động...</p>
          </div>
        )}

        {state.phase === "question" && state.question && (
          <div className="card">
            <span className="topic-badge">
              Vòng {state.round} — Câu {state.questionIndex + 1}/{state.totalQuestions}
            </span>
            <Countdown
              questionStartedAt={state.questionStartedAt}
              questionDuration={state.questionDuration}
              serverTime={state.serverTime}
            />
            <p className="question-text">{state.question.text}</p>
            <div className="options-grid">
              {state.question.options.map((opt, i) => (
                <div key={i} className={`option-btn opt-${i}`}>
                  <span className="option-shape">{OPTION_SHAPES[i]}</span> {opt}
                </div>
              ))}
            </div>
            <p className="muted center-text" style={{ marginTop: 14 }}>
              ✅ {state.questionStats?.answeredCount || 0} / {state.questionStats?.totalPlayers || 0} người đã trả lời
            </p>
          </div>
        )}

        {state.phase === "question_result" && state.question && (
          <div className="card">
            <span className="topic-badge">
              Vòng {state.round} — Câu {state.questionIndex + 1}/{state.totalQuestions}
            </span>
            <p className="question-text">{state.question.text}</p>
            <div className="options-grid">
              {state.question.options.map((opt, i) => (
                <div
                  key={i}
                  className={`option-btn opt-${i} ${i === state.question.correctIndex ? "correct" : "wrong"}`}
                >
                  <span className="option-shape">{OPTION_SHAPES[i]}</span> {opt}
                </div>
              ))}
            </div>
            {state.questionStats?.counts && (
              <div style={{ marginTop: 16 }}>
                {state.questionStats.counts.map((c, i) => (
                  <div className="stat-row" key={i}>
                    <span>{OPTION_SHAPES[i]}</span>
                    <div className="stat-bar-bg">
                      <div
                        className={`stat-bar-fill opt-${i}`}
                        style={{
                          width: `${
                            state.questionStats.totalPlayers
                              ? (c / Math.max(1, state.questionStats.totalPlayers)) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <strong>{c}</strong>
                  </div>
                ))}
              </div>
            )}
            <p className="muted center-text" style={{ marginTop: 14 }}>
              {state.questionIndex + 1 < state.totalQuestions
                ? "Câu tiếp theo sắp hiện ra tự động..."
                : "Sắp hiện bảng xếp hạng vòng..."}
            </p>
          </div>
        )}

        {state.phase === "round_leaderboard" && (
          <div className="card">
            <h2>⏸ Vòng {state.round} đã kết thúc — Bảng xếp hạng</h2>
            <ol className="leaderboard">
              {state.leaderboard?.map((p) => (
                <li key={p.id} className={p.rank <= 3 ? `rank-${p.rank}` : ""}>
                  <span className="rank">#{p.rank}</span>
                  <span>{p.icon}</span> {p.name}
                  <span className="score">{p.score}</span>
                </li>
              ))}
            </ol>

            {state.round < 3 ? (
              <>
                <p className="muted" style={{ marginTop: 22 }}>
                  Trò chơi đang tạm dừng. Bấm nút bên dưới khi sẵn sàng cho Vòng {nextRoundNumber}:{" "}
                  {nextTopic}.
                </p>
                {actionError && <div className="error">{actionError}</div>}
                <button className="btn btn-green" disabled={busy} onClick={() => startRound(nextRoundNumber)}>
                  ▶ Tiếp tục — Bắt đầu Vòng {nextRoundNumber}
                </button>
              </>
            ) : (
              <>
                {actionError && <div className="error">{actionError}</div>}
                <button className="btn btn-green" disabled={busy} onClick={finishGame}>
                  ▶ Tiếp tục — Xem kết quả chung cuộc 🏆
                </button>
              </>
            )}
          </div>
        )}

        {state.phase === "finished" && (
          <div className="card">
            <h2 className="center-text">🏆 Kết quả chung cuộc</h2>
            {state.leaderboard && state.leaderboard.length > 0 && (
              <div className="podium">
                {[state.leaderboard[1], state.leaderboard[0], state.leaderboard[2]]
                  .filter(Boolean)
                  .map((p) => (
                    <div key={p.id} className={`spot spot-${p.rank}`}>
                      <div className="icon">{p.icon}</div>
                      <div>{p.name}</div>
                      <div>{p.score}</div>
                    </div>
                  ))}
              </div>
            )}
            <ol className="leaderboard">
              {state.leaderboard?.map((p) => (
                <li key={p.id} className={p.rank <= 3 ? `rank-${p.rank}` : ""}>
                  <span className="rank">#{p.rank}</span>
                  <span>{p.icon}</span> {p.name}
                  <span className="score">{p.score}</span>
                </li>
              ))}
            </ol>
            <button className="btn btn-blue" onClick={() => router.push("/")}>
              Tạo phòng mới
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
