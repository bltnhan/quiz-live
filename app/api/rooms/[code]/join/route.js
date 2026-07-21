import { NextResponse } from "next/server";
import { getRoom, addPlayer, saveRoom } from "@/lib/store";

export async function POST(request, { params }) {
  const room = await getRoom(params.code);
  if (!room) {
    return NextResponse.json({ error: "Không tìm thấy phòng. Kiểm tra lại mã phòng." }, { status: 404 });
  }
  if (room.phase !== "lobby") {
    return NextResponse.json({ error: "Phòng đã bắt đầu chơi, không thể tham gia lúc này." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").toString().trim();
  const icon = (body.icon || "").toString().trim();

  if (!name) {
    return NextResponse.json({ error: "Vui lòng nhập tên của bạn." }, { status: 400 });
  }
  if (Object.keys(room.players).length >= 300) {
    return NextResponse.json({ error: "Phòng đã đầy." }, { status: 400 });
  }

  const player = addPlayer(room, name, icon);
  await saveRoom(room);
  return NextResponse.json({ playerId: player.id, name: player.name, icon: player.icon });
}
