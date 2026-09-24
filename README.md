# EnVizion Life Caregiver Toolkit

EnVizion Life is a caregiver-facing Expo + React Native + TypeScript application for iOS, Android and web, with a Supabase production backend and a protected staff workspace.

Production web review: https://envizion-life-caregiver.onrender.com/

## What is implemented

### Caregiver experience
- Account authentication, recovery, profile and privacy/data controls.
- Multiple care profiles with Owner, Caregiver and Viewer access.
- Care-team invitations, consent-aware sharing and revocation.
- Vitals, blood sugar, CHF, behavior/memory and red-flag observation tracking.
- Medication management, dose records, corrections, reconciliation and printable history.
- Appointment preparation, questions, transition-home planning and care summaries.
- Care contacts/provider directory, care document vault and printable Care Packet.
- Family communication and provider/insurance communication logs.
- Daily care plans, shared care tasks, caregiver shifts, attendance, handoffs and continuity.
- Recurring care-coverage requirements, caregiver availability, Open Coverage, backup escalation and weekly approval plans.
- Smart Coverage Planner, coverage insights, proactive coverage forecasts and deduplicated forecast alerts.
- Notifications, quiet hours, native push registration, calendar integration and offline/reconnect-aware behavior.
- Educational library, specialist guidance, caregiver support/coaching requests and optional spiritual wellness.
- EnVizion Assistant with bounded support behavior and explicit human handoff.
- Pilot launch validation and a dedicated Pilot Feedback workspace.

### Staff / administration
- Authenticated staff workspace with server-enforced staff roles.
- Support inbox and clinical-content administration.
- Pilot enrollment, consent-document publishing, onboarding readiness and activation gates.
- Automatic onboarding reminders and 72-hour stalled-participant detection.
- Cohort progress, feedback/bug triage and evidence-based participant closeout.
- Launch waves, Owner/Caregiver/Viewer acceptance runs, device QA, recovery drills and launch sign-off.
- Pilot Intelligence Center with onboarding funnel, device/platform matrix, feedback trends, wave comparisons, outcomes, content readiness and printable/PDF pilot outcome reports.

## Architecture

- **Client:** Expo 54, React Native 0.81, React 19, TypeScript.
- **Navigation:** React Navigation native stack + bottom tabs.
- **Backend:** Supabase Auth, Postgres, RLS, Edge Functions, Storage/Realtime integrations and scheduled Postgres jobs.
- **Production web hosting:** Render.
- **Notifications:** in-app notifications plus Expo native push plumbing.
- **Printing/export:** Expo Print + native sharing.
- **Testing:** Node TypeScript tests, TypeScript compile checks, Expo web export and production-artifact smoke checks in GitHub Actions.

Core feature screens are under `src/screens/`. Pure domain helpers and backend clients live under `src/`. The CI release gate is `.github/workflows/security-quality-gate.yml`.

## Local development

Node 22+ is recommended.

```bash
npm install
npm run typecheck
npm test
npm run web
```

Production web export:

```bash
npm run build:web
npm run smoke:dist
```

## Native release preparation

`eas.json` contains preview and production build profiles. Before any store submission, link the repository to the correct Expo/EAS account and provide Apple/Google store credentials. Store submission is intentionally not automated without those real account credentials.

## Current external launch dependencies

The software foundation is built, but a real pilot/launch cannot be manufactured by code. As of 24 September 2026 the production pilot database still has no enrolled pilot participants, launch waves, acceptance runs, recovery drills or sign-offs; all eight clinical-content records remain Draft.

Before a real release decision:
1. Publish the approved Privacy Notice, Pilot Consent and Terms of Use.
2. Obtain Dr. Delphine Tolbert / EnVizion Life clinical review and publish approved clinical content.
3. Enroll real pilot participants and establish real Owner/Caregiver/Viewer care access.
4. Run real iOS, Android and web acceptance journeys on actual target devices.
5. Record recovery drills, resolve pilot feedback and complete launch-wave sign-off.
6. Confirm launch jurisdiction/emergency wording, data-retention policy and operational support coverage.
7. Enable Supabase leaked-password protection in Auth settings.
8. Link EAS/store accounts and complete App Store / Google Play review requirements.

See `RELEASE_HANDOFF.md` for the final technical and operational handoff.

## Safety boundary

EnVizion Life is a caregiver organization and education tool. It does not diagnose, prescribe, calculate medication doses or replace emergency/clinical care. Pilot analytics are operational evidence only; they are not clinical-safety, legal, regulatory or compliance certification.
