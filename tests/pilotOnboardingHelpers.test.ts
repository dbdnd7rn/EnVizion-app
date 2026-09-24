import test from "node:test";
import assert from "node:assert/strict";
import {
  pilotOnboardingProgress,
  pilotOnboardingStageLabel,
  pilotOnboardingSteps,
} from "../src/pilotOnboardingHelpers.ts";
import type { PilotParticipant } from "../src/pilot.ts";

function participant(
  overrides: Partial<PilotParticipant> = {},
): PilotParticipant {
  return {
    userId: "user-1",
    email: "pilot@example.com",
    displayName: "Pilot User",
    status: "invited",
    cohort: "Pilot 1",
    enrolledAt: null,
    exitedAt: null,
    createdAt: "2026-09-24T00:00:00Z",
    updatedAt: "2026-09-24T00:00:00Z",
    invitation: {
      authInvitedAt: "2026-09-24T00:00:00Z",
      emailConfirmedAt: null,
      lastSignInAt: null,
      accountConfirmed: false,
      signedIn: false,
    },
    documents: {
      required: 3,
      accepted: 0,
      complete: false,
      publishedRequiredTypesComplete: true,
      missingRequiredTypes: [],
      outstanding: [],
    },
    roles: {
      owner: 0,
      caregiver: 0,
      viewer: 0,
      careProfileCount: 0,
      ready: false,
    },
    consentComplete: false,
    careProfileCount: 0,
    onboardingStage: "invitation_pending",
    activationBlockers: ["Invitation/account setup has not been completed"],
    readyForActivation: false,
    launchTestingReady: false,
    stalled: false,
    stalledHours: 0,
    stageStartedAt: "2026-09-24T00:00:00Z",
    nextAction: "Follow up on the account invitation",
    validation: {
      passedRuns: 0,
      canCompletePilot: false,
    },
    completion: null,
    ...overrides,
  };
}

test("pilot onboarding renders all five real readiness stages", () => {
  const steps = pilotOnboardingSteps(participant());
  assert.deepEqual(
    steps.map((step) => step.id),
    ["invitation", "sign_in", "documents", "role", "activation"],
  );
});

test("ready participant is not launch-ready until admin activation", () => {
  const ready = participant({
    invitation: {
      authInvitedAt: "2026-09-24T00:00:00Z",
      emailConfirmedAt: "2026-09-24T00:10:00Z",
      lastSignInAt: "2026-09-24T00:11:00Z",
      accountConfirmed: true,
      signedIn: true,
    },
    documents: {
      required: 3,
      accepted: 3,
      complete: true,
      publishedRequiredTypesComplete: true,
      missingRequiredTypes: [],
      outstanding: [],
    },
    roles: {
      owner: 0,
      caregiver: 1,
      viewer: 0,
      careProfileCount: 1,
      ready: true,
    },
    consentComplete: true,
    careProfileCount: 1,
    onboardingStage: "ready_for_activation",
    activationBlockers: [],
    readyForActivation: true,
  });

  const progress = pilotOnboardingProgress(ready);
  assert.equal(progress.readyForActivation, true);
  assert.equal(progress.launchTestingReady, false);
  assert.equal(progress.complete, 4);
});

test("active participant becomes launch testing ready only with all prerequisites", () => {
  const ready = participant({
    status: "active",
    invitation: {
      authInvitedAt: "2026-09-24T00:00:00Z",
      emailConfirmedAt: "2026-09-24T00:10:00Z",
      lastSignInAt: "2026-09-24T00:11:00Z",
      accountConfirmed: true,
      signedIn: true,
    },
    documents: {
      required: 3,
      accepted: 3,
      complete: true,
      publishedRequiredTypesComplete: true,
      missingRequiredTypes: [],
      outstanding: [],
    },
    roles: {
      owner: 1,
      caregiver: 0,
      viewer: 0,
      careProfileCount: 1,
      ready: true,
    },
    consentComplete: true,
    careProfileCount: 1,
    onboardingStage: "active_ready",
    activationBlockers: [],
    readyForActivation: true,
    launchTestingReady: true,
  });

  assert.equal(pilotOnboardingProgress(ready).complete, 5);
  assert.equal(
    pilotOnboardingStageLabel(ready.onboardingStage),
    "Launch testing ready",
  );
});

test("role readiness stays explicit instead of granting admin-side clinical access", () => {
  const item = participant({
    invitation: {
      authInvitedAt: "2026-09-24T00:00:00Z",
      emailConfirmedAt: "2026-09-24T00:10:00Z",
      lastSignInAt: "2026-09-24T00:11:00Z",
      accountConfirmed: true,
      signedIn: true,
    },
    documents: {
      required: 3,
      accepted: 3,
      complete: true,
      publishedRequiredTypesComplete: true,
      missingRequiredTypes: [],
      outstanding: [],
    },
    consentComplete: true,
    onboardingStage: "role_pending",
    activationBlockers: ["No active care-profile role is assigned"],
  });

  const roleStep = pilotOnboardingSteps(item).find((step) => step.id === "role");
  assert.equal(roleStep?.complete, false);
  assert.match(roleStep?.detail ?? "", /care owner must grant/i);
});
