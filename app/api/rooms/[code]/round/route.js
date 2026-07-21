import { NextResponse } from "next/server";
import { getRoom, isHost, touchRoom, saveRoom } from "@/lib/store";
import { generateQuestions } from "@/lib/questionGen";
import { TOPICS } from "@/lib/wordbanks";

// Host submits the "message" for the upcoming round. We auto-generate 5
// multiple-choice questions whose correct answers are keywords pulled
// straight out of that message.
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
  const message = (body.message || "").toString();

  if (![1, 2, 3].includes(round)) {
    return NextResponse.json({ error: "Số vòng không hợp lệ." }, { status: 400 });
  }

  const readyForNext = room.phase === "lobby" || room.phase === "round_leaderboard";
  const expectedRound = room.round + 1;
  if (!readyForNext || round !== expectedRound) {
    return NextResponse.json({ error: "Chưa thể bắt đầu vòng này ngay bây giờ." }, { status: 400 });
  }
  if (!message.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập thông điệp cho vòng này." }, { status: 400 });
  }
  if (Object.keys(room.players).length === 0) {
    return NextResponse.json({ error: "Chưa có người chơi nào tham gia phòng." }, { status: 400 });
  }

  const questions = generateQuestions(round, message);

  room.roundData[round] = {
    message: message.trim(),
    topic: TOPICS[round],
    questions,
  };
  room.round = round;
  room.currentQuestionIndex = -1;
  room.questionStartedAt = null;
  room.phase = "round_intro";
  touchRoom(room);
  await saveRoom(room);

  return NextResponse.json({ ok: true, topic: TOPICS[round], questions });
}
