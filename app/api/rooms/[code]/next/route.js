import { NextResponse } from "next/server";
import { getRoom, isHost, touchRoom, saveRoom } from "@/lib/store";

// Single "advance the game" action the host uses to drive the whole
// state machine: round_intro -> question -> question_result -> (next
// question or round_leaderboard) -> finished.
export async function POST(request, { params }) {
  const room = await getRoom(params.code);
  if (!room) {
    return NextResponse.json({ error: "Không tìm thấy phòng." }, { status: 404 });
  }
  const hostToken = request.headers.get("x-host-token");
  if (!isHost(room, hostToken)) {
    return NextResponse.json({ error: "Bạn không có quyền quản trò phòng này." }, { status: 403 });
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
        room.phase = "round_leaderboard";
      }
      break;
    }
    case "round_leaderboard": {
      if (room.round >= 3) {
        room.phase = "finished";
      } else {
        return NextResponse.json(
          { error: "Hãy nhập thông điệp cho vòng tiếp theo để tiếp tục." },
          { status: 400 }
        );
      }
      break;
    }
    case "lobby": {
      return NextResponse.json(
        { error: "Hãy nhập thông điệp vòng 1 để bắt đầu." },
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
  return NextResponse.json({ ok: true, phase: room.phase });
}
