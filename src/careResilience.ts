export type CareSyncStatus =
  | "loading"
  | "synced"
  | "stale";

export function careSyncLabel(input: {
  status: CareSyncStatus;
  lastSyncedAt: string | null;
}) {
  if (input.status === "loading") return "Refreshing care data…";
  if (input.status === "stale") {
    return input.lastSyncedAt
      ? "Connection interrupted · showing the last loaded care data"
      : "Connection interrupted · live care data is unavailable";
  }
  if (!input.lastSyncedAt) return "Live care data connected";

  const date = new Date(input.lastSyncedAt);
  return Number.isFinite(date.getTime())
    ? `Live care data · synced ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Live care data connected";
}
