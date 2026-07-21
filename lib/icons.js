// Preset avatar icons players can pick from when joining.
// Kept as emoji so no image assets are needed.
export const PLAYER_ICONS = [
  "🦊", "🐼", "🐸", "🐵", "🐯", "🦁", "🐨", "🐰",
  "🐱", "🐶", "🐺", "🦄", "🐷", "🐮", "🐔", "🐧",
  "🦉", "🐢", "🐙", "🦈", "🐳", "🦖", "🐝", "🦋",
  "🐲", "🦀", "🐴", "🦒", "🦓", "🐹", "🦔", "🐿️",
];

export function randomIcon() {
  return PLAYER_ICONS[Math.floor(Math.random() * PLAYER_ICONS.length)];
}

// Playful default names for the QR-scan join flow, so a player can join
// with zero typing (scan → tap "Tham gia") and still rename themselves
// afterwards if they want to.
const GUEST_NAME_PREFIXES = [
  "Khách", "Chiến binh", "Ẩn danh", "Ngôi sao", "Anh hùng", "Nhà vô địch",
];

export function randomGuestName() {
  const prefix = GUEST_NAME_PREFIXES[Math.floor(Math.random() * GUEST_NAME_PREFIXES.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix} ${num}`;
}
