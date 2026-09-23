import type { CareDocument } from "./documents";

export function ownerDocumentStatus(documents: CareDocument[], now = new Date()) {
  let keyDocuments = 0;
  let reviewAttention = 0;
  let archived = 0;

  for (const document of documents) {
    if (document.archivedAt) {
      archived += 1;
      continue;
    }

    if (document.isKeyDocument) keyDocuments += 1;

    if (document.reviewDueOn) {
      const due = new Date(document.reviewDueOn + "T23:59:59");
      if (Number.isFinite(due.getTime())) {
        const days = Math.ceil(
          (due.getTime() - now.getTime()) / 86_400_000,
        );
        if (days <= 30) reviewAttention += 1;
      }
    }
  }

  return { keyDocuments, reviewAttention, archived };
}

export function ownerReconciliationStatus(createdAt: string | null, now = new Date()) {
  if (!createdAt) return { label: "Not reconciled", needsReview: true };

  const at = new Date(createdAt);
  if (!Number.isFinite(at.getTime())) {
    return { label: "Review date unavailable", needsReview: true };
  }

  const days = Math.max(
    0,
    Math.floor((now.getTime() - at.getTime()) / 86_400_000),
  );

  if (days === 0) return { label: "Reconciled today", needsReview: false };
  if (days <= 7) {
    return {
      label: `Reconciled ${days} day${days === 1 ? "" : "s"} ago`,
      needsReview: false,
    };
  }

  return {
    label: `Last reconciled ${days} days ago`,
    needsReview: true,
  };
}
