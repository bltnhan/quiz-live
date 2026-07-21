import { NextResponse } from "next/server";
import { getRoom, isHost, touchRoom, saveRoom } from "@/lib/store";
import { generateQuestions } from "@/lib/questionGen";
import { TOPICS } from "@/lib/wordbanks";

// Starts a round using the message the host already uploaded via the
// Excel file (see /upload). We auto-generate 5 multiple-choice questions
// whose correct answers are keywords pulled straight out of that message.
export async function POST(request, { params }) {
  const room = await getRoom(params.code);
  if (!room) {
    return NextResponse.json({ error: "Không tìm thấy phòng." }, { status: 404 });
  }
  const hostToken = request.headers.get("x-host-token");
  if (!isHost(room, hostToken)) {
    return NextResponse.json({ error: "Bạn không có quyền quản trò phòng này." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const round = Number(body.round);

  if (![1, 2, 3].includes(round)) {
    return NextResponse.json({ error: "Số vòng không hợp lệ." }, { status: 400 });
  }

  const readyForNext = room.phase === "lobby" || room.phase === "round_leaderboard";
  const expectedRound = room.round + 1;
  if (!readyForNext || round !== expectedRound) {
    return NextResponse.json({ error: "Chưa thể bắt đầu vòng này ngay bây giờ." }, { status: 400 });
  }

  const message = room.uploadedMessages && room.uploadedMessages[round];
  if (!message) {
    return NextResponse.json(
      { error: "Chưa có thông điệp cho vòng này. Hãy tải lên file Excel thông điệp trước." },
      { status: 400 }
    );
  }
  if (Object.keys(room.players).length === 0) {
    return NextResponse.json({ error: "Chưa có người chơi nào tham gia phòng." }, { status: 400 });
  }

  const questions = generateQuestions(round, message);

  room.roundData[round] = {
    message,
    topic: TOPICS[round],
    questions,
  };
  room.round = round;
  room.currentQuestionIndex = -1;
  room.questionStartedAt = null;
  room.phase = "round_intro";
  room.paused = false;
  room.pausedAt = null;
  touchRoom(room);
  await saveRoom(room);

  return NextResponse.json({ ok: true, topic: TOPICS[round], questions });
}
