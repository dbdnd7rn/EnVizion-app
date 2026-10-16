import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const staff = readFileSync(new URL("../src/screens/StaffScreens.tsx", import.meta.url), "utf8");
const screenStart = app.indexOf("function StaffSignedInApp(");
const screenEnd = app.indexOf("function AuthGate(", screenStart);
const staffStack = app.slice(screenStart, screenEnd);

test("staff workspace provides profile-photo context before rendering avatar", () => {
  assert.ok(screenStart >= 0 && screenEnd > screenStart, "staff app exists");
  assert.match(staff, /<ProfileAvatar\b/);
  assert.match(staffStack, /<ProfileAvatarProvider>/);
  assert.match(staffStack, /<\/ProfileAvatarProvider>/);
  assert.ok(
    staffStack.indexOf("<ProfileAvatarProvider>") <
    staffStack.indexOf("<StaffStack.Navigator"),
    "provider must wrap all staff screens",
  );
});

test("staff render failures show recovery actions rather than white screen", () => {
  assert.match(app, /class StaffWorkspaceErrorBoundary extends React\.Component/);
  assert.match(staffStack, /<StaffWorkspaceErrorBoundary /);
  assert.match(app, /The staff workspace couldn't open/);
  assert.match(app, /Try opening again/);
  assert.match(app, /Sign out of staff workspace/);
});
