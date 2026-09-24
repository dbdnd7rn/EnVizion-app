import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptanceStepsForRole,
  deviceChecksForPlatform,
  gateHeadline,
  runCanPass,
  validationProgress,
} from "../src/launchValidationHelpers.ts";

test("each care role has a real acceptance journey", () => {
  assert.equal(acceptanceStepsForRole("owner").length >= 5, true);
  assert.equal(acceptanceStepsForRole("caregiver").length >= 5, true);
  assert.equal(acceptanceStepsForRole("viewer").length >= 5, true);
});

test("device QA includes platform-specific safe-area validation", () => {
  assert.equal(
    deviceChecksForPlatform("ios").some((step) => step.id === "ios_safe_area"),
    true,
  );
  assert.equal(
    deviceChecksForPlatform("android").some(
      (step) => step.id === "android_system_nav",
    ),
    true,
  );
  assert.equal(
    deviceChecksForPlatform("web").some(
      (step) => step.id === "responsive_layout",
    ),
    true,
  );
});

test("acceptance cannot pass until both journey and device checks are complete", () => {
  const roleSteps = acceptanceStepsForRole("owner");
  const deviceSteps = deviceChecksForPlatform("ios");
  const steps = Object.fromEntries(roleSteps.map((step) => [step.id, true]));
  const deviceChecks = Object.fromEntries(
    deviceSteps.map((step) => [step.id, true]),
  );

  assert.equal(
    runCanPass({
      role: "owner",
      platform: "ios",
      steps,
      deviceChecks,
    }),
    true,
  );

  deviceChecks.ios_safe_area = false;
  assert.equal(
    runCanPass({
      role: "owner",
      platform: "ios",
      steps,
      deviceChecks,
    }),
    false,
  );
});

test("validation progress and gate copy remain deterministic", () => {
  assert.deepEqual(
    validationProgress(
      { one: true, two: false },
      [
        { id: "one", title: "One", detail: "" },
        { id: "two", title: "Two", detail: "" },
      ],
    ),
    { complete: 1, total: 2, ready: false },
  );
  assert.equal(gateHeadline(false, ["a", "b"]), "2 launch blockers remain.");
});
