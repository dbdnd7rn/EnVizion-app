import test from "node:test";
import assert from "node:assert/strict";
import { launchReadiness } from "../src/launchReadiness.ts";

const pilot: any = {
  activePilot: 2,
  activeConsentComplete: 2,
};

const operations: any = {
  openDiagnostics: 0,
  failedPacketExports24h: 0,
  pushDeliveryErrors24h: 0,
  staleSupportRequests: 0,
};

test("launch readiness is ready when operational signals are clear", () => {
  assert.deepEqual(
    launchReadiness({
      pilot,
      operations,
      publishedRequiredDocuments: 3,
      publishedRequiredDocumentTypes: ["privacy_notice", "pilot_consent", "terms_of_use"],
    }),
    {
      level: "ready",
      issues: [],
    },
  );
});

test("launch readiness blocks on packet failures", () => {
  const result = launchReadiness({
    pilot,
    operations: { ...operations, failedPacketExports24h: 1 },
    publishedRequiredDocuments: 3,
  });

  assert.equal(result.level, "blocked");
  assert.match(result.issues.join(" "), /packet export failure/i);
});

test("launch readiness flags missing required documents", () => {
  const result = launchReadiness({
    pilot,
    operations,
    publishedRequiredDocuments: 0,
  });

  assert.equal(result.level, "blocked");
  assert.match(result.issues.join(" "), /required participation documents/i);
});


test("launch readiness rejects 3 documents that do not cover all required types", () => {
  const result = launchReadiness({
    pilot,
    operations,
    publishedRequiredDocuments: 3,
    publishedRequiredDocumentTypes: ["privacy_notice", "privacy_notice", "terms_of_use"],
  });
  assert.equal(result.level, "blocked");
  assert.match(result.issues.join(" "), /Pilot participation consent/);
});

test("pilot readiness cannot be green before anyone has actually joined the active pilot", () => {
  const result = launchReadiness({
    pilot: { ...pilot, activePilot: 0, activeConsentComplete: 0 },
    operations,
    publishedRequiredDocuments: 3,
    publishedRequiredDocumentTypes: ["privacy_notice", "pilot_consent", "terms_of_use"],
  });
  assert.notEqual(result.level, "ready");
  assert.match(result.issues.join(" "), /No active pilot participants/);
});

test("a complete, consent-current pilot with all 3 types can have clear operational signals", () => {
  const result = launchReadiness({
    pilot,
    operations,
    publishedRequiredDocuments: 3,
    publishedRequiredDocumentTypes: ["privacy_notice", "pilot_consent", "terms_of_use"],
  });
  assert.deepEqual(result, { level: "ready", issues: [] });
});
