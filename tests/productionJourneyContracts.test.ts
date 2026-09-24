import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("production-critical routes remain registered", () => {
  const navigation = source("src/navigation.ts");
  const app = source("App.tsx");

  for (const route of [
    "Emergency",
    "CareDocuments",
    "CarePacket",
    "FamilyCommunication",
    "PrivacyData",
    "Accessibility",
    "PilotAdmin",
    "LaunchValidation",
    "LaunchCenter",
  ]) {
    assert.match(navigation, new RegExp(`\\b${route}\\b`));
    assert.match(app, new RegExp(`name=["']${route}["']`));
  }
});

test("care provider exposes reconnect-aware sync state", () => {
  const store = source("src/store.tsx");
  assert.match(store, /syncStatus/);
  assert.match(store, /lastSyncedAt/);
  assert.match(store, /AppState\.addEventListener/);
});

test("privacy center exposes session revocation and minimized diagnostics", () => {
  const privacy = source("src/screens/PrivacyDataScreen.tsx");
  assert.match(privacy, /Sign out other devices/);
  assert.match(privacy, /Send technical diagnostics/);
  assert.match(privacy, /does not include medication names/i);
});

test("pilot admin exposes production operations without clinical record fields", () => {
  const admin = source("src/screens/PilotAdminScreen.tsx");
  assert.match(admin, /Production operations/);
  assert.match(admin, /failed packet exports/i);
  assert.match(admin, /does not expose/i);
});

test("pilot launch validation uses server-backed real-role evidence", () => {
  const validation = source("src/screens/LaunchValidationScreen.tsx");
  const client = source("src/launchValidation.ts");

  assert.match(validation, /Server-verified role/i);
  assert.match(validation, /no demo or synthetic care record/i);
  assert.match(validation, /Failure & recovery drills/i);
  assert.match(client, /launch-validation/);
  assert.match(client, /start_acceptance/);
  assert.match(client, /record_drill/);
});

test("admin launch center enforces evidence-based sign-off", () => {
  const center = source("src/screens/LaunchCenterScreen.tsx");
  const client = source("src/launchValidation.ts");

  assert.match(center, /Resolve blockers before approval/);
  assert.match(center, /Owner.*Caregiver.*Viewer/s);
  assert.match(center, /iOS.*Android.*Web/s);
  assert.match(client, /launch-admin/);
  assert.match(client, /signoff/);
});

test("launch center blocks synthetic pilot foundation setup", () => {
  const center = source("src/screens/LaunchCenterScreen.tsx");
  const client = source("src/launchValidation.ts");

  assert.match(center, /Pilot foundation/);
  assert.match(center, /No real pilot cohort exists yet/);
  assert.match(center, /Real pilot cohort/);
  assert.match(center, /Open Pilot Administration/);
  assert.doesNotMatch(center, /label="Pilot cohort"/);
  assert.match(client, /PilotFoundationSnapshot/);
  assert.match(client, /activationReady/);
});
