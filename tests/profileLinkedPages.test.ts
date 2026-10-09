import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = (name: string) => readFileSync(
  new URL("../src/screens/" + name, import.meta.url),
  "utf8",
);
const pages = [
  "CareCoordinationInboxScreen.tsx",
  "PrivacyDataScreen.tsx",
  "PilotFeedbackScreen.tsx",
  "AccessibilityScreen.tsx",
];

test("all profile-linked pages use isolated glass components, not app-wide restyling", () => {
  for (const page of pages) {
    const source = load(page);
    assert.match(source, /from "\.\/ProfileLinkedUI"/, page);
    assert.match(source, /<Page>/, page);
    assert.match(source, /<Heading/, page);
    assert.doesNotMatch(source, /accessibilityLabel="Go back"/, page);
  }
});

test("coordination redesign retains scheduling, ownership and workflow actions", () => {
  const screen = load(pages[0]);
  for (const functionName of [
    "syncCoordinationConflicts",
    "loadCoordinationWorkflow",
    "assignCoordinationConflict",
    "snoozeCoordinationConflict",
    "resolveCoordinationConflict",
    "reopenCoordinationConflict",
    "addCoordinationComment",
    "currentActionableConflicts",
  ]) assert.ok(screen.includes(functionName), functionName);
  assert.match(screen, /NEXT 7 DAYS/);
  assert.match(screen, /counts\.timeSensitive/);
  assert.match(screen, /Viewer access is read-only/);
});

test("privacy redesign preserves secure session, exports, and explicit deletion safeguards", () => {
  const screen = load(pages[1]);
  for (const functionName of [
    "requestPasswordReset",
    "signOutOtherDevices",
    "exportAccountData",
    "exportCareRecipientData",
    "deleteCareRecipientData",
    "deleteOwnAccount",
    "submitTechnicalDiagnostic",
  ]) assert.ok(screen.includes(functionName), functionName);
  assert.match(screen, /showExportDetails/);
  assert.match(screen, /showCareDeletionDetails/);
  assert.match(screen, /careConfirmation !== state\.careRecipientName/);
  assert.match(screen, /deleteWord !== "DELETE"/);
  assert.match(screen, /deleteEmail\.trim\(\)/);
  assert.match(screen, /secureTextEntry/);
});

test("feedback redesign retains consent checks, required fields and submission", () => {
  const screen = load(pages[2]);
  assert.match(screen, /submitPilotFeedback/);
  assert.match(screen, /loadPilotConsentState/);
  assert.match(screen, /consent\.status !== "exited"/);
  assert.match(screen, /!summary\.trim\(\)/);
  assert.match(screen, /!detail\.trim\(\)/);
  assert.match(screen, /For feedback, not emergencies/);
});

test("accessibility redesign reads real system preferences", () => {
  const screen = load(pages[3]);
  assert.match(screen, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(screen, /AccessibilityInfo\.isScreenReaderEnabled/);
  assert.match(screen, /PixelRatio\.getFontScale/);
  assert.match(screen, /MINIMUM_TOUCH_TARGET/);
  assert.match(screen, /onPress=\{\(\) => void refresh\(\)\}/);
});

test("profile-linked UI retains accessible labels, keyboard insets and reduced motion", () => {
  const screen = load("ProfileLinkedUI.tsx");
  assert.match(screen, /automaticallyAdjustKeyboardInsets/);
  assert.match(screen, /keyboardShouldPersistTaps="handled"/);
  assert.match(screen, /isReduceMotionEnabled/);
  assert.match(screen, /accessibilityRole="header"/);
  assert.match(screen, /accessibilityRole="button"/);
  assert.match(screen, /minHeight: 54/);
});
