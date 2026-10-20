import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeChatMessages, chatSearchTerm } from "../src/careChatHelpers.ts";
import { readFileSync } from "node:fs";

test("Realtime duplicate echoes do not duplicate a delivered message", () => {
  const msg={id:"01",created_at:"2026-10-20T09:00:00.000Z",body:"Before"};
  const next=mergeChatMessages([msg],[{...msg,body:"Edited"}]);
  assert.equal(next.length,1);
  assert.equal(next[0].body,"Edited");
});

test("Message order stays chronological and deterministic at equal timestamps", () => {
  const a={id:"a",created_at:"2026-10-20T09:00:00.000Z"};
  const b={id:"b",created_at:"2026-10-20T09:00:00.000Z"};
  const c={id:"c",created_at:"2026-10-20T10:00:00.000Z"};
  assert.deepEqual(mergeChatMessages([c,a],[b,a]).map(x=>x.id),["a","b","c"]);
});

test("Search input limits length and strips wildcard operators", () => {
  assert.doesNotMatch(chatSearchTerm("  %care_ ,plan% "), /[%,_]/);
  assert.equal(chatSearchTerm("x".repeat(150)).length,100);
});

test("Migration denies anonymous access and enforces current participant membership", () => {
  const sql=readFileSync(new URL("../supabase/migrations/20261020094740_add_care_team_chat.sql", import.meta.url),"utf8");
  assert.match(sql,/create policy chat_messages_read/i);
  assert.match(sql,/private\.chat_can_access\(conversation_id\)/);
  assert.match(sql,/private\.can_view_care_recipient\(c.care_recipient_id\)/);
  assert.match(sql,/chat_message_idempotent/);
  assert.match(sql,/create trigger chat_new_message_notification/i);
  assert.match(sql,/revoke all on public.chat_conversations,public.chat_messages/i);
  assert.doesNotMatch(sql,/sample message|fake user|hardcoded password/i);
});

test("Support conversations are not overwritten by Care Team Chat", () => {
  const app=readFileSync(new URL("../App.tsx", import.meta.url),"utf8");
  assert.match(app,/name="TeamConversation"/);
  assert.match(app,/name="CareTeamChat"/);
});

test("A refreshed or searched conversation rechecks membership before exposing cached messages", () => {
  const source=readFileSync(new URL("../src/careChat.ts", import.meta.url),"utf8");
  assert.match(source,/async function requireChatAccess[\\s\\S]*?from\\("chat_conversations"\\)[\\s\\S]*?maybeSingle\\(\\)/);
  assert.match(source,/if \\(!data\\) throw new Error\\("This conversation is no longer available/);
  assert.match(source,/export async function chatPage[\\s\\S]*?await requireChatAccess\\(conversationId\\)/);
  assert.match(source,/export async function chatSearch[\\s\\S]*?await requireChatAccess\\(conversationId\\)/);
});
