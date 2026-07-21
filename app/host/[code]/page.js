"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ROUND_TOPICS = { 1: "Pivot Excel", 2: "Excel Essential", 3: "PowerPoint Design" };
const OPTION_SHAPES = ["▲", "◆", "●", "■"];

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
  const [draftMessage, setDraftMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function startRound(roundNumber) {
    if (!draftMessage.trim()) {
      setActionError("Vui lòng nhập thông điệp cho vòng này.");
      return;
    }
    try {
      await callApi("/round", { round: roundNumber, message: draftMessage });
      setDraftMessage("");
    } catch {}
  }

  async function next() {
    try {
      await callApi("/next", {});
    } catch {}
  }

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

            <h2 style={{ marginTop: 22 }}>Vòng 1: {ROUND_TOPICS[1]}</h2>
            <p className="muted">
              Nhập thông điệp cho vòng 1. Hệ thống sẽ tự tạo 5 câu hỏi trắc nghiệm, đáp án
              đúng chính là các từ khoá trong thông điệp này. Nên viết 3–5 câu có chứa các
              thuật ngữ/từ khoá cụ thể (VD: PivotTable, Slicer, VLOOKUP...) để câu hỏi rõ
              ràng và hay hơn.
            </p>
            <div className="field">
              <textarea
                className="input"
                placeholder={`Nhập nội dung thông điệp về "${ROUND_TOPICS[1]}"...`}
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
              />
            </div>
            {actionError && <div className="error">{actionError}</div>}
            <button className="btn btn-green" disabled={busy} onClick={() => startRound(1)}>
              Bắt đầu Vòng 1 ▶
            </button>
          </div>
        )}

        {state.phase === "round_intro" && (
          <div className="card center-text">
            <span className="topic-badge">Vòng {state.round} / 3</span>
            <p className="big-title">{state.topic}</p>
            <p className="muted">5 câu hỏi đã sẵn sàng. Bấm để hiển thị câu hỏi đầu tiên.</p>
            {actionError && <div className="error">{actionError}</div>}
            <button className="btn btn-green" disabled={busy} onClick={next}>
              Bắt đầu câu hỏi ▶
            </button>
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
            {actionError && <div className="error">{actionError}</div>}
            <button className="btn btn-red" disabled={busy} onClick={next}>
              Xem đáp án ⏹
            </button>
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
            {actionError && <div className="error">{actionError}</div>}
            <button className="btn btn-blue" disabled={busy} onClick={next}>
              {state.questionIndex + 1 < state.totalQuestions ? "Câu tiếp theo ▶" : "Xem bảng xếp hạng vòng ▶"}
            </button>
          </div>
        )}

        {state.phase === "round_leaderboard" && (
          <div className="card">
            <h2>Bảng xếp hạng — Vòng {state.round}</h2>
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
                <h2 style={{ marginTop: 22 }}>
                  Vòng {nextRoundNumber}: {nextTopic}
                </h2>
                <p className="muted">
                  Nhập thông điệp cho vòng tiếp theo (nên 3–5 câu, có từ khoá cụ thể để câu
                  hỏi rõ ràng và hay hơn).
                </p>
                <div className="field">
                  <textarea
                    className="input"
                    placeholder={`Nhập nội dung thông điệp về "${nextTopic}"...`}
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                  />
                </div>
                {actionError && <div className="error">{actionError}</div>}
                <button className="btn btn-green" disabled={busy} onClick={() => startRound(nextRoundNumber)}>
                  Bắt đầu Vòng {nextRoundNumber} ▶
                </button>
              </>
            ) : (
              <>
                {actionError && <div className="error">{actionError}</div>}
                <button className="btn btn-green" disabled={busy} onClick={next}>
                  Kết thúc trò chơi — Xem kết quả chung cuộc 🏆
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
