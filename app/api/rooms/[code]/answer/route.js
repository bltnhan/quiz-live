import { NextResponse } from "next/server";
import { getRoom, touchRoom, saveRoom, currentQuestion, questionAnswers, recordAnswer } from "@/lib/store";
import { computeScore } from "@/lib/scoring";

export async function POST(request, { params }) {
  const room = await getRoom(params.code);
  if (!room) {
    return NextResponse.json({ error: "Không tìm thấy phòng." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const playerId = body.playerId;
  const questionIndex = Number(body.questionIndex);
  const optionIndex = Number(body.optionIndex);

  if (!playerId || !room.players[playerId]) {
    return NextResponse.json({ error: "Người chơi không hợp lệ." }, { status: 400 });
  }
  if (room.paused) {
    return NextResponse.json({ error: "Trò chơi đang tạm dừng, vui lòng chờ." }, { status: 400 });
  }
  if (room.phase !== "question") {
    return NextResponse.json({ error: "Hiện không phải lúc trả lời câu hỏi." }, { status: 400 });
  }
  if (questionIndex !== room.currentQuestionIndex) {
    return NextResponse.json({ error: "Câu hỏi đã thay đổi, vui lòng thử lại." }, { status: 400 });
  }

  const q = currentQuestion(room);
  if (!q) {
    return NextResponse.json({ error: "Không có câu hỏi hiện tại." }, { status: 400 });
  }
  if (Number.isNaN(optionIndex) || optionIndex < 0 || optionIndex >= q.options.length) {
    return NextResponse.json({ error: "Lựa chọn không hợp lệ." }, { status: 400 });
  }

  const existing = questionAnswers(room, room.round, room.currentQuestionIndex)[playerId];
  if (existing) {
    return NextResponse.json({ error: "Bạn đã trả lời câu này rồi." }, { status: 400 });
  }

  const now = Date.now();
  const elapsed = now - (room.questionStartedAt || now);
  const grace = 500; // ms buffer for network latency
  if (elapsed > room.questionDuration + grace) {
    return NextResponse.json({ error: "Đã hết giờ trả lời câu này." }, { status: 400 });
  }

  const isCorrect = optionIndex === q.correctIndex;
  const score = computeScore(isCorrect, elapsed, room.questionDuration);

  recordAnswer(room, room.round, room.currentQuestionIndex, playerId, optionIndex, elapsed, score);
  room.players[playerId].score += score;
  touchRoom(room);
  await saveRoom(room);

  return NextResponse.json({
    ok: true,
    correct: isCorrect,
    score,
    totalScore: room.players[playerId].score,
  });
}
