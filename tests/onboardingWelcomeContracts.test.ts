import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const welcome = fs.readFileSync("src/components/OnboardingWelcomeStep.tsx", "utf8");
const onboarding = fs.readFileSync("src/screens/SupportScreens.tsx", "utf8");

test("welcome redesign preserves first-step wording and feature meaning", () => {
  assert.ok(welcome.includes("Care is a journey."));
  assert.ok(welcome.includes("Let’s walk together."));
  assert.ok(welcome.includes("A calmer place to organize care, prepare for appointments, coordinate"));
  assert.ok(welcome.includes("Organize everyday care"));
  assert.ok(welcome.includes("Coordinate the people around care"));
  assert.ok(welcome.includes("Be ready when it matters"));
  assert.ok(welcome.includes("Let’s get started"));
});

test("welcome step uses the real brand and live onboarding step state", () => {
  assert.ok(welcome.includes("<Brand />"));
  assert.ok(welcome.includes("WELCOME • {step + 1} / {totalSteps}"));
  assert.ok(onboarding.includes("<OnboardingWelcomeStep"));
  assert.ok(onboarding.includes("step={step}"));
  assert.ok(onboarding.includes("totalSteps={3}"));
});

test("welcome start button advances into the existing onboarding flow", () => {
  assert.ok(onboarding.includes("onContinue={() => setStep(1)}"));
  assert.ok(onboarding.includes("step === 1"));
  assert.ok(onboarding.includes("CHOOSE YOUR EXPERIENCE"));
});

test("ambient welcome motion respects reduced motion and focus cleanup", () => {
  assert.ok(welcome.includes("AccessibilityInfo.isReduceMotionEnabled"));
  assert.ok(welcome.includes("useIsFocused"));
  assert.ok(welcome.includes("loop.stop()"));
  assert.ok(welcome.includes("stopAnimation()"));
  assert.ok(welcome.includes("useFloatLoop(animate, 8, 2800)"));
});

test("welcome artwork is layered rather than a screenshot or blocking loader", () => {
  assert.ok(welcome.includes("function GlassHeart"));
  assert.ok(welcome.includes("function GlassTile"));
  assert.ok(welcome.includes("function WelcomeHeroArtwork"));
  assert.ok(welcome.includes("welcomeOrbit"));
  assert.ok(welcome.includes("journeyX"));
  assert.equal(/require\([^)]*welcome[^)]*\.png/i.test(welcome), false);
  assert.equal(welcome.includes("ActivityIndicator"), false);
});
