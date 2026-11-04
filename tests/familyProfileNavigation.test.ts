import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const family = readFileSync(new URL("../src/screens/FamilyExperience.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../src/screens/FamilyProfileScreen.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../src/navigation.ts", import.meta.url), "utf8");
const avatar = readFileSync(new URL("../src/profileAvatar.tsx", import.meta.url), "utf8");

test("the family home avatar opens profile rather than signing out", () => {
  const home = family.slice(family.indexOf("export function FamilyHomeScreen"), family.indexOf("function FamilyReportCard"));
  assert.match(home, /accessibilityLabel="Open your family profile"/);
  assert.match(home, /onPress=\{\(\)=>n\.navigate\("FamilyProfile"\)\}/);
  assert.doesNotMatch(home, /signOut\(/);
});

test("family navigation keeps personal settings in its own restricted stack branch", () => {
  assert.match(navigation, /FamilyProfile: undefined/);
  const branch = app.slice(app.indexOf('state.accessRole === "patient" ? (', app.indexOf('function SignedInNavigation')), app.indexOf("</Stack.Navigator>", app.indexOf('function SignedInNavigation')));
  assert.match(branch, /name="FamilyProfile"/);
  assert.match(branch, /name="PrivacyData"/);
  assert.match(branch, /name="Accessibility"/);
  assert.match(branch, /name="NotificationSettings"/);
  assert.match(branch, /name="PilotFeedback"/);
  assert.doesNotMatch(branch, /name="CarePlan"/);
  assert.doesNotMatch(branch, /name="Medications"/);
});

test("family profile reuses the secure avatar store and offers personal settings", () => {
  assert.match(profile, /useProfileAvatar/);
  assert.match(profile, /<ProfileAvatar/);
  assert.match(profile, /pickAndUpload\(/);
  assert.match(profile, /remove\(\)/);
  assert.match(profile, /Family Member/);
  assert.match(profile, /user\?\.email/);
  for (const item of ["Account, privacy & data", "Accessibility & display", "Notification preferences", "Send feedback", "Sign out"]) {
    assert.ok(profile.includes(item), item);
  }
  assert.match(avatar, /storage\.from\(BUCKET\)\.upload/);
  assert.match(avatar, /\.upsert\(\{ id: userId, avatar_url: nextPath \}/);
  assert.doesNotMatch(profile, /CareTeamScreen|CarePlanScreen|MedicationManagementScreen/);
});
