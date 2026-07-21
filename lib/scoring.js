export const QUESTION_DURATION_MS = 20000;
export const MIN_POINTS = 500;
export const MAX_POINTS = 1000;

// Kahoot-style scoring: correct answers score more the faster they're
// submitted. Wrong / no answer scores 0.
export function computeScore(isCorrect, timeTakenMs, durationMs = QUESTION_DURATION_MS) {
  if (!isCorrect) return 0;
  const clampedTime = Math.max(0, Math.min(timeTakenMs, durationMs));
  const speedRatio = 1 - clampedTime / durationMs;
  const points = MIN_POINTS + (MAX_POINTS - MIN_POINTS) * speedRatio;
  return Math.round(points);
}
