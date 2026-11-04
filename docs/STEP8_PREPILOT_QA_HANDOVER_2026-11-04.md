# EnVizion Life — Step 8 Pre-Pilot QA & Handover Checklist

Date: **4 November 2026** · Audience: EnVizion Life pilot administrator, designated clinical reviewer and VAC Systems engineering.

**Status: PRE-PILOT TECHNICAL REVIEW, NOT CLINICALLY APPROVED OR CLEARED FOR PRODUCTION PATIENT USE.**
Do not invent patient records, participant consents, approval dates, clinical sign-offs or UAT results. Use authorized test accounts, synthetic information and real physical devices. Never put patient health information in bug tickets or screenshots.

## System of record and scope

- Repository: https://github.com/dbdnd7rn/EnVizion-app (main).
- Web review environment: https://envizion-life-caregiver.onrender.com/
- Render: service \`envizion-life-caregiver\`; verify the **exact currently live commit** in the Render dashboard before each review.
- Supabase: \`envizion-life\` (project ID \`nvmepknmkptltnuxdyfv\`).
- Server gates: Supabase Edge Functions \`launch-validation\` and \`launch-admin\`.
- Native app: Expo/React Native. **Web release success does not validate native iPhone/Android builds.**
- Unrelated project \`VAC-eHealth-HMS\` must not be changed.

## Evidence snapshot (read-only production SQL, 4 November 2026)

| Required evidence | Observed |
|---|---:|
| Clinical guides in Draft | 8 |
| Clinical guides Published | 0 |
| Pilot participation documents | 0 |
| Pilot enrollments | 0 |
| Launch waves | 0 |
| Acceptance runs | 0 |
| Recovery drills | 0 |
| Launch sign-offs | 0 |

These zeros are authentic blockers and **must remain zeros until the owner, reviewer and real testers complete the workflows**.

## Release sequence and safety gates

1. **Clinical reviewer** reviews each of the eight draft educational guides, sources, emergency wording, and clinical scope. Administrator approves/publishes only after documented authorization. Record the reviewer name/date and any corrections in the approved clinical workflow.
2. **Owner/legal/privacy reviewer** finalizes three distinct required pilot documents: \`privacy_notice\`, \`pilot_consent\`, \`terms_of_use\`. Publish the exact approved versions and effective dates in Pilot Administration. Do not auto-accept on behalf of participants.
3. **Pilot administrator** invites actual consenting pilot participants. Each account must confirm invitation, first sign-in, every current required document, and care-team membership. Do not assign clinical roles from an admin shortcut.
4. **Engineering** confirms security advisor items, upstream dependency exceptions and web/native build readiness. No secrets or service-role keys in frontend code or evidence exports.
5. **Real testers** record all role/device acceptance journeys and recovery drills, with dates/device identifiers/OS/build. An authenticated user should test only their assigned real pilot role.
6. **Launch Center administrator** reviews blockers and records an explicit hold or approval. Server must reject approval if any required participation-document type is missing, even if some other types have multiple records.
7. **Client sign-off** must be evidenced by the actual authorized stakeholder. Website availability alone is not launch acceptance.

## Hands-on acceptance matrix

For every journey, record: tester account alias (not email), role, care profile alias, platform, device make/model, OS, app build, local date/time, actual result (pass/fail/blocked), and redacted screenshot reference.

| Test | Primary Advocate | Co-Caregiver | Care Recipient | Family Member |
|---|---|---|---|---|
| First sign-in and invitation acceptance | Verify | Verify | Verify | Verify |
| Correct selected patient/profile and no cross-profile leakage | Verify | Verify | Verify read-only | Verify approved-only |
| Care plan, medication, visits and vitals | Can edit when authorized | Can edit when authorized | View-only | Approved summary only |
| Care Team Chat and permissions/revocation | Send, switch and revoke | Send, switch | Role-permitted only | Authorized rooms only |
| Family report publishing and reading | Publish/approve | Role-permitted | Read according to role | Only approved published feed |
| Emergency Vault, temporary QR, expiry/revocation | Create/revoke | Role-permitted | Read-only | Permitted view only |
| Audit privacy and notification behavior | Verify | Verify | Verify | Verify |

All role checks must include: rejected access after revocation; stale data cleared after switching profiles; no cross-patient messages; accessible navigation and readable contrast; clear offline/permission errors.

## Device evidence (never mark complete from web tests alone)

- **iPhone physical device:** TestFlight or controlled native build owned by the client/developer account; login, safe areas, keyboard, photo selector, SecureStore emergency offline reboot/readback, biometrics and share/export permissions.
- **Android physical device:** Play/internal or controlled native build; hardware back, system navigation, permissions, background/foreground state, secure offline snapshot readback and notification delivery.
- **Web:** Responsive desktop/mobile browsers, refresh/deep link, dark mode, keyboard navigation, consent enforcement, PDF generation, temporary QR expiry and revocation.
- On each: low network/offline/reconnect, app restart, signed-out session, long text, large font accessibility, patient switching and cross-role restrictions.
- Recording/push/AI behavior requires real provider/backend availability verification, not only mock test assertions.

## Four mandatory recovery drills

1. \`network_reconnect\`: Toggle connectivity; verify error/stale indicators, then confirm clean recovery.
2. \`session_revocation\`: Revoke another device's session; verify access and sign-out semantics.
3. \`packet_recovery\`: Fail/retry a Care Packet export; verify no incorrect success or duplicates.
4. \`notification_recovery\`: Disable push; verify important events remain available in-app.

Record and review actual drill results in **Pilot launch validation**, not in source-code tests or synthetic database rows.

## Security and operations checks

- Check Supabase **Auth → password security** for leaked-password protection availability; administrator action/plan entitlement required. Do not claim this is enabled without verification. Documentation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review public SECURITY DEFINER chat RPC permissions and internal access predicates; do not revoke or replace these functions blindly since authorized chat relies on them. Database security linter: https://supabase.com/docs/guides/database/database-linter
- Audit all public data tables for RLS and exposed service-role credentials; verify emergency and family documents remain scoped to membership.
- Re-review temporary build-time security advisory exceptions by **11 November 2026**; do not auto-renew: \`security/advisory-exceptions.json\`.
- Verify backup/restore owner, on-call contact, reporting channel, retention expectations, incident response and release rollback ownership with the client.
- Keep all pre-pilot development changes clearly labeled, with no clinical sign-off claim.

## Engineering smoke commands and handoff proof

Use the current repository commit:

\`\`\`sh
npm ci --no-audit
npm run typecheck
npm test
npm run build:web
npm run smoke:dist
node scripts/security-audit.mjs
npm run smoke:live
\`\`\`

The live smoke checks the root HTML, JavaScript asset delivery, correct MIME type, same-origin redirects, and rejects a misleading HTTP 200 HTML fallback. **It is not an authenticated end-to-end test.**

For each release, capture:
- GitHub pull request and commit, all green GitHub Actions steps.
- Render deploy ID, exact commit, \`live\` status, and HTTP 200 health response.
- Deployed Supabase Edge Function slugs and versions (must match committed code).
- Real tester/device acceptance evidence and client authorization when obtained.

## Stop/rollback triggers

Hold rollout or rollback the code release for failed login, leaked protected data, incorrect role access, broken consent gate, inability to revoke emergency shares, failed clinical-data isolation, a database permission regression, or server errors that compromise patient safety. An unverified feature must be recorded as **Blocked / Not tested**, never Passed.

Render rollbacks must use a previously verified live, known-good commit, and be followed by functional smoke and API compatibility checks. An Edge Function rollback is a **separate** action from Render rollback. Never run destructive database resets to "clean" patient data.

## Final ownership and sign-off

| Approval or deliverable | Responsible | Current status |
|---|---|---|
| Code, build, server rule checks | VAC Systems engineering | Technical verification in progress |
| Eight clinical guides and emergency language | Designated EnVizion clinical reviewer | Awaiting review |
| Privacy notice, pilot consent, terms of use | Client/legal/privacy reviewer | Not published |
| Real pilot onboarding and role/device tests | Pilot administrator and authorized testers | No evidence recorded |
| Four recovery drills | Pilot testers | No evidence recorded |
| Launch Center evidence review and final approval | Authorized EnVizion Life client administrator | No sign-off recorded |
| App-store membership, builds, listings and privacy disclosures | Client owner/deployment team | Pending verified native release |

This document is a handover **checklist**, not a substitute for live tests, clinical judgment, privacy/legal advice, or an executed acceptance certificate.
