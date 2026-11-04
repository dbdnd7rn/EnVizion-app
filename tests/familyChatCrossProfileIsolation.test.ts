import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chatResponseMatchesScope, mergeChatMessages } from "../src/careChatHelpers.ts";

test("late conversation responses belong only to the active conversation", () => {
  assert.equal(chatResponseMatchesScope("care-chat-A","care-chat-A"), true);
  assert.equal(chatResponseMatchesScope("care-chat-A","care-chat-B"), false);
  assert.equal(chatResponseMatchesScope("care-chat-A",null), false);
  assert.equal(chatResponseMatchesScope(null,"care-chat-A"), false);
  assert.equal(chatResponseMatchesScope("","care-chat-A"), false);
});

test("late profile loads cannot be accepted after a care-recipient switch", () => {
  let activeRecipient: string | null = "recipient-A";
  const oldRequest = "recipient-A";
  activeRecipient = "recipient-B";
  assert.equal(chatResponseMatchesScope(oldRequest, activeRecipient),false);
  assert.equal(chatResponseMatchesScope("recipient-B",activeRecipient),true);
  activeRecipient = null;
  assert.equal(chatResponseMatchesScope("recipient-B",activeRecipient),false);
});

test("changing rooms never merges an earlier patient's messages into the new room", () => {
  const older = { id:"old", conversation_id:"room-A", created_at:"2026-11-04T12:00:00Z" };
  const newer = { id:"new", conversation_id:"room-B", created_at:"2026-11-04T12:01:00Z" };
  let activeRoom: string | null = "room-B";
  const visible = [newer];
  const stale = chatResponseMatchesScope("room-A",activeRoom)
    ? mergeChatMessages(visible,[older]) : visible;
  assert.deepEqual(stale.map(x=>x.id),["new"]);
});

test("Care Team Chat gates async messages, statuses and cached room lists on active IDs",()=>{
  const source=readFileSync(new URL("../src/screens/CareTeamChatScreen.tsx",import.meta.url),"utf8");
  assert.match(source,/const activeRecipientRef = useRef<string \| null>\(recipientId\)/);
  assert.match(source,/const activeConversationRef = useRef<string \| null>\(activeId\)/);
  assert.match(source,/activeRecipientRef\.current = id;\s*closeConversation\(\)/);
  assert.match(source,/activeConversationRef\.current = room\.id/);
  assert.match(source,/if \(!isCurrentRecipient\(id\)\) return/);
  assert.match(source,/if \(isCurrentRecipient\(id\)\) setUnread/);
  assert.match(source,/if \(!isCurrentConversation\(id\)\) return;\s*setMessages/);
  assert.match(source,/if \(!alive \|\| !isCurrentConversation\(activeId\)\) return/);
  assert.match(source,/if \(alive && isCurrentConversation\(activeId\)\) await updateStatus\(activeId\)/);
  assert.match(source,/if \(isCurrentConversation\(roomId\)\) setSearchResults\(result\)/);
  assert.match(source,/if \(!isCurrentConversation\(roomId\)\) return;\s*setHasEarlier/);
  assert.match(source,/onPress=\{\(\)=>switchCareProfile\(p\.careRecipientId\)\}/);
  assert.match(source,/selected \? closeConversation\(\) : nav\.goBack\(\)/);
});

test("a successfully persisted send is never reported as failed merely because refresh fails",()=>{
  const source=readFileSync(new URL("../src/screens/CareTeamChatScreen.tsx",import.meta.url),"utf8");
  assert.match(source,/let persisted = false/);
  assert.match(source,/const sent=await chatSend\(roomId,content,nonce,replyId\)/);
  assert.match(source,/persisted = true/);
  assert.match(source,/Your message was saved, but the chat could not refresh/);
  assert.match(source,/Your message was not confirmed as saved/);
  assert.match(source,/if \(isCurrentConversation\(roomId\)\) \{\s*nonceRef\.current=null/);
  assert.doesNotMatch(source,/catch \{ setError\("Your message was not saved\. Try sending again\."\)/);
});

test("chat backend still verifies RLS and participant authorization before returning message history",()=>{
  const source=readFileSync(new URL("../src/careChat.ts",import.meta.url),"utf8");
  assert.match(source,/async function requireChatAccess[\s\S]*?chat_conversations/);
  assert.match(source,/await requireChatAccess\(conversationId\)/);
  assert.match(source,/chatSend\([\s\S]*?client_nonce: nonce/);
  assert.match(source,/error\.code === "23505"/);
  const migration=readFileSync(new URL("../supabase/migrations/20261020094740_add_care_team_chat.sql",import.meta.url),"utf8");
  assert.match(migration,/chat_message_idempotent/);
  assert.match(migration,/private\.chat_can_access\(conversation_id\)/);
});
