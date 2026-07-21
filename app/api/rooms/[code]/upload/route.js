import { NextResponse } from "next/server";
import { getRoom, isHost, saveRoom } from "@/lib/store";
import { extractRoundMessages } from "@/lib/xlsxMessages";

// Host uploads one Excel file containing the messages for all 3 rounds
// (using the provided sample template, or their own file with the same
// "Vòng" / "Thông điệp" columns). We parse it once here and store the
// resulting per-round message text on the room — no manual typing needed
// before each round.
export async function POST(request, { params }) {
  const room = await getRoom(params.code);
  if (!room) {
    return NextResponse.json({ error: "Không tìm thấy phòng." }, { status: 404 });
  }
  const hostToken = request.headers.get("x-host-token");
  if (!isHost(room, hostToken)) {
    return NextResponse.json({ error: "Bạn không có quyền quản trò phòng này." }, { status: 403 });
  }
  if (room.phase !== "lobby") {
    return NextResponse.json(
      { error: "Chỉ có thể tải file thông điệp khi phòng đang ở phòng chờ." },
      { status: 400 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData ? formData.get("file") : null;
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Vui lòng chọn file Excel (.xlsx)." }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = extractRoundMessages(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: "Không đọc được file Excel. Hãy kiểm tra lại định dạng file (.xlsx)." },
      { status: 400 }
    );
  }

  if (parsed.missing.length > 0) {
    return NextResponse.json(
      {
        error: `File Excel thiếu thông điệp cho vòng: ${parsed.missing.join(", ")}. Kiểm tra lại cột "Vòng" và cột "Thông điệp" trong file.`,
      },
      { status: 400 }
    );
  }

  room.uploadedMessages = parsed.messages;
  room.uploadedFileName = (file.name || "thong-diep.xlsx").toString().slice(0, 120);
  await saveRoom(room);

  return NextResponse.json({
    ok: true,
    fileName: room.uploadedFileName,
    preview: {
      1: parsed.messages[1].slice(0, 220),
      2: parsed.messages[2].slice(0, 220),
      3: parsed.messages[3].slice(0, 220),
    },
  });
}
