import test from "node:test";
import assert from "node:assert/strict";
import { launchReadiness } from "../src/launchReadiness.ts";

const pilot: any = {
  activePilot: 2,
  activeConsentComplete: 2,
};

const operations: any = {
  openDiagnostics: 0,
  failedPackets24h: 0,
  failedPushes24h: 0,
  staleSupport48h: 0,
};

test("launch readiness is ready when operational signals are clear", () => {
  assert.deepEqual(
    launchReadiness({
      pilot,
      operations,
      publishedRequiredDocuments: 3,
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
    operations: { ...operations, failedPackets24h: 1 },
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

  assert.equal(result.level, "attention");
  assert.match(result.issues.join(" "), /no required participation documents/i);
});
