import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const backend = readFileSync(
  new URL("../supabase/functions/care-team-admin/index.ts", import.meta.url), "utf8",
);
const magicLink = readFileSync(
  new URL("../supabase/email-templates/magiclink.html", import.meta.url), "utf8",
);
const invite = readFileSync(
  new URL("../supabase/email-templates/invite.html", import.meta.url), "utf8",
);

test("existing account magic links carry server-sourced role and inviter presentation only", () => {
  const prepare = backend.slice(
    backend.indexOf("async function prepareCareInvitationEmailContext("),
    backend.indexOf("async function clearCareInvitationEmailContext("),
  );
  assert.match(prepare, /\.from\("care_recipient_members"\)/);
  assert.match(prepare, /\.eq\("status", "invited"\)|membership\?\.status !== "invited"/);
  assert.match(prepare, /invitationExpired\(membership\?\.invite_expires_at\)/);
  assert.match(prepare, /\.from\("care_recipients"\)/);
  assert.match(prepare, /\.from\("profiles"\)/);
  assert.match(prepare, /roleLabel\(membership\.role as CareRole\)/);
  assert.match(prepare, /envizion_care_invitation: snapshot/);
  assert.doesNotMatch(prepare, /\.from\("medications"\)|\.from\("care_observations"\)/);
});

test("branded magic link shows invitation context but never grants access on sign-in", () => {
  assert.match(magicLink, /{{ if \.Data\.envizion_care_invitation }}/);
  assert.match(magicLink, /invited_by_name/);
  assert.match(magicLink, /care_recipient_name/);
  assert.match(magicLink, /care_access_role/);
  assert.match(magicLink, /expires_on/);
  assert.match(magicLink, /Care Team &amp; Sharing/);
  assert.match(magicLink, /choose <strong>Accept<\/strong>/);
  assert.match(magicLink, /Signing in does not automatically accept/);
  assert.match(magicLink, /{{ else }}/);
  assert.match(magicLink, /Your secure EnVizion Life sign-in link/);
  assert.match(magicLink, /{{ \.ConfirmationURL }}/);
  assert.doesNotMatch(magicLink, /password\s*=|care_observations|medications/i);
});

test("account invitation email distinguishes sign-in from care consent", () => {
  assert.match(invite, /\.Data\.invited_by_name/);
  assert.match(invite, /\.Data\.care_access_role/);
  assert.match(invite, /Care Team &amp; Sharing/);
  assert.match(invite, /Sign in to review your invitation/);
  assert.match(invite, /14 days/);
  assert.match(invite, /{{ \.ConfirmationURL }}/);
});

test("invitation metadata clears after accepting, declining or revoking", () => {
  assert.match(backend, /clearCareInvitationEmailContext\(admin, careRecipientId, user\.id\)/);
  assert.match(backend, /clearCareInvitationEmailContext\(admin, careRecipientId, targetUserId\)/);
  assert.match(backend, /shouldCreateUser: false/);
  assert.match(backend, /emailRedirectTo: "https:\/\/envizion-life-caregiver\.onrender\.com\/"/);
});
