export function sessionExpiryLabel(
  expiresAt: string | null,
  now = new Date(),
) {
  if (!expiresAt) return "Session expiry unavailable";
  const at = new Date(expiresAt);
  if (!Number.isFinite(at.getTime())) return "Session expiry unavailable";
  const minutes = Math.max(
    0,
    Math.ceil((at.getTime() - now.getTime()) / 60_000),
  );
  if (minutes <= 1) return "Session refresh due very soon";
  if (minutes < 60) return `Session refresh in about ${minutes} minutes`;
  return `Session refresh in about ${Math.ceil(minutes / 60)} hours`;
}
