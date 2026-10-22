import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const backend = readFileSync(
  new URL("../supabase/functions/care-team-admin/index.ts", import.meta.url), "utf8",
);
const ui = readFileSync(
  new URL("../src/screens/CareTeamScreen.tsx", import.meta.url), "utf8",
);
const client = readFileSync(
  new URL("../src/careTeam.ts", import.meta.url), "utf8",
);

test("existing auth users receive a sign-in email request but do not automatically gain care access", () => {
  assert.match(backend, /const existingAccount = Boolean\(target\)/);
  assert.match(backend, /if \(existingAccount\) \{\s*invitationEmailSent = await requestExistingUserSignInEmail/);
  assert.match(backend, /shouldCreateUser: false/);
  assert.match(backend, /emailRedirectTo: "https:\/\/envizion-life-caregiver\.onrender\.com\/"/);
  assert.match(backend, /status: "invited"/);
  assert.match(backend, /emailKind: invitationEmailSent/);
  assert.doesNotMatch(backend, /status: "active",\s*invited_by: user\.id/);
});

test("reminders and re-invitations request email without falsely claiming delivery", () => {
  const reminder = backend.slice(backend.indexOf('if (action === "send_reminder")'),
    backend.indexOf('if (action === "update_role")'));
  const reinvite = backend.slice(backend.indexOf('if (action === "reinvite")'));
  assert.match(reminder, /requestExistingUserSignInEmail/);
  assert.match(reinvite, /requestExistingUserSignInEmail/);
  assert.match(reminder, /emailRequested \}/);
  assert.match(reinvite, /emailRequested \}/);
  assert.match(backend, /return true; \/\/ Request accepted, inbox delivery not independently verified/);
  assert.match(client, /emailRequested: boolean/);
  assert.match(ui, /but email was unavailable/);
  assert.match(ui, /They must still accept the care invitation/);
});
