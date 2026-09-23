export const documentCategories = [
  "discharge",
  "insurance",
  "care_plan",
  "medical_record",
  "identification",
  "advance_directive",
  "medication_list",
  "lab_result",
  "other",
] as const;

export type DocumentCategory = (typeof documentCategories)[number];

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  discharge: "Discharge",
  insurance: "Insurance",
  care_plan: "Care plan",
  medical_record: "Medical record",
  identification: "Identification",
  advance_directive: "Advance directive",
  medication_list: "Medication list",
  lab_result: "Lab result",
  other: "Other",
};

const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export function inferDocumentMime(name: string, declared?: string | null) {
  const clean = String(declared ?? "").trim().toLowerCase();
  if (clean) return clean;
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return mimeByExtension[extension] ?? "application/octet-stream";
}

export function formatDocumentBytes(value: number) {
  const bytes = Number.isFinite(value) && value > 0 ? value : 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function documentIconName(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image-outline";
  if (mimeType === "application/pdf") return "document-text-outline";
  if (
    mimeType === "application/msword" ||
    mimeType.includes("wordprocessingml")
  ) {
    return "document-outline";
  }
  return "attach-outline";
}

export type DocumentReviewState =
  | "none"
  | "future"
  | "due_soon"
  | "overdue";

export function documentReviewState(
  reviewDueOn: string | null | undefined,
  now = new Date(),
): DocumentReviewState {
  if (!reviewDueOn) return "none";
  const due = new Date(reviewDueOn + "T23:59:59");
  if (!Number.isFinite(due.getTime())) return "none";
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 30) return "due_soon";
  return "future";
}

export function documentReviewLabel(
  reviewDueOn: string | null | undefined,
  now = new Date(),
) {
  const state = documentReviewState(reviewDueOn, now);
  if (state === "overdue") return "Review date passed";
  if (state === "due_soon") return "Review due within 30 days";
  if (state === "future") return "Review scheduled";
  return "No review date";
}
