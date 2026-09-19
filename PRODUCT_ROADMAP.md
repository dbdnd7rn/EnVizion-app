# EnVizion Life product direction

## Agreed experience

A professional caregiver companion that combines everyday care tools, an AI assistant for basic questions, and direct conversations with the EnVizion Life team. The staff inbox is the central conversation record. WhatsApp and email are additional channels. Spiritual encouragement is opt-in and defaults to off.

## Implemented in this frontend increment

- Updated dashboard with assistant entry point and consistent sans-serif headings.
- Chat interface with suggested questions, resource links, optional spiritual encouragement, and a persistent emergency-help entry point.
- Scripted answers for a small set of app-navigation questions. This is explicitly a demonstration, not a language model or clinical triage system.
- Handoff form with topic, message, preferred channel, and an optional exact transcript preview. Clinical logs and reflections are not attached.
- Session-only team conversation and staff inbox preview. Manually entered sample staff replies appear on the caregiver side. Closed requests reject additional replies.
- Only one request is retained in this preview. Starting a new request after closure replaces the previous request. All data clears on reload.

## Required before live AI or staff messaging

1. **Identity and storage:** caregiver accounts, staff-only authentication, server-enforced roles, conversation ownership, durable storage, audit history, consent versioning, deletion/export controls, backup and recovery. Remove the staff preview entry point from caregiver production navigation.
2. **AI service:** choose and configure a provider through a server-owned credential, never an Expo public variable. Approve a versioned knowledge library with Dr. Tolbert. Responses should cite approved material, distinguish AI from staff, avoid diagnosis and dosing, and offer staff handoff when outside scope. Treat uploaded documents and conversation content as untrusted. Test ambiguous, urgent, adversarial, and out-of-scope questions before release. The preview's exact-match rules are not a production safety system.
3. **Staff inbox:** authenticated assignment, unread counts, server timestamps, delivery states, multiple conversation history, reopen/resolve actions, response ownership, and interruption of automated replies while staff manage a conversation. Define actual coverage hours and urgent escalation procedures before displaying availability or response promises.
4. **WhatsApp and email:** official business number and support mailbox are not set up yet. Configure providers, verified destinations, required channel opt-ins, server-side webhooks, signature verification, retries and duplicate prevention. Keep sensitive content out of notification previews; direct staff to the authenticated inbox. Do not mark a message delivered until the provider confirms delivery.
5. **Privacy and clinical review:** identify launch jurisdictions and organizational obligations, approve content, data retention and provider handling, publish privacy/support terms, document incident handling, and confirm emergency wording and numbers for launch locations. No regulatory compliance claim is made by this prototype.
6. **Release quality:** verify iOS and Android devices, small screens, keyboard behavior, large text, screen readers, reduced motion, offline/error recovery, performance, real printing, and push notification preferences. Finish account/profile management and production content administration.

## Suggested server contract

- `POST /conversations`: create an authenticated caregiver-owned conversation.
- `POST /conversations/:id/messages`: accept a client message with an idempotency key, enforce ownership and size limits, and respond with server-issued IDs and delivery status.
- `POST /conversations/:id/handoff`: validate consent and an explicit transcript selection; create a support case without implicitly copying health records.
- `GET /staff/cases`: staff-only queue with authorization enforced on the server.
- `POST /staff/cases/:id/replies`: authorized staff reply, stored once and routed to the caregiver's opted-in channel.
- `POST /staff/cases/:id/resolve`: authorized status transition with audit history.
- Provider webhooks update delivery state through verified, idempotent handlers.

The contract above is an implementation plan, not deployed endpoints. The current code makes no AI, email, or WhatsApp requests and creates no real bookings or support notifications.
