import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toolkitReply } from "../supabase/functions/care-ai/toolkit.ts";

const client = readFileSync(new URL("../src/assistant/careAI.ts", import.meta.url), "utf8");
const screen = readFileSync(new URL("../src/screens/EnVizionAIScreen.tsx", import.meta.url), "utf8");

test("built-in AI greeting runs without a network call or profile data", () => {
  const response = toolkitReply("Hello", [], {
    includeCareData: false,
    canDraft: false,
    timezone: "Africa/Blantyre",
    now: new Date("2026-10-20T08:00:00Z"),
    records: {},
  });
  assert.ok(response.reply.trim().length > 8);
  assert.equal(response.action, null);
  assert.equal(response.trends, undefined);
  assert.match(client, /if \(!input\.includeCareData && !input\.naturalConversation\)/);
  assert.match(client, /toolkitReply\(message/);
  assert.match(client, /includeCareData: false/);
  assert.match(client, /canDraft: false/);
  assert.match(client, /action: null/);
});

test("authorized live-profile reads remain server-only and bounded in time", () => {
  assert.match(client, /if \(input\.includeCareData && !input\.careRecipientId\)/);
  assert.match(client, /supabase\.functions\.invoke\("care-ai"/);
  assert.match(client, /controller\.signal/);
  assert.match(client, /Promise\.race/);
  assert.match(client, /15000/);
  assert.match(client, /validateCareTrends/);
  assert.match(client, /validateAssistantDraft/);
  assert.match(client, /Live care information/);
});

test("iOS AI composer is moved above the keyboard with frame events", () => {
  assert.match(screen, /keyboardWillChangeFrame/);
  assert.match(screen, /keyboardWillShow/);
  assert.match(screen, /keyboardDidShow/);
  assert.match(screen, /keyboardWillHide/);
  assert.match(screen, /keyboardDidHide/);
  assert.match(screen, /Dimensions\.get\("screen"\)\.height - screenY/);
  assert.match(screen, /paddingBottom: Platform\.OS === "ios" \? keyboardInset : 0/);
  assert.match(screen, /automaticallyAdjustKeyboardInsets=\{Platform\.OS !== "ios"\}/);
  assert.doesNotMatch(screen, /<KeyboardAvoidingView/);
  assert.match(screen, /accessibilityLabel="Message EnVizion AI"/);
  assert.match(screen, /accessibilityLabel="Send to EnVizion AI"/);
});

test("consent, explicit-save safeguards and new-conversation controls remain", () => {
  for (const term of [
    /careDataAllowed/, /includeCareData: careDataAllowed/,
    /Review before saving/, /Confirm & save/,
    /createCareReminder\(/, /createCareCommunication\(/,
    /requestId\.current \+= 1/, /type: "conversation-clear"/,
  ]) assert.match(screen, term);
});
