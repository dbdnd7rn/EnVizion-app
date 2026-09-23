import { test } from "node:test";
import assert from "node:assert/strict";
import {
  documentCategoryLabels,
  documentIconName,
  documentReviewLabel,
  documentReviewState,
  formatDocumentBytes,
  inferDocumentMime,
} from "../src/documentHelpers.ts";

test("document mime inference uses declared type first", () => {
  assert.equal(
    inferDocumentMime("report.pdf", "application/custom"),
    "application/custom",
  );
});

test("document mime inference recognizes allowed extensions", () => {
  assert.equal(
    inferDocumentMime("care-plan.docx"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal(inferDocumentMime("photo.HEIC"), "image/heic");
  assert.equal(inferDocumentMime("notes.txt"), "text/plain");
});

test("document size formatter uses readable units", () => {
  assert.equal(formatDocumentBytes(512), "512 B");
  assert.equal(formatDocumentBytes(1536), "1.5 KB");
  assert.equal(formatDocumentBytes(2 * 1024 * 1024), "2.0 MB");
});

test("document icon helper separates images, PDFs, and Word files", () => {
  assert.equal(documentIconName("image/png"), "image-outline");
  assert.equal(documentIconName("application/pdf"), "document-text-outline");
  assert.equal(documentIconName("application/msword"), "document-outline");
});

test("document category labels expose care-friendly names", () => {
  assert.equal(documentCategoryLabels.discharge, "Discharge");
  assert.equal(documentCategoryLabels.care_plan, "Care plan");
  assert.equal(documentCategoryLabels.advance_directive, "Advance directive");
  assert.equal(documentCategoryLabels.medication_list, "Medication list");
});

test("document review helper distinguishes due-soon and overdue dates", () => {
  const now = new Date("2026-09-24T00:00:00Z");
  assert.equal(documentReviewState("2026-09-20", now), "overdue");
  assert.equal(documentReviewState("2026-10-10", now), "due_soon");
  assert.equal(documentReviewState("2027-01-10", now), "future");
  assert.equal(documentReviewLabel("2026-09-20", now), "Review date passed");
});
