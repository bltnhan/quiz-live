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
