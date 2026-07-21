import { NextResponse } from "next/server";
import { listOpenRooms } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Powers the "phòng đang mở" list on the home page — lets a player pick a
// room instead of needing the code typed or a QR scan. Only rooms still
// in the lobby are returned (join is refused server-side once a room has
// started anyway, so there's no point listing in-progress ones).
export async function GET() {
  const rooms = await listOpenRooms();
  return NextResponse.json({ rooms });
}
