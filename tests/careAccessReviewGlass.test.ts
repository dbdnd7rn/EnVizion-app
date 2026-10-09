import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const screen = readFileSync(
  new URL("../src/screens/CareAccessRecertificationScreen.tsx", import.meta.url),
  "utf8",
);

test("glass access review uses real server counts and required status cards", () => {
  assert.match(screen, /loadCareAccessRecertifications\(recipientId\)/);
  assert.match(screen, /overview\.dueCount/);
  assert.match(screen, /overview\.cadenceDays/);
  assert.match(screen, /overview && \(/);
  assert.match(screen, /No access reviews are due/);
  assert.match(screen, /No upcoming access reviews are scheduled yet/);
  assert.match(screen, /No completed 90-day access reviews have been recorded yet/);
  assert.match(screen, /setOverview\(null\)/);
  assert.match(screen, /Access reviews are unavailable/);
});

test("glass access review keeps deliberate and permission-gated signoff", () => {
  assert.match(screen, /primaryAdvocate = state\.accessRole === "owner"/);
  assert.match(screen, /roleAfter: decision === "change_role" \? roleAfter : null/);
  assert.match(screen, /completeCareAccessRecertification/);
  assert.match(screen, /!confirmed/);
  assert.match(screen, /Keep access/);
  assert.match(screen, /Change role/);
  assert.match(screen, /Revoke access/);
  assert.match(screen, /I reviewed this person’s access/);
  assert.match(screen, /Confirm 90-day access decision/);
  assert.match(screen, /await refresh\(false\)/);
});

test("access review has a single navigation header and appearance support", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(app, /name="CareAccessRecertification"[\s\S]*?headerShown: false/);
  assert.match(screen, /accessibilityLabel="Go back"/);
  assert.match(screen, /GlassCalendar/);
  assert.match(screen, /themeBackground/);
  assert.match(screen, /themeForeground/);
});
