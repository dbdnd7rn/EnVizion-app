import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profile = readFileSync(
  new URL("../src/screens/ProfileDashboardScreen.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

test("profile relies on the native stack header, not a duplicate inline back arrow", () => {
  assert.match(app, /name="Profile"[\s\S]*?component=\{themedScreen\(ProfileDashboardScreen\)\}[\s\S]*?title: "Your profile"/);
  assert.doesNotMatch(profile, /accessibilityLabel="Go back"/);
});

test("care overview statistics are not misleading duplicates of Care team navigation", () => {
  const summaryStart = profile.indexOf("<HeroReveal delay={45}>");
  const summaryEnd = profile.indexOf('      <View style={{ gap: 10 }}>', summaryStart);
  assert.ok(summaryStart >= 0 && summaryEnd > summaryStart);
  const summary = profile.slice(summaryStart, summaryEnd);
  assert.match(summary, /Care team/);
  assert.match(summary, /Care profiles/);
  assert.doesNotMatch(summary, /<Pressable/);
  assert.doesNotMatch(summary, /navigate\(/);
});

test("profile keeps account settings separate from the Care tab", () => {
  assert.match(profile, /Account & preferences/);
  assert.match(profile, /Account, privacy & data/);
  assert.match(profile, /Accessibility & display/);
  assert.match(profile, /Notification preferences/);
  assert.doesNotMatch(profile, /route: "CareTeam"/);
  assert.doesNotMatch(profile, /route: "CareCoordinationInbox"/);
  assert.doesNotMatch(profile, /route: "CareTasks"/);
});

test("account overview is display-only and profile photo editor remains available", () => {
  assert.doesNotMatch(profile, /accessibilityLabel="Your account and profile picture"/);
  assert.match(profile, /accessibilityLabel="Edit profile photo"/);
  assert.match(profile, /pickAndUpload/);
});
