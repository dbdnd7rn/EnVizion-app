import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { profileRequestGate } from "../src/assistant/profileRequestGate.ts";

const selected = { careRecipientId: "care-recipient-id", includeCareData: false };
const authorized = { ...selected, includeCareData: true };
const noProfile = { careRecipientId: null, includeCareData: false };

test("profile-only prompts show a clear access action instead of replaying an unhelpful fallback", () => {
  for (const prompt of ["Show care trends", "Show my care tasks", "Show my appointments", "Show my reminders", "Write a care note", "Set a reminder"]) {
    assert.equal(profileRequestGate(prompt, selected), "enable-profile", prompt);
    assert.equal(profileRequestGate(prompt, authorized), "ready", prompt);
    assert.equal(profileRequestGate(prompt, noProfile), "select-profile", prompt);
  }
});

test("ordinary greetings and toolkit navigation need no private-profile access", () => {
  for (const prompt of ["hey", "hello", "How are you?", "Where are care contacts?", "I feel overwhelmed"]) {
    assert.equal(profileRequestGate(prompt, noProfile), "ready", prompt);
  }
});

test("the assistant requires a deliberate one-tap opt-in and re-asks without reusing private history", () => {
  const screen = readFileSync(new URL("../src/screens/EnVizionAIScreen.tsx", import.meta.url), "utf8");
  assert.match(screen, /sendingRef\.current = true/);
  assert.match(screen, /if \(!value \|\| busy \|\| sendingRef\.current\) return/);
  assert.match(screen, /profilePrompt === value && messages\.at\(-1\)\?\.role === "assistant"/);
  assert.match(screen, /const priorMessages = explicitlyApprovedProfile \? \[\] :/);
  assert.match(screen, /const includeCareData = explicitlyApprovedProfile \|\| careDataAllowed/);
  assert.match(screen, /title="Use profile and continue"/);
  assert.match(screen, /setCareDataAllowed\(true\)/);
  assert.match(screen, /void send\(question, false, true\)/);
  assert.match(screen, /setProfilePrompt\(null\)/);
  assert.match(screen, /Privacy & AI settings/);
  assert.match(screen, /Care profile: \{careDataAllowed \? "On" : "Off"\}/);
  assert.doesNotMatch(screen, /A little support, anytime\./);
});
