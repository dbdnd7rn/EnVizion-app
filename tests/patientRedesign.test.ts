import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const patient = readFileSync(new URL("../src/screens/PatientExperience.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

test("all nine care-recipient screens retain their own accessible route and layout", () => {
  const names = [
    "PatientHomeScreen", "PatientCareHubScreen", "PatientDayScreen",
    "PatientMedicationsScreen", "PatientAppointmentsScreen", "PatientHealthScreen",
    "PatientTeamScreen", "PatientHistoryScreen", "PatientProfileScreen",
  ];
  for (const name of names) {
    assert.match(patient, new RegExp("export function " + name + "\\(\\)"), name);
  }
  assert.match(app, /name="PatientHome"/);
  assert.match(app, /name="PatientCare"/);
  assert.match(app, /name="PatientTeam"/);
  assert.doesNotMatch(app.slice(app.indexOf("function PatientTabs()"), app.indexOf("function FamilyTabs()")), /name="PatientAI"/);
  assert.match(app, /name="PatientProfile"/);
  assert.match(app, /tabBarHideOnKeyboard: true/);
});

test("modern patient home uses real brand, live plan data and clear direct actions", () => {
  assert.match(patient, /<Brand\/>/);
  assert.match(patient, /<NotificationBell onPress/);
  assert.match(patient, /<ProfileAvatar name=\{state\.name/);
  assert.match(patient, /loadCarePlan\(recipientId\)/);
  assert.match(patient, /plan\.completions\.filter/);
  assert.match(patient, /<PatientCount value=\{today\.length\}/);
  assert.match(patient, /<PatientTile title="Medications"/);
  assert.match(patient, /<PatientTile title="Appointments"/);
  assert.match(patient, /<PatientTile title="My health"/);
  assert.match(patient, /<PatientTile title="Care history"/);
  assert.match(patient, /n\.navigate\("CareTeamChat"/);
  assert.match(patient, /tabs\.navigate\("PatientProfile"\)/);
  assert.match(patient, /tabs\.navigate\("PatientCare"\)/);
  assert.doesNotMatch(patient, /demo patient|sample medication|fake record/i);
});

test("patient records remain read-only and include honest empty and loading states", () => {
  assert.match(patient, /loadMedicationManagement\(state\.careRecipientId\)/);
  assert.match(patient, /supabase\.from\("appointments"\)/);
  assert.match(patient, /chatPeople\(state\.careRecipientId\)/);
  assert.match(patient, /useFocusEffect/);
  assert.match(patient, /PatientEmpty/);
  assert.match(patient, /ActivityIndicator/);
  assert.match(patient, /For your safety, this page is read-only/);
  assert.doesNotMatch(patient, /recordMedicationDose\(|saveObservation\(|updateMedication\(/);
});

test("visual system respects EnVizion colors, dark mode and accessible controls", () => {
  assert.match(patient, /const PURPLE = "#70338F"/);
  assert.match(patient, /themeForeground/);
  assert.match(patient, /themeBackground/);
  assert.match(patient, /themeBorder/);
  assert.match(patient, /isReduceMotionEnabled\(\)/);
  assert.match(patient, /accessibilityRole="header"/);
  assert.match(patient, /accessibilityRole="button"/);
  assert.match(patient, /"Lora_500Medium"/);
  assert.match(patient, /fontFamily: SEMI/);
  assert.match(patient, /function PatientHeroArt\(/);
  assert.doesNotMatch(patient, /Decorative caring hands and heart/);
});
