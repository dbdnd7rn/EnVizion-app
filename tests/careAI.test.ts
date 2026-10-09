import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateAssistantDraft } from "../src/assistant/careAI.ts";

test("reminder AI drafts are strictly validated and cannot be silently executed", () => {
  assert.deepEqual(validateAssistantDraft({
    type: "create_reminder", title: "Check calendar", date: "2026-10-12",
    time: "14:30", recurrence: "daily", note: "Follow existing instructions",
  }), {
    type: "create_reminder", title: "Check calendar", date: "2026-10-12",
    time: "14:30", recurrence: "daily", note: "Follow existing instructions",
  });
  assert.equal(validateAssistantDraft({
    type: "create_reminder", title: "Reminder", date: "tomorrow",
    time: "in the morning", recurrence: "none",
  }), null);
  assert.equal(validateAssistantDraft({
    type: "create_reminder", title: "", date: "2026-10-12",
    time: "14:30", recurrence: "none",
  }), null);
  assert.equal(validateAssistantDraft({
    type: "create_reminder", title: "Unclear", date: "2026-10-12",
    time: "25:00", recurrence: "none",
  }), null);
});

test("AI care note drafts require an explicit summary", () => {
  assert.deepEqual(validateAssistantDraft({
    type: "add_care_note", summary: "Spoke with family", notes: "Discussed transport",
  }), {type: "add_care_note", summary: "Spoke with family", notes: "Discussed transport"});
  assert.equal(validateAssistantDraft({ type: "add_care_note", summary: "", notes: "hello" }), null);
  assert.equal(validateAssistantDraft({ type: "remove_medication", title: "Stop all medication" }), null);
});

test("AI interface respects care consent and never writes without a review step", () => {
  const screen = readFileSync(new URL("../src/screens/EnVizionAIScreen.tsx", import.meta.url), "utf8");
  assert.match(screen,/careDataAllowed/);
  assert.match(screen,/includeCareData: careDataAllowed/);
  assert.match(screen,/requestId\.current \+= 1/);
  assert.match(screen,/type: "conversation-clear"/);
  assert.match(screen,/Review before saving/);
  assert.match(screen,/Confirm & save/);
  assert.match(screen,/createCareReminder\(/);
  assert.match(screen,/createCareCommunication\(/);
  assert.match(screen,/state\.accessRole === "owner"/);
  assert.match(screen,/state\.accessRole === "caregiver"/);
  assert.match(screen,/Nothing is saved to care records without your confirmation/);
});

test("AI app uses real server endpoint, not the scripted preview responder", () => {
  const screen = readFileSync(new URL("../src/screens/EnVizionAIScreen.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/assistant/careAI.ts", import.meta.url), "utf8");
  assert.match(app,/component=\{themedScreen\(EnVizionAIScreen\)\}/);
  assert.doesNotMatch(screen,/previewReply/);
  assert.match(client,/supabase\.functions\.invoke\("care-ai"/);
  assert.match(client,/validateAssistantDraft/);
  assert.match(client,/history: input\.history\.slice\(-12\)/);
});
