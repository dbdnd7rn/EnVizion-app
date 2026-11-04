import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../src/screens/PatientExperience.tsx", import.meta.url), "utf8");
const tabs = app.slice(app.indexOf("function PatientTabs()"), app.indexOf("function FamilyTabs()"));
const home = screen.slice(screen.indexOf("export function PatientHomeScreen()"), screen.indexOf("export function PatientCareHubScreen()"));
const care = screen.slice(screen.indexOf("export function PatientCareHubScreen()"), screen.indexOf("export function PatientDayScreen()"));
const team = screen.slice(screen.indexOf("export function PatientTeamScreen()"), screen.indexOf("export function PatientHistoryScreen()"));
const profile = screen.slice(screen.indexOf("export function PatientProfileScreen()"));

test("care recipient has four unique primary destinations", () => {
  const destinations = [...tabs.matchAll(/<Tab.Screen name="(Patient\w+)"/g)].map(match => match[1]);
  assert.deepEqual(destinations, ["PatientHome", "PatientCare", "PatientTeam", "PatientProfile"]);
  assert.doesNotMatch(tabs, /name="PatientAI"/);
});

test("home is a dashboard, not a second copy of My Care or Care Team", () => {
  assert.match(home, /<Brand\/>/);
  assert.match(home, /<NotificationBell/);
  assert.match(home, /<PatientCount value=\{today\.length\}/);
  assert.match(home, /<PatientPlanContent plan=\{plan\} limit=\{1\}/);
  assert.doesNotMatch(home, /n\.navigate\("CareTeamChat"|<PatientTile|tabs\.navigate|Message my care team/);
});

test("My Care owns each detail screen and the standalone EnVizion AI entrance", () => {
  for (const route of ["PatientDay","PatientMedications","PatientAppointments","PatientHealth","PatientHistory","Assistant"]) {
    const pattern = new RegExp('n\\.navigate\\("' + route + '"\\)');
    assert.equal([...care.matchAll(new RegExp(pattern.source,"g"))].length, 1, route);
  }
  assert.match(care, /<PatientTile title="EnVizion AI"/);
  assert.doesNotMatch(team, /n\.navigate\("Assistant"/);
  assert.doesNotMatch(home, /n\.navigate\("Assistant"/);
});

test("Care Team chat and profile settings are not duplicated", () => {
  assert.equal((team.match(/n\.navigate\("CareTeamChat"/g) ?? []).length, 1);
  assert.equal((profile.match(/n\.navigate\("Accessibility"/g) ?? []).length, 1);
  assert.equal((profile.match(/n\.navigate\("NotificationSettings"/g) ?? []).length, 1);
  assert.equal((profile.match(/n\.navigate\("PrivacyData"/g) ?? []).length, 1);
  assert.doesNotMatch(profile, /setMode\(|Switch to dark mode|Switch to light mode/);
  assert.match(profile, /careAccessOpen && <AccountCareAccessPanel\/>/);
});

test("graphic cards preserve essential record details and safe read-only behavior", () => {
  assert.match(screen, /function PatientTile\(/);
  assert.match(screen, /<Svg width=\{95\}/);
  assert.match(screen, /accessibilityState=\{\{ expanded: detailMedId === med\.id \}\}/);
  assert.match(screen, /med\.instructions/);
  assert.match(screen, /item\.details/);
  assert.match(screen, /item\.notes/);
  assert.match(screen, /Read only · Follow your clinician/);
  assert.doesNotMatch(screen, /recordMedicationDose\(|saveObservation\(/);
});
