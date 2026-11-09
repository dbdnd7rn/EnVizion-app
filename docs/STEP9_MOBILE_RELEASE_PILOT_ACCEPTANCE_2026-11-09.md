# EnVizion Life — Step 9 Mobile Preview & Client Pilot Acceptance

**Prepared:** 9 November 2026  
**Status:** PRE-PILOT TECHNICAL PREPARATION. No native binaries, developer memberships, physical-device test results, clinical approvals, or store listings are represented as completed here.

This guide applies **only to** \`dbdnd7rn/EnVizion-app\` and Supabase \`envizion-life\`. Do not modify VAC HMS. Use fictional test care data and authorized test accounts.

## Verified configuration

| Setting | Existing value | Release implication |
|---|---|---|
| Expo app name | EnVizion Life | Already configured |
| Expo app version | 0.1.1 | Native marketing version; package.json is 0.1.0, to align in an approved release |
| Expo owner | \`ntonga_victor\` | **Personal ownership**: client must confirm long-term owner/team before submission |
| EAS project ID | \`947baaf0-54d1-44c2-86c5-86c57c6aa11a\` | Preserve; do not invent a new project ID |
| iOS bundle identifier | \`com.envizionlife.caregiver\` | Client must confirm App Store Connect ownership and availability |
| Android package | \`com.envizionlife.caregiver\` | Client must confirm Play Console ownership and availability |
| iOS build number / Android version code | 2 / 2 | Increase for later store builds; never submit duplicate store versions |
| EAS \`preview\` | Internal distribution, Android APK | Suitable configuration for **internal** preview builds, subject to credentials |
| EAS \`production\` | Production build with local autoIncrement | No public store submission has been performed |

The preview configuration is **not proof that any installable Android APK or iOS IPA was built**.

## Run the preflight

From the repo root:

\`\`\`sh
npm ci --no-audit
npm run typecheck
npm test
npm run preflight:native
\`\`\`

The report distinguishes **configuration errors**, warnings (for example, Expo ownership and imminent security-advisory expiry), and human/device requirements. A passing preflight does not sign an app or clear it for patient use.

To enforce required public-client variables when running in an environment that exposes them to the command:

\`\`\`sh
npm run preflight:native -- --require-env
\`\`\`

EnVizion requires \`EXPO_PUBLIC_SUPABASE_URL\` and \`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY\` to be configured for the selected EAS build environment. These are **public/publishable** values compiled into the app, never service-role keys. Confirm with the Expo EAS dashboard or \`eas env:list --environment preview\`, using authorized team access. Do not paste private credentials into GitHub, tickets, or chat.

## Device previews — build only with authorized credentials

### Android

The existing \`preview\` profile already requests an installable APK.

\`\`\`sh
npx eas-cli@latest whoami
npx eas-cli@latest project:info
npx eas-cli@latest build --platform android --profile preview
\`\`\`

A successful build produces an EAS build artifact/link. Only after obtaining that artifact, install it on a physical Android test device and record the exact build ID. No Google Play listing is required for a direct internal APK test. Do not send APKs containing production patient data to unapproved testers.

### iPhone

**A paid Apple Developer Program membership and device registration are required for an EAS internal ad hoc iPhone build.** The current Expo project owner is \`ntonga_victor\`; do not use the client's Apple credentials or change the Expo owner without authorization.

\`\`\`sh
npx eas-cli@latest whoami
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
\`\`\`

The test device must be included in the provisioning profile. iOS 16+ may require Device Developer Mode for internal builds. If the client prefers TestFlight, prepare a separate signed \`production\` build under the **client's** Apple Developer/App Store Connect team before any submission. A normal unpaid Apple ID alone cannot distribute an iPhone IPA through EAS ad hoc preview.

Official references:
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/tutorial/eas/internal-distribution-builds/
- https://docs.expo.dev/accounts/account-types/
- https://docs.expo.dev/build-reference/app-versions/

## Ownership decisions before production store builds

1. **Client decision:** Retain the current personal Expo project with delegated access for pilot, or transfer it to a client-owned Expo organization. Expo requires appropriate Owner/Admin permissions on both accounts to transfer. Coordinate the project transfer through Expo settings; do not merely edit \`expo.owner\` and assume the linked EAS project and credentials moved.
2. **Apple Developer team:** Confirm active paid membership, legal identity/organization choice, signing certificates, App Store Connect access and unique bundle identifier.
3. **Google Play Console:** Confirm authorized client account, app registration/package ownership, app signing and intended pilot/internal-testing track.
4. **Build/version source:** The project currently uses \`appVersionSource: "local"\` and production \`autoIncrement: true\`; commit approved build-number increments or plan a controlled migration to EAS remote versioning. Do not change version provenance without knowing previous store submissions.
5. **App store privacy:** Confirm caregiver data collection, medical/wellness claims, emergency limitations, account deletion/support contact, screenshot permissions, rating, accessibility and app metadata with the client.

## Mandatory native acceptance before store submission

Use the existing [Step 8 QA and Handover Checklist](STEP8_PREPILOT_QA_HANDOVER_2026-11-04.md). At minimum, record the **real** device, OS, build ID, tester role and result for:

- Primary Advocate, Co-Caregiver, Care Recipient and Family Member sign-in/invitation, care-profile switching, record isolation, chat authorization and revocation.
- Google OAuth and email/password recovery on both mobile platforms, including the \`envizionlife://auth/confirmed\` and \`envizionlife://auth/reset-password\` callbacks. These redirect URLs must be allowed in the **EnVizion Supabase Auth** redirect list.
- Offline Emergency Vault: secure native snapshot, app restart, account switch, sign-out wipe, stale-data warning, optional biometrics, PDF/QR expiry and link revocation.
- Notifications and device push tokens, microphone/doctor visit flow, calendar add, photo/attachment permission, keyboard safe area, large-font/dark mode and screen reader navigation.
- Loss and recovery of network, expired session, revoked role and invalid invitation. Record failures and retest after fixes.
- Clinical language/education and all three effective legal/participation documents must be reviewed and formally approved by real client representatives.

No pilot acceptance should be marked "Passed" based solely on web CI, an Expo configuration check or a simulated test.

## Remaining deployment gates (9 November 2026)

- Four temporary dependency advisory exceptions in \`security/advisory-exceptions.json\` have a **11 November 2026** expiry; review or resolve upstream advisories before that date. The preflight reports expiration as a configuration error. **Do not silently renew exceptions.**
- The project remains pre-pilot until clinical approval, participant consent and signed real-device acceptance are completed.
- Supabase security advisor findings, including leaked-password protection and selected chat RPC permissions, require an administrator/security review.
- Do not rotate production credentials, change care-team RLS, transfer app ownership or submit to stores without authorization and a rollback plan.
- No client sign-off, pilot participation, native EAS build or store-submission evidence is asserted in this document.

**Next owner action:** Confirm which Expo organization and Apple/Google developer teams will own EnVizion Life, then authorize an internal Android APK and signed iPhone preview under that ownership. Document the resulting real build IDs and testing evidence before requesting store submission.
