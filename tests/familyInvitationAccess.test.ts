import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const profile = read("../src/screens/FamilyProfileScreen.tsx");
const careTeam = read("../src/careTeam.ts");
const app = read("../App.tsx");
const edge = read("../supabase/functions/care-team-admin/index.ts");

test("family profile checks for new invitations while an account is already active", () => {
  assert.match(profile, /function FamilyCareAccessPanel\(\)/);
  assert.match(profile, /useFocusEffect\(useCallback\(/);
  assert.match(profile, /loadPendingCareInvitations\(\)/);
  assert.match(profile, /loadCareSpaces\(\)/);
  assert.match(profile, /<FamilyCareAccessPanel \/>/);
  assert.match(profile, /Pending invitations/);
  assert.match(profile, /Accept care invitation/);
  assert.match(profile, /Decline care invitation/);
});

test("family account never silently accepts invitations or gains caregiver management actions", () => {
  assert.match(profile, /onPress=\{\(\) => void respond\(invitation, "accept"\)\}/);
  assert.match(profile, /onPress=\{\(\) => void respond\(invitation, "decline"\)\}/);
  assert.match(profile, /respondToCareInvitation\(invitation\.careRecipientId, action\)/);
  assert.match(careTeam, /if \(response === "accept"\)/);
  assert.match(edge, /invitationExpired\(membership\.invite_expires_at\)/);
  assert.doesNotMatch(profile, /inviteCareTeamMember|updateCareTeamRole|revokeCareTeamAccess/);
  assert.match(app, /state\.accessRole === "viewer"\) return <FamilyTabs/);
});

test("switching to another care profile requires server-validated active access", () => {
  assert.match(profile, /setActiveCareRecipient\(space\.careRecipientId\)/);
  assert.match(profile, /await refresh\(\)/);
  assert.match(profile, /n\.reset\(/);
  assert.match(profile, /disabled=\{space\.active \|\| busy !== null\}/);
  assert.match(careTeam, /loadAccessibleCareContexts\(user\.id\)/);
  assert.match(careTeam, /You do not have active access to this care profile/);
});

test("family's four care tools remain unchanged; account invitations live in Profile", () => {
  for (const tool of ["FamilyHome", "FamilyUpdates", "FamilyChat", "FamilyHelp"]) {
    assert.match(app, new RegExp('name="' + tool + '"'));
  }
  assert.match(app, /name="FamilyProfile"/);
  assert.doesNotMatch(app, /<Stack\.Screen name="CareTeam" component=\{themedScreen\(CareTeamScreen\)\}/);
  assert.match(profile, /Account & preferences/);
});
