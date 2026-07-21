import * as XLSX from "xlsx";

// Header cells are matched by a case-insensitive substring check so this
// works with the sample template ("Vòng" / "Thông điệp (dán vào ô nhập của
// Quản trò)") as well as a bare "Round" / "Message" header if a host builds
// their own file.
const ROUND_HEADER_HINTS = ["vòng", "round"];
const MESSAGE_HEADER_HINTS = ["thông điệp", "message", "nội dung"];

function findColumnIndex(headerRow, hints) {
  for (let i = 0; i < headerRow.length; i++) {
    const cell = String(headerRow[i] || "").toLowerCase();
    if (hints.some((h) => cell.includes(h))) return i;
  }
  return -1;
}

/**
 * Parse an uploaded Excel workbook (as a Buffer) and extract the round
 * message text for rounds 1-3.
 *
 * Every sheet whose header row has a column matching "Vòng"/"Round" AND a
 * column matching "Thông điệp"/"Message" is scanned; every matching data
 * row is appended to that round's message. This means a host can keep the
 * original sample sheet ("Thong diep mau") *and* their own custom sheet
 * ("Mau trong de tu soan") in the same file — content from every matching
 * row/sheet gets combined into one message per round, giving the question
 * generator more source material to pick keywords from. Sheets that don't
 * have both columns (instructions, term bank, question preview) are
 * skipped automatically.
 */
export function extractRoundMessages(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const collected = { 1: [], 2: [], 3: [] };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!rows.length) continue;

    const headerRow = rows[0];
    const roundCol = findColumnIndex(headerRow, ROUND_HEADER_HINTS);
    const msgCol = findColumnIndex(headerRow, MESSAGE_HEADER_HINTS);
    if (roundCol === -1 || msgCol === -1) continue;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const round = parseInt(row[roundCol], 10);
      const text = String(row[msgCol] || "").trim();
      if ([1, 2, 3].includes(round) && text) {
        collected[round].push(text);
      }
    }
  }

  const messages = {};
  const missing = [];
  for (const round of [1, 2, 3]) {
    const combined = collected[round].join(" ").replace(/\s+/g, " ").trim();
    if (combined) {
      messages[round] = combined;
    } else {
      missing.push(round);
    }
  }

  return { messages, missing };
}
