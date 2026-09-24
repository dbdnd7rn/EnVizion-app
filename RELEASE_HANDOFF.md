# EnVizion Life Release Handoff

Date: 24 September 2026

## Production endpoints

- Web application: https://envizion-life-caregiver.onrender.com/
- Source repository: `dbdnd7rn/EnVizion-app`
- Supabase project: `envizion-life` (`nvmepknmkptltnuxdyfv`)

Secrets and service-role credentials are intentionally not documented here.

## Release workflow

Every production web release should pass:
1. locked dependency install,
2. dependency security audit,
3. TypeScript,
4. domain/contract tests,
5. Expo web export,
6. production artifact smoke,
7. Render build and HTTP health promotion.

Do not call a Render deployment live while its state is `build_in_progress` or `update_in_progress`.

## Pilot operating workflow

1. Publish the three required participation documents.
2. Invite a real pilot participant.
3. Participant confirms account and completes first sign-in.
4. Participant accepts all current required documents.
5. A care owner grants real Owner/Caregiver/Viewer access through the normal care-team workflow.
6. Pilot Admin activates the participant only after the server-side readiness gate passes.
7. Create a launch wave for a real cohort.
8. Run required role journeys and device checks.
9. Run the four recovery drills.
10. Review pilot feedback and technical diagnostics.
11. Complete participant closeout only after required launch validation evidence.
12. Use Launch Center for final wave sign-off.
13. Export the Pilot Outcome Report from Pilot Intelligence.

## Automated operations

- Care reminders and coverage automations run from existing scheduled Postgres jobs.
- Pilot onboarding reminder sweep: `envizion-pilot-onboarding-reminders`, every 6 hours.
- The same onboarding stage is deduplicated for 72 hours.
- Pilot completion evidence and reminder event records are private/service-owned surfaces.

## Production snapshot at handoff

At the time of this handoff:
- pilot enrollments: 0,
- launch waves: 0,
- acceptance runs: 0,
- recovery drills: 0,
- launch sign-offs: 0,
- clinical content: 8 Draft / 0 Published.

This is a truthful empty pilot, not a missing software feature. The system is waiting for real program content and participants.

## Known non-code launch dependencies

- EnVizion Life clinical/content approval.
- Final privacy/consent/terms wording.
- Real pilot participants and real care-team role assignments.
- Physical iOS and Android device testing.
- Accessibility/UAT evidence from target users/devices.
- Apple Developer / Google Play / Expo EAS ownership and credentials.
- Store listing copy, screenshots, privacy disclosures and review submission.
- Supabase Auth leaked-password protection toggle.
- Final launch-jurisdiction emergency wording and operational escalation coverage.

## Security notes

- Service credentials must remain server-side.
- Staff/admin Edge Functions validate authenticated sessions and staff membership.
- Care data access remains governed by database authorization/RLS and care-team membership.
- Launch evidence tables intentionally use service-mediated access rather than direct client mutation.
- Pilot reports deliberately exclude medication names, observations, family messages and document contents.
- Supabase's legacy API keys remain supported through the end of 2026, but migration to publishable/secret keys should be planned before legacy-key retirement.

## Definition of “software build complete”

The build is considered complete when the codebase contains the required workflows, automated gates, reporting and release configuration and the release gate is green.

That does **not** mean clinical approval or launch approval is complete. Those statuses require real human review and real-world evidence and must remain separate.
