import { NextResponse } from "next/server";
import { createRoom } from "@/lib/store";
import { HOST_PASSWORD } from "@/lib/config";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const password = (body.password || "").toString();

  if (password !== HOST_PASSWORD) {
    return NextResponse.json({ error: "Sai mật khẩu quản trò." }, { status: 401 });
  }

  const room = createRoom();
  return NextResponse.json({ code: room.code, hostToken: room.hostToken });
}
