import test from "node:test";
import assert from "node:assert/strict";
import {
  pilotFunnelRate,
  pilotOutcomeReportHtml,
  type PilotIntelligence,
} from "../src/pilotIntelligence.ts";

const empty: PilotIntelligence = {
  generatedAt: "2026-09-24T00:00:00Z",
  funnel: {
    enrolled: 0,
    accountConfirmed: 0,
    firstSignIn: 0,
    documentsComplete: 0,
    roleReady: 0,
    activeLaunchReady: 0,
    passedValidation: 0,
    completed: 0,
  },
  deviceMatrix: [],
  feedbackTrends: [],
  waveComparisons: [],
  outcomes: {
    completed: 0,
    withdrawn: 0,
    active: 0,
    paused: 0,
  },
  contentReadiness: {
    total: 8,
    draft: 8,
    published: 0,
    retired: 0,
  },
  launchGaps: ["No real pilot participants are enrolled."],
};

test("funnel rate stays finite for an empty pilot", () => {
  assert.equal(pilotFunnelRate(0, 0), 0);
  assert.equal(pilotFunnelRate(1, 4), 25);
});

test("pilot outcome report keeps launch dependencies explicit", () => {
  const html = pilotOutcomeReportHtml(empty);
  assert.match(html, /EnVizion Life Pilot Outcome Report/);
  assert.match(html, /No real pilot participants are enrolled/);
  assert.match(html, /0\/8 published/);
  assert.match(html, /not a clinical-safety/i);
});

test("pilot report escapes feedback and wave content", () => {
  const html = pilotOutcomeReportHtml({
    ...empty,
    feedbackTrends: [
      {
        category: "<script>alert(1)</script>",
        total: 1,
        open: 1,
        closed: 0,
        last30Days: 1,
      },
    ],
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});
