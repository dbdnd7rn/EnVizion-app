import type { DoctorVisitSummary } from "./doctorVisits";

export type VisitSummaryDraft = {
  summaryText: string;
  newOrders: string;
  actionItems: string;
  redFlags: string;
};

/** Prefer the newest unapproved revision over an older approved version. */
export function preferredDoctorVisitSummary(
  summaries: readonly DoctorVisitSummary[],
): DoctorVisitSummary | null {
  const drafts = summaries.filter(row => row.status === "draft");
  if (drafts.length) {
    return drafts.reduce((latest, row) =>
      Date.parse(row.createdAt) > Date.parse(latest.createdAt) ? row : latest);
  }
  const approved = summaries.filter(row => row.status === "approved");
  if (!approved.length) return null;
  return approved.reduce((latest, row) =>
    Date.parse(row.createdAt) > Date.parse(latest.createdAt) ? row : latest);
}

const normalizedLines = (value: string) => value
  .split(/\r?\n/)
  .map(line => line.replace(/^[-•]\s*/, "").trim())
  .filter(Boolean);

const sameLines = (left: string, right: readonly string[]) => {
  const a = normalizedLines(left);
  const b = right.map(item => item.trim()).filter(Boolean);
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

/** True if the visible editor differs from what was last persisted. */
export function isDoctorVisitSummaryDirty(
  draft: VisitSummaryDraft,
  saved: DoctorVisitSummary | null,
): boolean {
  return draft.summaryText.trim() !== (saved?.summaryText ?? "").trim()
    || !sameLines(draft.newOrders, saved?.newOrders ?? [])
    || !sameLines(draft.actionItems, saved?.actionItems ?? [])
    || !sameLines(draft.redFlags, saved?.redFlags ?? []);
}

/** Published recaps must never be silently replaced with a new unseen revision. */
export function canReviseDoctorVisit(status: string): boolean {
  return status !== "published" && status !== "cancelled";
}

/**
 * The AI must read what the user sees, not the previous saved version.
 * This comparison ensures we save unsaved notes before requesting the draft.
 */
export function visitCaptureHasUnsavedChanges(
  rawNotes: string,
  transcriptText: string,
  saved: { rawNotes: string; transcriptText: string },
): boolean {
  return rawNotes.trim() !== saved.rawNotes.trim()
    || transcriptText.trim() !== saved.transcriptText.trim();
}


/**
 * Await persistence before triggering AI. A save failure must propagate
 * and prevent inference from stale notes.
 */
export async function generateDoctorVisitDraftSafely<T>(input: {
  needsSave: boolean;
  save: () => Promise<unknown>;
  generate: () => Promise<T>;
}): Promise<T> {
  if (input.needsSave) await input.save();
  return input.generate();
}
