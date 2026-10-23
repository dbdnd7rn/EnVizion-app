import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../src/screens/PatientExperience.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../src/navigation.ts", import.meta.url), "utf8");
const backend = readFileSync(new URL("../src/backend.ts", import.meta.url), "utf8");

test("patient has five purpose-built tabs and a patient-only route branch", () => {
  for (const route of ["PatientHome", "PatientCare", "PatientTeam", "PatientAI", "PatientProfile"]) {
    assert.match(app, new RegExp('name="' + route + '"'));
    assert.match(navigation, new RegExp("\\b" + route + "\\b"));
  }
  assert.match(app, /state\.accessRole === "patient"/);
  assert.match(app, /state\.accessRole === "owner" \|\| state\.accessRole === "caregiver"/);\n  assert.match(app, /state\.accessRole === "viewer"/);
  assert.match(app, /<PatientTabs \/>/);
});

test("patient branch contains only patient care screens and permitted shared tools", () => {
  const start = app.indexOf('name="PatientDay" component={themedScreen(PatientDayScreen)}');
  const end = app.indexOf("</Stack.Navigator>", start);
  assert.ok(start > -1 && end > start, "Patient route branch must be present");
  const patientRoutes = app.slice(start, end);
  for (const page of ["PatientMedications", "PatientAppointments", "PatientHealth", "PatientHistory", "CareTeamChat"]) {
    assert.match(patientRoutes, new RegExp('name="' + page + '"'));
  }
  for (const forbidden of ["PilotAdmin", "StaffManagement", "CareTasks", "CareTeamSecurityRemediation", "AdvocateHandover", "MedicationManagementScreen"]) {
    assert.doesNotMatch(patientRoutes, new RegExp(forbidden));
  }
});

test("patient care renders authenticated records and reuses existing chat, AI and avatar", () => {
  assert.match(screen, /useCare\(\)/);
  assert.match(screen, /loadCarePlan\(recipientId\)/);
  assert.match(screen, /chatPeople\(state\.careRecipientId\)/);
  assert.match(screen, /loadCareTeam\(state\.careRecipientId\)/);
  assert.match(screen, /care_recipient_id", state\.careRecipientId/);
  assert.match(screen, /n\.navigate\("CareTeamChat"/);
  assert.match(screen, /ProfileAvatar/);
  assert.match(app, /PatientAI" component=\{themedScreen\(EnVizionAIScreen\)\}/);
  assert.doesNotMatch(screen, /fake record|demo patient|sample medication/i);
});

test("patients cannot edit medications or observations via existing backend mutations", () => {
  assert.match(backend, /context\.accessRole === "patient"/);
  assert.match(backend, /async function requireEditableCareContext\(\)/);
  assert.match(backend, /export async function updateMedication[\s\S]*?requireEditableCareContext\(\)/);
  assert.match(backend, /export async function recordMedicationDose[\s\S]*?requireEditableCareContext\(\)/);
  assert.match(backend, /export async function saveObservation[\s\S]*?requireEditableCareContext\(\)/);
  assert.doesNotMatch(screen, /recordMedicationDose\(|createMedication\(|saveObservation\(/);
});

test("patient screens use branded theme-aware visuals and reduced-motion control", () => {
  assert.match(screen, /themeForeground/);
  assert.match(screen, /themeBackground/);
  assert.match(screen, /Lora_500Medium/);
  assert.match(screen, /PatientHeroArt/);
  assert.match(screen, /isReduceMotionEnabled\(\)/);
  assert.match(screen, /accessibilityRole="button"/);
});
