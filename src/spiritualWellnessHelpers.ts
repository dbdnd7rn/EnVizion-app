export const QUIET_MOMENT_MS = 60_000;

export function quietMomentElapsedMs(
  startedAtMs: number,
  nowMs: number,
  durationMs = QUIET_MOMENT_MS,
) {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.min(durationMs, nowMs - startedAtMs));
}

export function quietMomentProgress(
  elapsedMs: number,
  durationMs = QUIET_MOMENT_MS,
) {
  if (!Number.isFinite(elapsedMs) || durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, elapsedMs / durationMs));
}

export function quietMomentRemainingSeconds(
  elapsedMs: number,
  durationMs = QUIET_MOMENT_MS,
) {
  const remainingMs = Math.max(0, durationMs - Math.max(0, elapsedMs));
  return Math.ceil(remainingMs / 1000);
}

export function formatQuietMomentClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
