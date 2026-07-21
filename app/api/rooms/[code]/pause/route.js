import { NextResponse } from "next/server";
import { getRoom, isHost, touchRoom, saveRoom } from "@/lib/store";

// Lets the host freeze/resume the game clock mid-round. While paused, the
// auto-advance loop (driven by the host client's timers) and /answer
// submissions are both rejected. On resume we shift questionStartedAt
// forward by however long we were paused so elapsed-time based scoring
// and the countdown stay correct instead of jumping ahead.
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
  const paused = Boolean(body.paused);

  if (paused) {
    if (!room.paused) {
      room.paused = true;
      room.pausedAt = Date.now();
    }
  } else if (room.paused) {
    if (room.pausedAt && room.questionStartedAt) {
      const pausedMs = Date.now() - room.pausedAt;
      room.questionStartedAt += pausedMs;
    }
    room.paused = false;
    room.pausedAt = null;
  }

  touchRoom(room);
  await saveRoom(room);
  return NextResponse.json({ ok: true, paused: room.paused });
}
