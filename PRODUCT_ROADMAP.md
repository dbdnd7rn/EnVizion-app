# EnVizion Life Product Roadmap

Updated: 24 September 2026.

## Build phase status

The planned software foundation is substantially implemented. The remaining work is no longer ordinary feature construction; it is **real-world validation, clinical/content approval, store ownership and launch operations**.

### Completed product areas

- Secure identity, account recovery, session controls and privacy/data management.
- Persistent care profiles with Owner/Caregiver/Viewer permissions.
- Care-team sharing, invitations, consent-aware membership and revocation.
- Core caregiver tracking, medication, appointments, transition-home, care summaries and printable exports.
- Care contacts, provider directory, document vault and Care Packet.
- Care plans, shared care tasks, family communication and provider communication logs.
- Caregiver availability, scheduling, shifts, attendance, handoffs and continuity.
- Recurring care requirements, Smart Coverage Planner, Open Coverage, backup escalation, weekly approval, coverage analytics, forecasting and forecast alerts.
- Notification preferences, native push plumbing, calendar integration and reconnect/offline behavior.
- Clinical-content admin workflow and staff support workspace.
- Pilot administration: documents, enrollment, onboarding gates, reminders, stalled detection, activation and participant closeout.
- Pilot launch validation: launch waves, role journeys, device QA, recovery drills and evidence-based sign-off.
- Pilot feedback and unified Admin triage.
- Pilot Intelligence Center and printable/PDF pilot outcome reporting.
- Production web deployment and automated security/quality release gate.

## External launch track

These items require decisions/evidence outside the codebase:

1. **Clinical content approval** — all content that will be represented as approved EnVizion Life guidance must be reviewed and published by the authorized clinical owner.
2. **Participation documents** — publish final Privacy Notice, Pilot Consent and Terms of Use.
3. **Real pilot cohort** — invite real participants and obtain real consent.
4. **Real care access** — Owner/Caregiver/Viewer roles must be created through actual care-team workflows, not seeded for appearance.
5. **Device/UAT evidence** — complete real iOS, Android and web testing, including small screens, text scaling, keyboard behavior, accessibility, background/resume and offline/reconnect.
6. **Recovery evidence** — execute the defined network reconnect, session revocation, Care Packet recovery and notification fallback drills.
7. **Launch sign-off** — use Launch Center gates and sign-off only after evidence exists.
8. **Store ownership** — connect the correct Expo/EAS, Apple Developer and Google Play Console accounts and supply store assets/credentials.
9. **Auth hardening** — enable leaked-password protection in Supabase Auth.
10. **Jurisdiction/operations** — confirm launch locations, emergency wording, support coverage, retention policy and incident response.

## Later expansion, not required to close the current build

Potential future commercial expansion can include multilingual content, external patient-portal/wearable integrations, deeper coach/provider portals and broader interoperability. These should be treated as post-pilot roadmap choices rather than hidden launch blockers.

## Release principle

No fake pilot users, fake acceptance runs, fake clinical approvals or fake launch sign-off should be created to make dashboards look complete. The application is designed so missing real evidence remains visible.
