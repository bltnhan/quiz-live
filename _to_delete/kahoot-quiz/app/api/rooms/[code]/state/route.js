import { NextResponse } from "next/server";
import { getRoom, isHost, serializeState } from "@/lib/store";

export async function GET(request, { params }) {
  const room = getRoom(params.code);
  if (!room) {
    return NextResponse.json({ error: "Không tìm thấy phòng." }, { status: 404 });
  }

  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId");
  const hostToken =
    request.headers.get("x-host-token") || url.searchParams.get("hostToken");
  const hostReq = isHost(room, hostToken);

  return NextResponse.json(serializeState(room, { hostReq, playerId }));
}
