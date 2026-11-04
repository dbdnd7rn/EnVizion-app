import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const patient = readFileSync(new URL("../src/screens/PatientExperience.tsx", import.meta.url), "utf8");
const familyProfile = readFileSync(new URL("../src/screens/FamilyProfileScreen.tsx", import.meta.url), "utf8");
const onboarding = readFileSync(new URL("../src/screens/SupportScreens.tsx", import.meta.url), "utf8");
const careTeam = readFileSync(new URL("../src/careTeam.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const backend = readFileSync(new URL("../src/backend.ts", import.meta.url), "utf8");

test("Care Recipient Profile exposes the shared invitation and care-space panel", () => {
  assert.match(patient, /import \{ AccountCareAccessPanel \} from "\.\/FamilyProfileScreen"/);
  const profile = patient.slice(patient.indexOf("export function PatientProfileScreen()"));
  assert.match(profile, /<AccountCareAccessPanel \/>/);
  assert.match(profile, /Change profile photo/);
  assert.match(profile, /Privacy & care sharing/);
  assert.match(profile, /Notifications/);
  assert.match(profile, /signOut\(\)/);
});

test("patient and family use one account-level control for pending invitations and authorized profiles", () => {
  assert.match(familyProfile, /export function AccountCareAccessPanel\(\)/);
  assert.match(familyProfile, /<AccountCareAccessPanel \/>/);
  assert.match(familyProfile, /loadPendingCareInvitations\(\)/);
  assert.match(familyProfile, /loadCareSpaces\(\)/);
  assert.match(familyProfile, /await respondToCareInvitation\(invitation\.careRecipientId, action\)/);
  assert.match(familyProfile, /await setActiveCareRecipient\(space\.careRecipientId\)/);
  assert.match(familyProfile, /await refresh\(\);\s*n\.reset\(\{ index: 0, routes: \[\{ name: "Main" \}\] \}\)/);
  assert.match(familyProfile, /pending invitations/i);
  assert.match(familyProfile, /Access remains inactive until you accept/);
  assert.match(careTeam, /loadAccessibleCareContexts\(user\.id\)/);
  assert.match(careTeam, /if \(!contexts\.some\(\(item\) => item\.careRecipientId === careRecipientId\)\)/);
  assert.match(careTeam, /await supabase\.from\("user_preferences"\)\.upsert/);
});

test("initial invitation handling already supports patients and does not provision a fake new account", () => {
  assert.match(onboarding, /export function OnboardingScreen/);
  assert.match(onboarding, /loadPendingCareInvitations\(\)/);
  assert.match(onboarding, /await respondToCareInvitation\(pendingInvite\.careRecipientId, response\)/);
  assert.match(onboarding, /if \(response === "decline"\)/);
  assert.match(onboarding, /await refresh\(\)/);
  assert.match(app, /state\.accessRole === "patient" \? \(/);
});

test("Care Recipient clinical pages remain read-only after adding invitation access", () => {
  assert.match(backend, /context\.accessRole === "patient"/);
  assert.match(backend, /async function requireEditableCareContext\(\)/);
  assert.doesNotMatch(patient, /recordMedicationDose\(|saveObservation\(|updateMedication\(/);
  assert.match(patient, /loadMedicationManagement\(state\.careRecipientId\)/);
  assert.match(patient, /loadCarePlan\(recipientId\)/);
  assert.match(patient, /supabase\.from\("appointments"\)/);
  assert.match(app, /name="PatientHealth" component=\{themedScreen\(PatientHealthScreen\)\}/);
});

test("appointment queries show offline/permission failure instead of hanging or empty history", () => {
  const appointmentStart = patient.indexOf("export function PatientAppointmentsScreen()");
  const appointmentEnd = patient.indexOf("function Trend(",appointmentStart);
  const appointmentScreen = patient.slice(appointmentStart,appointmentEnd);
  assert.match(appointmentScreen, /\.catch\(reason => \{\s*if \(active\) setError/);
  assert.match(appointmentScreen, /\.finally\(\(\) => \{ if \(active\) setLoading\(false\)/);
  assert.match(appointmentScreen, /<PatientEmpty icon="cloud-offline-outline" title="Appointments unavailable"/);
  assert.match(appointmentScreen, /if \(!active\) return/);

  const history = patient.slice(patient.indexOf("export function PatientHistoryScreen()"),patient.indexOf("export function PatientProfileScreen()"));
  assert.match(history, /const \[visitsLoading, setVisitsLoading\]/);
  assert.match(history, /const \[visitsError, setVisitsError\]/);
  assert.match(history, /if \(problem\) setVisitsError\(problem\.message\)/);
  assert.match(history, /Some care history is unavailable/);
  assert.match(history, /!events\.length && visitsLoading \? null/);
  assert.match(history, /if \(active\) setVisitsLoading\(false\)/);
});
