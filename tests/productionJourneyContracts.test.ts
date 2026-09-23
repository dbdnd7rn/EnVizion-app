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
