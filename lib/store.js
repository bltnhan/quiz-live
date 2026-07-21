import { Redis } from "@upstash/redis";
import { QUESTION_DURATION_MS } from "./scoring";
import { sanitizeQuestionForPlayer } from "./questionGen";
import { TOPICS } from "./wordbanks";

const ROOM_TTL_SECONDS = 6 * 60 * 60; // 6h
const ROOM_TTL_MS = ROOM_TTL_SECONDS * 1000;

// --- Storage backend -----------------------------------------------------
// On Vercel, a single deployment can run on several different serverless
// instances at once (and almost certainly will under any real traffic).
// Plain in-memory storage (a JS object living in one process) is NOT
// shared between those instances — the request that creates a room can
// land on a different instance than the request that joins it, which is
// exactly why a host could create a room and players would get "room not
// found". To fix that for real, rooms are persisted to Upstash Redis
// (Vercel's recommended KV) whenever it's configured, so every instance
// reads/writes the same store. Falls back to in-memory automatically when
// no KV env vars are present, which keeps local `npm run dev` simple.
//
// Vercel's Storage integrations don't always name these env vars the same
// way — the older native "KV" product used `KV_REST_API_URL` /
// `KV_REST_API_TOKEN`, the Upstash marketplace integration sometimes
// prefixes them with the store's name (e.g. `MY_STORE_KV_REST_API_URL`),
// and a manually-connected Upstash database uses `UPSTASH_REDIS_REST_URL` /
// `UPSTASH_REDIS_REST_TOKEN`. Rather than hardcoding one exact name, scan
// every env var for anything that *looks* like a REST URL/token pair so
// this keeps working regardless of which exact integration flow was used.
function findEnvPair(urlPattern, tokenPattern) {
  const keys = Object.keys(process.env);
  const urlKey = keys.find((k) => urlPattern.test(k) && process.env[k]);
  if (!urlKey) return null;
  // Prefer a token var that shares the same prefix as the url var found.
  const prefix = urlKey.replace(/REST_API_URL$/i, "").replace(/URL$/i, "");
  const tokenKey =
    keys.find((k) => k.startsWith(prefix) && tokenPattern.test(k) && process.env[k]) ||
    keys.find((k) => tokenPattern.test(k) && process.env[k]);
  if (!tokenKey) return null;
  return { url: process.env[urlKey], token: process.env[tokenKey], urlKey, tokenKey };
}

const detected =
  (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? {
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
        urlKey: "KV_REST_API_URL",
        tokenKey: "KV_REST_API_TOKEN",
      }
    : null) ||
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? {
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
        urlKey: "UPSTASH_REDIS_REST_URL",
        tokenKey: "UPSTASH_REDIS_REST_TOKEN",
      }
    : null) ||
  findEnvPair(/REST_API_URL$/i, /REST_API_TOKEN$/i);

const redis = detected ? new Redis({ url: detected.url, token: detected.token }) : null;

// Surfaced by /api/debug so a host can confirm from the browser whether
// persistent storage actually got picked up, without exposing secrets.
export const STORAGE_INFO = redis
  ? { mode: "redis", urlKey: detected.urlKey, tokenKey: detected.tokenKey }
  : { mode: "memory", urlKey: null, tokenKey: null };

const g = globalThis;
if (!g.__KAHOOT_ROOMS__) {
  g.__KAHOOT_ROOMS__ = new Map();
}
const memoryRooms = g.__KAHOOT_ROOMS__;

function roomKey(code) {
  return `quizroom:${code.toUpperCase()}`;
}

// A Redis Set of every room code that currently exists, so the home page
// can list open rooms without needing a slow/unsupported "scan all keys"
// call. Kept in sync on create, and lazily pruned whenever it's read (a
// code can still be present here after its room key expired from the 6h
// TTL — we just drop it from the index the next time someone lists rooms).
const ROOM_INDEX_KEY = "quizroom:index";

function pruneOldMemoryRooms() {
  const now = Date.now();
  for (const [code, room] of memoryRooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      memoryRooms.delete(code);
    }
  }
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function generateRoomCode() {
  return Array.from(
    { length: 5 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

function cryptoRandomToken() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export async function createRoom() {
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
    paused: false,
    pausedAt: null,
    uploadedMessages: null, // {1: "...", 2: "...", 3: "..."} parsed from host's Excel upload
    uploadedFileName: null,
  };
  await saveRoom(room);
  if (redis) {
    await redis.sadd(ROOM_INDEX_KEY, code);
  }
  return room;
}

/**
 * Rooms other players can currently join by picking from a list, instead
 * of typing/scanning a code — only rooms still in the lobby (join route
 * itself already refuses joins once a room has started). Sorted newest
 * first so a freshly-created room shows at the top.
 */
export async function listOpenRooms() {
  let rooms = [];
  if (redis) {
    const codes = await redis.smembers(ROOM_INDEX_KEY);
    for (const code of codes) {
      const room = await getRoom(code);
      if (!room) {
        // Room key expired (TTL) but the index still had it — clean up.
        await redis.srem(ROOM_INDEX_KEY, code);
        continue;
      }
      rooms.push(room);
    }
  } else {
    pruneOldMemoryRooms();
    rooms = Array.from(memoryRooms.values());
  }

  return rooms
    .filter((r) => r.phase === "lobby")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => ({
      code: r.code,
      playerCount: Object.keys(r.players).length,
      createdAt: r.createdAt,
      hasUpload: Boolean(
        r.uploadedMessages && r.uploadedMessages[1] && r.uploadedMessages[2] && r.uploadedMessages[3]
      ),
    }));
}

export async function getRoom(code) {
  if (!code) return null;
  if (redis) {
    const data = await redis.get(roomKey(code));
    if (!data) return null;
    // @upstash/redis auto-parses JSON values, but guard the string case too.
    return typeof data === "string" ? JSON.parse(data) : data;
  }
  pruneOldMemoryRooms();
  return memoryRooms.get(code.toUpperCase()) || null;
}

/**
 * Persist a room after mutating it. Every API route that changes room
 * state (join, round, next, answer) must call this before returning —
 * unlike the old pure in-memory version, mutating the object alone is not
 * enough once Redis is the backing store.
 */
export async function saveRoom(room) {
  room.updatedAt = Date.now();
  if (redis) {
    await redis.set(roomKey(room.code), JSON.stringify(room), {
      ex: ROOM_TTL_SECONDS,
    });
  } else {
    memoryRooms.set(room.code, room);
  }
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

  const showLeaderboard =
    hostReq ||
    room.phase === "round_leaderboard" ||
    room.phase === "finished" ||
    room.phase === "question_result";
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

  const uploaded = room.uploadedMessages || null;
  const hasUpload = Boolean(uploaded && uploaded[1] && uploaded[2] && uploaded[3]);

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
    paused: Boolean(room.paused),
    hasUpload: hostReq ? hasUpload : undefined,
    uploadedFileName: hostReq ? room.uploadedFileName || null : undefined,
    uploadPreview:
      hostReq && uploaded
        ? {
            1: (uploaded[1] || "").slice(0, 220),
            2: (uploaded[2] || "").slice(0, 220),
            3: (uploaded[3] || "").slice(0, 220),
          }
        : undefined,
  };
}
