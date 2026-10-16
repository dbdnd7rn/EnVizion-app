# EnVizion toolkit assistant

The EnVizion AI page now uses a focused, deterministic toolkit assistant. The `care-ai` Edge Function does not call OpenAI or any other language-model provider. It requires no model key or token budget. Internet access, an authenticated EnVizion session, and the existing Supabase service are still required.

## Supported interactions

- Greetings, a brief caregiver check-in, a clear help menu, and approved explanations of toolkit features.
- Buttons to existing appointments, calendar, tasks, care plan, notes, contacts, documents, care team, wellness, accessibility, privacy, medications and transition pages.
- Saved appointments, open tasks, open reminders, active plan items and recent communication summaries for an authorized selected profile. Lists show at most five entries and identify additional results. Query failures are identified as unavailable, never treated as an empty record.
- Guided reminders: ask for title, calendar date and explicit time, then return the existing editable draft card. For example: `Set a reminder` → `Call the clinic` → `tomorrow` → `9 AM`. ISO dates and explicit AM/PM or 24-hour time are supported. Ambiguous slash dates, bare hours and weekdays prompt for clarification.
- Care notes: `Write a care note` asks for factual user text. The draft preserves those words; it does not invent a clinical interpretation or rewrite the facts using a model.
- `cancel` stops an unfinished guided draft. `help` shows supported examples. An unrecognized request receives an honest explanation of the assistant's limits.

## Privacy and writes

The assistant always verifies the caller through Supabase Auth. Profile data remains off by default. If enabled, each request verifies profile visibility and current active membership using the caller's JWT and Row Level Security. Client-supplied role or permission claims are ignored. Only the categories requested by the message are loaded. All queries are read-only; the function uses the publishable/anon key scoped to the caller and never a service-role key.

Reminder and note drafts additionally require a caregiver/owner role. A proposed draft does not write anything. The existing client-side editing, date validation and Confirm & save controls call the existing RLS-protected reminder and communication APIs. Typing `yes`, `confirm` or `save` in chat does not save a record. Changing profile or privacy mode clears the conversation and pending draft. Retrying a failed reply does not duplicate the user's message.

No transcript, care information, or credential is sent to a model provider by this assistant. Other app features with their own provider integrations, such as visit transcription or visit summaries, are outside this change; their secrets have not been removed.

## Boundaries

This is a bounded conversational toolkit assistant, not a general reasoning model, symptom triage system, emergency monitor or clinical decision tool. It cannot prescribe, choose doses, change medications, invite users, upload documents, complete tasks or make other unsupported changes through chat. Supportive check-ins are fixed guidance, not therapy. Urgent or self-harm-related messages receive a conservative direction to appropriate human/emergency support, without inventing emergency numbers.

Reminder parsing deliberately supports a limited grammar. The editable draft is the source of truth for the user's confirmation. Recurring reminder summaries display their stored schedule and do not calculate the next firing time.

## Release

This change includes both the current source for `supabase/functions/care-ai` and the app UI. Release them together so the privacy description and assistant behavior agree. Keep JWT verification enabled. No database migration, paid model integration, schema change, new permission, or secret change is needed.

- Frontend: `npm run build:web`, then `npm run smoke:dist`.
- Pure engine and authenticated handler checks: `node --experimental-strip-types --test tests/toolkitAssistant.test.ts tests/careAI.test.ts`.
- Publish the four function source files (`index.ts`, `handler.ts`, `toolkit.ts`, `contracts.ts`) to the existing `care-ai` function in project `nvmepknmkptltnuxdyfv`.
- Publish the reviewed frontend commit through the existing Render service.
- Signed-in acceptance: greet with profile access off; enable the intended profile; show appointments/tasks; prepare a future reminder; edit/discard it; prepare a factual note; save only after explicit confirmation; verify its real record; switch profiles and confirm that the conversation and draft clear.

Tests use isolated synthetic fixtures. Production summaries only use saved records returned under the authenticated account's RLS permissions.


## Conversation and care rhythm

- Follow-up suggestion buttons respond to check-ins, observations, and activity charts. Guided draft questions keep their own flow without unrelated suggestion buttons.
- A factual user message such as “Mum ate lunch and walked in the garden today” can be followed by “Turn that into a note” or “Add notes to this”. The assistant uses only the most recent user statement, verbatim, in a general care-log draft. It never substitutes assistant-generated content as an observation. Unclear references ask for clarification. Attaching notes to a specific appointment/task still uses the corresponding page; chat does not claim to make that attachment.
- “Show care trends” returns a seven-day chart of care-note occurrence counts and reminder completion counts. These are recorded activity counts, not clinical trends, medication adherence, recurring occurrence counts or care quality scores. Today is partial. Dates use the user's timezone, including DST boundaries.
- The latest chart subscribes to existing profile-filtered Realtime changes for `care_communications` and `care_reminders`, re-fetching via the authenticated function. It also refreshes every 30 seconds while foregrounded, on foreground return, and on manual refresh. Realtime disconnection falls back to polling. Deletes missed by filtered subscriptions are reconciled by polling. Unmount/profile/consent changes remove subscriptions; out-of-date requests cannot update the component. Every fetch rechecks active membership.
- Charts show the last successful fetch time. Failed, unauthorized, or capped queries remove the chart instead of showing incomplete data as zero. A query reaching 1,000 rows per metric is conservatively treated as unavailable. Only timestamp fields are loaded for aggregation.
- No new packages, schemas, permissions, secrets, or model provider are required. Both activity tables were verified as present in the existing Realtime publication. Signed-in verification of websocket delivery and mobile visual layout remains a release acceptance step.
