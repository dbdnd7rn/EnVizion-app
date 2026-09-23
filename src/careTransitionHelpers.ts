import type { CareTransitionFollowUp } from "./careTransition";

export function transitionFollowUpCounts(
  rows: CareTransitionFollowUp[],
) {
  return rows.reduce(
    (counts, row) => {
      counts.total += 1;
      if (row.status === "open") counts.open += 1;
      if (row.status === "completed") counts.completed += 1;
      return counts;
    },
    { total: 0, open: 0, completed: 0 },
  );
}

export function transitionFollowUpTiming(
  row: Pick<CareTransitionFollowUp, "status" | "dueAt">,
  now = new Date(),
) {
  if (row.status !== "open" || !row.dueAt) return "none" as const;
  const due = new Date(row.dueAt).getTime();
  if (!Number.isFinite(due)) return "none" as const;
  const diff = due - now.getTime();
  if (diff < 0) return "overdue" as const;
  if (diff <= 48 * 60 * 60_000) return "soon" as const;
  return "future" as const;
}
