import { test } from "node:test";
import assert from "node:assert/strict";
import {
  documentCategoryLabels,
  documentIconName,
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
  assert.equal(inferDocumentMime("care-plan.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
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

test("document category labels expose patient-facing names", () => {
  assert.equal(documentCategoryLabels.discharge, "Discharge");
  assert.equal(documentCategoryLabels.care_plan, "Care plan");
});
