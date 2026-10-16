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

This is a command/FAQ assistant, not a general reasoning model, symptom triage system, emergency monitor or clinical decision tool. It cannot prescribe, choose doses, change medications, invite users, upload documents, complete tasks or make other unsupported changes through chat. Supportive check-ins are fixed guidance, not therapy. Urgent or self-harm-related messages receive a conservative direction to appropriate human/emergency support, without inventing emergency numbers.

Reminder parsing deliberately supports a limited grammar. The editable draft is the source of truth for the user's confirmation. Recurring reminder summaries display their stored schedule and do not calculate the next firing time.

## Release

This change includes both the current source for `supabase/functions/care-ai` and the app UI. Release them together so the privacy description and assistant behavior agree. Keep JWT verification enabled. No database migration, paid model integration, schema change, new permission, or secret change is needed.

- Frontend: `npm run build:web`, then `npm run smoke:dist`.
- Pure engine and authenticated handler checks: `node --experimental-strip-types --test tests/toolkitAssistant.test.ts tests/careAI.test.ts`.
- Publish the four function source files (`index.ts`, `handler.ts`, `toolkit.ts`, `contracts.ts`) to the existing `care-ai` function in project `nvmepknmkptltnuxdyfv`.
- Publish the reviewed frontend commit through the existing Render service.
- Signed-in acceptance: greet with profile access off; enable the intended profile; show appointments/tasks; prepare a future reminder; edit/discard it; prepare a factual note; save only after explicit confirmation; verify its real record; switch profiles and confirm that the conversation and draft clear.

Tests use isolated synthetic fixtures. Production summaries only use saved records returned under the authenticated account's RLS permissions.
