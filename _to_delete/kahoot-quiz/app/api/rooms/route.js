import { NextResponse } from "next/server";
import { createRoom } from "@/lib/store";

export async function POST() {
  const room = createRoom();
  return NextResponse.json({ code: room.code, hostToken: room.hostToken });
}
