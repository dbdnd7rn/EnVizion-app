import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../supabase/functions/care-team-admin/index.ts", import.meta.url),
  "utf8",
);

test("active care-team members display their saved profile names before stale signup names", () => {
  const roster = source.slice(source.indexOf('if (action === "list")'));
  assert.match(roster, /\.from\("profiles"\)\.select\("id, full_name"\)/);
  assert.match(roster, /const savedName = savedNames\.get\(row\.user_id\) \?\? ""/);
  assert.match(
    roster,
    /row\.status === "invited"\s*\? invitedName \|\| savedName \|\| signupName \|\| fallbackName\s*: savedName \|\| signupName \|\| invitedName \|\| fallbackName/,
  );
  assert.match(roster, /isCurrentUser:\s*row\.user_id === user\.id/);
});

test("care-team name correction does not invent or add memberships", () => {
  const roster = source.slice(
    source.indexOf('if (action === "list")'),
    source.indexOf('if (!canManage)', source.indexOf('if (action === "list")')),
  );
  assert.match(roster, /\.from\("care_recipient_members"\)/);
  assert.match(roster, /\.from\("care_group_members"\)/);
  assert.match(roster, /const members = \[\.\.\.merged\.values\(\)\]/);
  assert.match(roster, /members: members\.map\(\(row\) =>/);
});
