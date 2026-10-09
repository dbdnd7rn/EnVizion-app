import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/screens/MainScreens.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../src/screens/ProfileDashboardScreen.tsx", import.meta.url), "utf8");

function section(start: string, end: string) {
  const from = main.indexOf(start);
  const to = main.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Could not find ${start}`);
  return main.slice(from, to);
}

const home = section("export function HomeScreen()", "export function ToolkitScreen()");
const care = section("export function ToolkitScreen()", "function LearnHeroGraphic()");
const learn = section("export function LibraryScreen()", "export function SupportScreen()");
const support = main.slice(main.indexOf("export function SupportScreen()"));

test("Account contains settings, not a second care-tool directory", () => {
  assert.match(profile, /Account & preferences/);
  assert.doesNotMatch(profile, /navigationItems\.map/);
  assert.doesNotMatch(profile, /route: "CareTeam"/);
  assert.doesNotMatch(profile, /route: "CareTasks"/);
  assert.doesNotMatch(profile, /route: "CareCoordinationInbox"/);
});

test("Care directory has one canonical entry per care feature", () => {
  const required = [
    "CareTeam", "CarePlan", "Medications", "CareCalendar",
    "CareTasks", "CareSchedule", "CareContacts",
    "CareCoordinationInbox", "Transition",
  ];
  for (const route of required) {
    const matches = care.match(new RegExp('onPress: \\(\\) => n\\.navigate\\("' + route + '"', "g")) ?? [];
    assert.equal(matches.length, 1, `${route} should have one directory entry`);
  }
});

test("Care tab does not repeat category links in suggested or quick lists", () => {
  assert.doesNotMatch(care, /personalizedItems\.map/);
  assert.doesNotMatch(care, /title="Today"\s+subtitle="Tasks & handoffs"/);
  assert.match(care, /findCareTools/);
  assert.match(care, /<ToolGroup/);
  assert.match(care, /scope === "pinned"/);
});

test("educational navigation has a single home under Learn", () => {
  assert.doesNotMatch(care, /n\\.navigate\\("Specialists"\\)/);
  assert.match(learn, /n\\.navigate\\("Specialists"\\)/);
  assert.doesNotMatch(learn, /Medication basics/);
  assert.match(learn, /popular\\.map\\(\\(guide/);
});

test("Support no longer duplicates clinical care tools", () => {
  assert.doesNotMatch(support, /n\.navigate\("Transition"\)/);
  assert.doesNotMatch(support, /n\.navigate\("Specialists"\)/);
  assert.match(support, /n\.navigate\("Assistant"\)/);
  assert.match(support, /n\.navigate\("Coaching"\)/);
  assert.match(support, /n\.navigate\("Wellness"\)/);
});

test("Home has contextual shortcuts without re-listing care and support", () => {
  assert.doesNotMatch(home, /n\.navigate\("Assistant"\)/);
  assert.doesNotMatch(home, /n\.navigate\("DoctorVisitCompanion"\)/);
  assert.doesNotMatch(home, /title="Family coordination"/);
  assert.match(home, /\{logged && \(/);
  assert.match(home, /\{!logged && \(/);
  assert.match(home, /n\.navigate\("Main", \{ screen: "Toolkit" \}\)/);
});
