export const documentCategories = [
  "discharge",
  "insurance",
  "care_plan",
  "medical_record",
  "identification",
  "other",
] as const;

export type DocumentCategory = (typeof documentCategories)[number];

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  discharge: "Discharge",
  insurance: "Insurance",
  care_plan: "Care plan",
  medical_record: "Medical record",
  identification: "Identification",
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
