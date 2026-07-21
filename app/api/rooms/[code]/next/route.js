import { NextResponse } from "next/server";
import { getRoom, isHost, touchRoom, saveRoom } from "@/lib/store";

// Single "advance the game" action, called automatically by the host
// client's timers (question timer expiring, reveal delay elapsing) to
// drive the whole state machine: round_intro -> question ->
// question_result -> (next question or round_leaderboard) -> finished.
// Blocked while the host has paused the game.
export async function POST(request, { params }) {
  const room = await getRoom(params.code);
  if (!room) {
    return NextResponse.json({ error: "Không tìm thấy phòng." }, { status: 404 });
  }
  const hostToken = request.headers.get("x-host-token");
  if (!isHost(room, hostToken)) {
    return NextResponse.json({ error: "Bạn không có quyền quản trò phòng này." }, { status: 403 });
  }
  if (room.paused) {
    return NextResponse.json({ error: "Trò chơi đang tạm dừng." }, { status: 400 });
  }

  const rd = room.roundData[room.round];

  switch (room.phase) {
    case "round_intro": {
      room.phase = "question";
      room.currentQuestionIndex = 0;
      room.questionStartedAt = Date.now();
      break;
    }
    case "question": {
      room.phase = "question_result";
      break;
    }
    case "question_result": {
      const total = rd ? rd.questions.length : 5;
      if (room.currentQuestionIndex < total - 1) {
        room.currentQuestionIndex += 1;
        room.phase = "question";
        room.questionStartedAt = Date.now();
      } else {
        // Round finished: stop the game entirely (per host request) until
        // the host explicitly starts the next round or ends the game.
        room.phase = "round_leaderboard";
        room.paused = true;
        room.pausedAt = Date.now();
      }
      break;
    }
    case "round_leaderboard": {
      if (room.round >= 3) {
        room.phase = "finished";
      } else {
        return NextResponse.json(
          { error: "Hãy bắt đầu vòng tiếp theo để tiếp tục." },
          { status: 400 }
        );
      }
      break;
    }
    case "lobby": {
      return NextResponse.json(
        { error: "Hãy tải file Excel thông điệp và bắt đầu vòng 1 để bắt đầu." },
        { status: 400 }
      );
    }
    case "finished": {
      return NextResponse.json({ error: "Trò chơi đã kết thúc." }, { status: 400 });
    }
    default:
      return NextResponse.json({ error: "Trạng thái phòng không hợp lệ." }, { status: 400 });
  }

  touchRoom(room);
  await saveRoom(room);
  return NextResponse.json({ ok: true, phase: room.phase, paused: room.paused });
}
