import { NextResponse } from "next/server";
import { HOST_PASSWORD } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Just checks the host password — does NOT create a room. Splits "log in
// as host" from "create a room" into two separate steps: after logging
// in here, the host lands on a dashboard (/host) with a "Tạo phòng mới"
// button they can press whenever they're ready.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const password = (body.password || "").toString();

  if (!password || password !== HOST_PASSWORD) {
    return NextResponse.json({ error: "Sai mật khẩu quản trò." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
