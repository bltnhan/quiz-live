"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const OPTION_SHAPES = ["▲", "◆", "●", "■"];

function Countdown({ questionStartedAt, questionDuration, serverTime, onExpire }) {
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0);
  const firedRef = useRef(false);

  useEffect(() => {
    offsetRef.current = serverTime - Date.now();
    firedRef.current = false;
  }, [serverTime, questionStartedAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  if (!questionStartedAt) return null;
  const serverNow = now + offsetRef.current;
  const remaining = Math.max(0, questionStartedAt + questionDuration - serverNow);
  const pct = Math.max(0, Math.min(100, (remaining / questionDuration) * 100));
  const seconds = Math.ceil(remaining / 1000);

  if (remaining <= 0 && !firedRef.current) {
    firedRef.current = true;
    if (onExpire) onExpire();
  }

  return (
    <div>
      <div className="timer-bar-bg">
        <div className="timer-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted center-text">{seconds > 0 ? `${seconds}s` : "Hết giờ"}</p>
    </div>
  );
}

export default function PlayPage({ params }) {
  const code = params.code?.toUpperCase();
  const router = useRouter();
  const [playerId, setPlayerId] = useState(undefined);
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [timeUp, setTimeUp] = useState(false);
  const questionKeyRef = useRef(null);

  useEffect(() => {
    const id = localStorage.getItem(`quiz_player_${code}`);
    setPlayerId(id || null);
  }, [code]);

  useEffect(() => {
    if (!playerId) return;
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/rooms/${code}/state?playerId=${playerId}`, {
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
    const id = setInterval(poll, 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [playerId, code]);

  // Reset local answer state whenever a new question comes in.
  useEffect(() => {
    if (!state) return;
    const key = `${state.round}-${state.questionIndex}`;
    if (questionKeyRef.current !== key) {
      questionKeyRef.current = key;
      setSelected(null);
      setSubmitError("");
      setTimeUp(false);
    }
  }, [state]);

  async function submitAnswer(optionIndex) {
    if (selected !== null || submitting || timeUp) return;
    setSelected(optionIndex);
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/rooms/${code}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          questionIndex: state.questionIndex,
          optionIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không gửi được câu trả lời");
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (playerId === undefined) {
    return (
      <main className="page">
        <div className="wrap card center-text">Đang tải...</div>
      </main>
    );
  }

  if (playerId === null) {
    return (
      <main className="page">
        <div className="wrap card center-text">
          <h2>Bạn chưa tham gia phòng {code}</h2>
          <p className="muted">Hãy quay lại trang chủ và tham gia bằng mã phòng này.</p>
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
          <h2>Không thể kết nối phòng</h2>
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
        <div className="wrap card center-text">Đang kết nối...</div>
      </main>
    );
  }

  const you = state.you;

  return (
    <main className="page">
      <div className="wrap">
        {you && (
          <div className="brand" style={{ marginBottom: 12 }}>
            <p style={{ margin: 0 }}>
              {you.icon} <strong>{you.name}</strong> · Điểm: {you.score}
            </p>
          </div>
        )}

        {state.phase === "lobby" && (
          <div className="card center-text">
            <h2>Đã tham gia phòng {code} 🎉</h2>
            <p className="muted">Đang chờ quản trò bắt đầu trò chơi...</p>
            <p style={{ fontSize: "2.4rem" }}>{you?.icon}</p>
            <p className="muted">👥 {state.playerCount} người chơi trong phòng</p>
          </div>
        )}

        {state.phase === "round_intro" && (
          <div className="card center-text">
            <span className="topic-badge">Vòng {state.round} / 3</span>
            <p className="big-title">{state.topic}</p>
            <p className="muted">Chuẩn bị sẵn sàng, câu hỏi sắp xuất hiện! 🎯</p>
          </div>
        )}

        {state.phase === "question" && state.question && (
          <div className="card">
            <span className="topic-badge">
              Câu {state.questionIndex + 1}/{state.totalQuestions}
            </span>
            <Countdown
              questionStartedAt={state.questionStartedAt}
              questionDuration={state.questionDuration}
              serverTime={state.serverTime}
              onExpire={() => setTimeUp(true)}
            />
            {selected === null && !timeUp ? (
              <>
                <p className="question-text">{state.question.text}</p>
                <div className="options-grid">
                  {state.question.options.map((opt, i) => (
                    <button
                      key={i}
                      className={`option-btn opt-${i}`}
                      disabled={submitting}
                      onClick={() => submitAnswer(i)}
                    >
                      <span className="option-shape">{OPTION_SHAPES[i]}</span> {opt}
                    </button>
                  ))}
                </div>
                {submitError && <div className="error">{submitError}</div>}
              </>
            ) : (
              <div className="feedback-banner feedback-waiting">
                {timeUp && selected === null
                  ? "⏱️ Hết giờ! Chờ quản trò công bố đáp án..."
                  : "✅ Đã gửi câu trả lời! Chờ quản trò công bố đáp án..."}
              </div>
            )}
          </div>
        )}

        {state.phase === "question_result" && state.question && (
          <div className="card">
            <span className="topic-badge">
              Câu {state.questionIndex + 1}/{state.totalQuestions}
            </span>
            {you && you.answeredCurrent ? (
              <div
                className={`feedback-banner ${
                  you.lastAnswerCorrect ? "feedback-correct" : "feedback-wrong"
                }`}
              >
                {you.lastAnswerCorrect ? `🎉 Chính xác! +${you.lastAnswerScore} điểm` : "❌ Sai rồi"}
              </div>
            ) : (
              <div className="feedback-banner feedback-wrong">😕 Bạn chưa trả lời câu này</div>
            )}
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
            <p className="muted center-text" style={{ marginTop: 14 }}>
              Đang chờ quản trò chuyển câu tiếp theo...
            </p>
          </div>
        )}

        {state.phase === "round_leaderboard" && (
          <div className="card">
            <h2>Bảng xếp hạng — Vòng {state.round}</h2>
            <ol className="leaderboard">
              {state.leaderboard?.slice(0, 10).map((p) => (
                <li
                  key={p.id}
                  className={
                    (p.rank <= 3 ? `rank-${p.rank} ` : "") + (p.id === playerId ? "current-player" : "")
                  }
                  style={p.id === playerId ? { border: "2px solid #46178f" } : undefined}
                >
                  <span className="rank">#{p.rank}</span>
                  <span>{p.icon}</span> {p.name}
                  <span className="score">{p.score}</span>
                </li>
              ))}
            </ol>
            <p className="muted center-text">Đang chờ quản trò bắt đầu vòng tiếp theo...</p>
          </div>
        )}

        {state.phase === "finished" && (
          <div className="card">
            <h2 className="center-text">🏆 Kết quả chung cuộc</h2>
            <ol className="leaderboard">
              {state.leaderboard?.map((p) => (
                <li
                  key={p.id}
                  className={p.rank <= 3 ? `rank-${p.rank}` : ""}
                  style={p.id === playerId ? { border: "2px solid #46178f" } : undefined}
                >
                  <span className="rank">#{p.rank}</span>
                  <span>{p.icon}</span> {p.name}
                  <span className="score">{p.score}</span>
                </li>
              ))}
            </ol>
            <p className="center-text muted">Cảm ơn bạn đã tham gia! 🎉</p>
          </div>
        )}
      </div>
    </main>
  );
}
