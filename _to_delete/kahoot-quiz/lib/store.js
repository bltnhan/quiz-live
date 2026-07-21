import { QUESTION_DURATION_MS } from "./scoring";
import { sanitizeQuestionForPlayer } from "./questionGen";
import { TOPICS } from "./wordbanks";

// In-memory room store. Persisted on `globalThis` so it survives Next.js
// hot-reload in dev and stays alive across requests handled by the same
// warm serverless instance in production. Good enough for a live,
// short-lived party-game session; rooms are auto-pruned after a few hours.
const g = globalThis;
if (!g.__KAHOOT_ROOMS__) {
  g.__KAHOOT_ROOMS__ = new Map();
}
const rooms = g.__KAHOOT_ROOMS__;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function pruneOldRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

function generateRoomCode() {
  let code;
  do {
    code = Array.from(
      { length: 5 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

export function createRoom() {
  pruneOldRooms();
  const code = generateRoomCode();
  const hostToken = cryptoRandomToken();
  const room = {
    code,
    hostToken,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    phase: "lobby", // lobby | round_intro | question | question_result | round_leaderboard | finished
    round: 0, // 0 = lobby, 1-3 = active round, 4 = finished
    players: {}, // playerId -> {id, name, icon, score, joinedAt}
    roundData: {}, // roundNumber -> {message, topic, questions}
    currentQuestionIndex: -1,
    questionStartedAt: null,
    questionDuration: QUESTION_DURATION_MS,
    answers: {}, // round -> questionIndex -> playerId -> {optionIndex, timeMs, score}
  };
  rooms.set(code, room);
  return room;
}

function cryptoRandomToken() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export function getRoom(code) {
  if (!code) return null;
  return rooms.get(code.toUpperCase()) || null;
}

export function touchRoom(room) {
  room.updatedAt = Date.now();
}

export function isHost(room, token) {
  return Boolean(room && token && room.hostToken === token);
}

export function addPlayer(room, name, icon) {
  const id = cryptoRandomToken();
  let finalName = (name || "Người chơi").trim().slice(0, 20) || "Người chơi";

  const existingNames = new Set(
    Object.values(room.players).map((p) => p.name.toLowerCase())
  );
  if (existingNames.has(finalName.toLowerCase())) {
    let suffix = 2;
    while (existingNames.has(`${finalName} (${suffix})`.toLowerCase())) {
      suffix++;
    }
    finalName = `${finalName} (${suffix})`;
  }

  room.players[id] = {
    id,
    name: finalName,
    icon: icon || "🙂",
    score: 0,
    joinedAt: Date.now(),
    connected: true,
  };
  touchRoom(room);
  return room.players[id];
}

export function getLeaderboard(room) {
  return Object.values(room.players)
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((p, idx) => ({ ...p, rank: idx + 1 }));
}

export function currentQuestion(room) {
  if (!room || room.round < 1 || room.round > 3) return null;
  const rd = room.roundData[room.round];
  if (!rd) return null;
  if (room.currentQuestionIndex < 0 || room.currentQuestionIndex >= rd.questions.length) {
    return null;
  }
  return rd.questions[room.currentQuestionIndex];
}

export function questionAnswers(room, round, questionIndex) {
  return (
    (room.answers[round] && room.answers[round][questionIndex]) || {}
  );
}

export function recordAnswer(room, round, questionIndex, playerId, optionIndex, timeMs, score) {
  if (!room.answers[round]) room.answers[round] = {};
  if (!room.answers[round][questionIndex]) room.answers[round][questionIndex] = {};
  room.answers[round][questionIndex][playerId] = { optionIndex, timeMs, score };
  touchRoom(room);
}

/**
 * Build the JSON payload sent to a polling client. Hides the correct
 * answer from players while a question is live, and only exposes the
 * live leaderboard / vote breakdown to the host or once the round is
 * over, mirroring how Kahoot keeps mid-question state a bit suspenseful.
 */
export function serializeState(room, { hostReq = false, playerId = null } = {}) {
  const rd = room.round >= 1 && room.round <= 3 ? room.roundData[room.round] : null;
  const q = currentQuestion(room);
  const totalQuestions = rd ? rd.questions.length : 5;

  let questionPayload = null;
  let questionStats = null;
  if (q) {
    questionPayload = room.phase === "question" && !hostReq
      ? sanitizeQuestionForPlayer(q)
      : q;

    const answersForQ = questionAnswers(room, room.round, room.currentQuestionIndex);
    const answeredCount = Object.keys(answersForQ).length;
    const totalPlayers = Object.keys(room.players).length;

    if (room.phase !== "question" || hostReq) {
      const counts = new Array(q.options.length).fill(0);
      Object.values(answersForQ).forEach((a) => {
        if (a.optionIndex >= 0 && a.optionIndex < counts.length) counts[a.optionIndex]++;
      });
      questionStats = { answeredCount, totalPlayers, counts };
    } else {
      questionStats = { answeredCount, totalPlayers };
    }
  }

  const showLeaderboard = hostReq || room.phase === "round_leaderboard" || room.phase === "finished";
  const leaderboard = showLeaderboard ? getLeaderboard(room) : null;

  const players = Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    ...(showLeaderboard ? { score: p.score } : {}),
  }));

  let you = null;
  if (playerId && room.players[playerId]) {
    const p = room.players[playerId];
    const answersForQ = q ? questionAnswers(room, room.round, room.currentQuestionIndex) : {};
    const mine = playerId in answersForQ ? answersForQ[playerId] : null;
    you = {
      id: p.id,
      name: p.name,
      icon: p.icon,
      score: p.score,
      answeredCurrent: Boolean(mine),
      lastAnswerCorrect: mine && q ? mine.optionIndex === q.correctIndex : null,
      lastAnswerScore: mine ? mine.score : null,
    };
  }

  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    totalRounds: 3,
    topic: room.round >= 1 && room.round <= 3 ? TOPICS[room.round] : null,
    roundMessage: hostReq && rd ? rd.message : undefined,
    questionIndex: room.currentQuestionIndex,
    totalQuestions,
    question: questionPayload,
    questionStats,
    questionStartedAt: room.questionStartedAt,
    questionDuration: room.questionDuration,
    serverTime: Date.now(),
    players,
    playerCount: Object.keys(room.players).length,
    leaderboard,
    you,
    isHost: hostReq,
  };
}
