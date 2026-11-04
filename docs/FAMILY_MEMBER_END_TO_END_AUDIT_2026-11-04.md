# EnVizion Life — Family Member end-to-end audit

Audit date: 2026-11-04. Repository: `dbdnd7rn/EnVizion-app`, production: https://envizion-life-caregiver.onrender.com/. Scope: existing EnVizion Life app and Supabase project `nvmepknmkptltnuxdyfv`. Do not test against the VAC EHealth project.

## Intended family permission model

A family member has **one user account**, may accept invitations to more than one recipient, and uses the existing caregiver design system. Once accepted as `viewer`, the only care flows are (1) approved Caregiver Updates and Daily/Weekly family summaries, (2) Care Team Chat, (3) explicitly shared appointment title/date/time/location, (4) offers of nonclinical help. Profile and account/privacy settings remain available. No raw medications, observations, clinical notes, care-plan rows, documents/audio, roster administration, or task editing should be available via either UI **or REST**. A pending, declined, expired, or revoked invitation grants no care data.

## Verified automatically

- UI route contract: viewer role gets `FamilyTabs` and no caregiver/patient stack screens. Avatar opens Family Profile.
- Invitation contract: account invitation or existing-account sign-in link, the pending invitation is tied to the signed-in user, expires after 14 days, and requires explicit accept.
- RLS: family direct-active status required for approved reports, help offers, and safe shared appointment RPC; raw clinical tables are restricted to editors and active patient accounts.
- Family Profile uses limited-field `care_accessible_profile_cards` RPC instead of granting all `care_recipients` fields to family.
- Shared visits are opt-in, default OFF, and expose only title/date/time/location. Visit notes and doctor questions are not exposed by the family RPC.
- Doctor-visit audio storage read access is editor/patient-only.
- Chat rechecks live authorization; a revoked direct viewer cannot fall back on a read-only CareGroup membership.
- Existing caregiver and care-recipient clinical read paths remain under `private.can_view_raw_care_recipient`.
- Tests are in `tests/familyRoleSecurity.test.ts` and CI validates TypeScript, tests, export, smoke and dependency audit.

## Real-account QA checklist (not performed automatically)

Use an **authorized pair of disposable test accounts**, with a synthetic, fictional care recipient and no real medical information. Preserve client production data; do not impersonate a real patient.

1. **Brand-new user:** Primary Advocate invites `Family Member` using a test email. Ensure email is received and user creates/activates their own account without duplicate registration; log in and accept.
2. **Existing user:** Invite an already registered second test account; verify sign-in invitation and no duplicate account creation.
3. **Pending/expired:** Check that a pending invitation shows no patient information. Verify 14-day expired invite is not accepted; request reinvitation.
4. **Role activation:** After acceptance, Family Home and only Home, Updates, Chat, Help tabs appear; family profile works.
5. **Daily & weekly reports:** Caregiver records safe meal/mobility routines; Primary Advocate publishes Daily/Weekly; family sees real completed/planned metrics, not fictional data.
6. **Unapproved report:** Draft/not-published report is invisible in family UI **and REST**.
7. **Caregiver Updates:** A caregiver-shared update appears for the correct recipient, not another profile.
8. **Chat:** Authorized viewer joins the group, sends/receives a message, and sees only authorized conversation participants.
9. **Appointments:** A private visit remains invisible, including REST. Caregiver explicitly shares a visit; title/date/time/location become visible, **notes and questions do not**. Unshare and verify disappearance.
10. **Practical help:** Family member offers groceries/transport; authorized caregiver accepts/declines; unrelated family member cannot see the offer.
11. **Direct URL/API:** Try raw `care_plan_items`, `care_plan_completions`, `medications`, `medication_records`, `care_observations`, `care_documents`, `appointments`, `care_recipients`, and `doctor_visits` as family viewer: expect zero raw rows.
12. **Patient role regression:** A `patient` account can read its own care info but cannot write restricted caregiver data. Co-Caregiver can still edit assigned records.
13. **Revocation:** Primary Advocate revokes family member; refresh token/session and verify family records, chat, reports, audio and shared appointments are inaccessible and the care profile vanishes from accessible profiles.
14. **Cross-recipient isolation:** An active family member for recipient A cannot access recipient B's data using arbitrary IDs or chat conversation IDs.
15. **Mobile and theme:** Verify Android/iPhone narrow display, typography, scroll, tab transitions, reduced motion, dark theme, keyboard, interrupted connection, sign out/sign back in.
16. **Notification and email:** Confirm invite emails actually arrive, acceptance produces the correct account role, and notification links never bypass permission checks.

## Remaining production readiness items

A successful GitHub build **cannot substitute for a two-account signed-in acceptance test**. Complete checklist above before claiming the flow is 100% verified. Supabase security advisors may still report intentional public chat RPCs implemented as SECURITY DEFINER with explicit membership checks; review and monitor those, and enable leaked-password protection in the Auth configuration. Avoid bypassing the security gate or using real patient records for QA.
