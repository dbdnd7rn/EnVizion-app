# Step 10 — Installable Mobile Beta & Real-Device Testing

Prepared 9 November 2026. Scope: `dbdnd7rn/EnVizion-app` and its existing EAS
project `947baaf0-54d1-44c2-86c5-86c57c6aa11a`. VAC HMS is outside this work.

## Release provenance and boundaries

- Reviewed `main` at `0b91c91c76846d3b039098894b37dcfd23b456d3`, including the
  [Step 9 handover](STEP9_MOBILE_RELEASE_PILOT_ACCEPTANCE_2026-11-09.md).
- GitHub's security/quality job for that main commit completed successfully:
  [run 42696402018](https://github.com/dbdnd7rn/EnVizion-app/actions/runs/42696402018).
- Used a clean checkout, preserving the separate local checkout's unfinished work.
- Expo owner remains `ntonga_victor`; slug remains `envizion-life`; both native
  identifiers remain `com.envizionlife.caregiver`. No ownership transfer occurred.
- EAS history already contained Android build 3. This release advances only
  `android.versionCode` from 2 to **4**, retaining marketing version **0.1.1** and
  iOS build number **2**. This avoids producing a downgrade for earlier testers.
- The separate branding PR #58 is not included. Its versionCode 3 must be
  reconciled with build 4 or a higher number before a later APK is built.
- No production credential rotation, database writes, clinical approvals, patient
  data changes, store submission, or web deployment was performed by this step.

## Verified Expo access and Android build

- EAS CLI 27.5.0 authenticated as `ntonga_victor` using the existing environment
  token. Token values are never recorded here.
- `eas project:info` returned the exact authorized project ID above.
- The existing `preview` profile requests internal distribution and Android APK.
- EAS resolved the `preview` environment. Both required public-client variables
  exist. The URL matches the existing EnVizion Supabase project, and the key was
  verified as publishable/anonymous, not a service-role secret. Values are omitted.
- EAS selected the existing remote Android keystore; changes were frozen.
- Build source: `8abd09e` (reviewed main plus the versionCode increment).
- Build command:

```sh
npx eas-cli@27.5.0 build --platform android --profile preview --non-interactive --freeze-credentials --no-wait --message "Step 10 Android beta build 4; physical QA pending"
```

**Build outcome:** awaiting EAS completion verification. No successful artifact or
physical install is asserted by this line. Replace it only with observed build
ID, terminal status, source commit, artifact check and completion time.

The old APK files committed under `artifacts/` and older EAS builds are historical
artifacts. They are not evidence that Step 10's current code has been built.

## iPhone signing blocker

Read-only EAS queries returned **zero iOS credential configurations** for this
project and **zero stored Apple app identifiers** matching
`com.envizionlife.caregiver` under the existing owner. No
`EXPO_APPLE_TEAM_ID` or `EXPO_ASC_API_KEY_PATH` was available locally.

This establishes that usable signing was not available to this session; it does
not establish that the client has no Apple membership elsewhere. No iOS build,
Apple login, device registration, certificate creation or signing change was
attempted. Registered-device membership in a provisioning profile is unverified.

Next authorized owner action: provide delegated access to the intended **active,
paid Apple Developer team**, confirm control of the existing bundle identifier,
register an authorized test iPhone, and configure an ad hoc provisioning profile
including that device plus a valid distribution certificate. Keep credentials in
Apple/Expo's protected interfaces, never in this document or chat. Then use the
existing iOS `preview` profile and verify EAS success and installation separately.
A free Apple ID or simulator build is not evidence of an installable ad hoc IPA.

See Expo's [internal distribution guide](https://docs.expo.dev/build/internal-distribution/)
and [CI signing requirements](https://docs.expo.dev/build/building-on-ci/).

## Physical-device test inventory — not executed

The tester supplies actual device models and OS versions; these rows are targets,
not claims that devices were connected or tests ran. Use authorized disposable
test accounts and synthetic care data only. Never delete an existing installation
containing real care data to resolve an installation problem.

| Target | Required coverage | Device / OS / tester | Status |
|---|---|---|---|
| Android A | Lower-spec phone on oldest Android supported by the generated build | Unassigned | NOT RUN |
| Android B | Recent Android phone with biometrics and current OS | Unassigned | NOT RUN |
| iPhone A | Registered physical iPhone on the oldest supported iOS | Unassigned | BLOCKED: signing |
| iPhone B | Registered recent iPhone with Face ID | Unassigned | BLOCKED: signing |
| iPad | Layout, rotation/size behavior and accessibility, because tablet support is enabled | Unassigned | BLOCKED: signing |

Every Android A/B and iPhone A/B row must cover all four roles below; iPad covers
the same applicable workflows. Record unsupported hardware explicitly rather
than silently passing a capability.

| Test | Roles / setup | Required expected behavior | Android | iOS |
|---|---|---|---|---|
| Installation and upgrade | Fresh synthetic test device; existing build 2/3 with synthetic data | Confirm package, version/build, signature-compatible upgrade, preserved test session/data; cold launch without development server | NOT RUN | BLOCKED |
| Startup and accessibility | All roles; reduced motion; large fonts; TalkBack/VoiceOver | Splash transitions, controls readable/reachable, keyboard safe area, no hidden critical actions | NOT RUN | BLOCKED |
| Sign-in and recovery | Each role; valid/expired links; cancelled Google OAuth | Email sign-in, reset and `envizionlife://auth/confirmed` / `envizionlife://auth/reset-password` return to the right native flow | NOT RUN | BLOCKED |
| Primary Advocate | Two synthetic care recipients and authorized memberships | Invite/manage within role, switch profiles, no records or late responses from another profile | NOT RUN | BLOCKED |
| Co-Caregiver | Accepted invitation and later revoked membership | Assigned care/tasks/chat work; privileged actions remain restricted; revocation denies access | NOT RUN | BLOCKED |
| Care Recipient | Own care profile plus a second authorized invitation | Patient views remain read-only as designed; accept/decline invitation; correct profile after switching | NOT RUN | BLOCKED |
| Family Member | Limited role plus unpublished and approved reports | Only permitted shared information visible; no draft clinical material or unauthorized patient access | NOT RUN | BLOCKED |
| Consent gate | Invited/active synthetic pilot account; missing/current documents | Missing/unaccepted participation documents block; foreground revalidation applies; no invented consent records | NOT RUN | BLOCKED |
| Secure offline emergency data | Synthetic snapshot; airplane mode; restart; sign-out/account switch | Encrypted snapshot readable only for correct account/profile; stale status shown; sign-out wipes cache; denied access does not reuse stale authorized data | NOT RUN | BLOCKED |
| Vault and biometrics | Supported device; deny/cancel biometric prompt | Sensitive documents stay protected; cancellation/rejection safe; attachment permission failure recoverable | NOT RUN | BLOCKED |
| Notifications | Allow/deny OS permission; foreground/background/killed app | Correct recipient and route; token registration real; no sensitive lock-screen details; record any missing push-service credentials separately | NOT RUN | BLOCKED |
| Doctor Visit Companion | Synthetic notes/audio; microphone allow/deny/interruption | Explicit permission/consent; recording recovers; notes save before AI; drafts require review before sharing | NOT RUN | BLOCKED |
| Calendar, PDF and QR | Calendar allow/deny; PDF share; expired/revoked test QR | Only chosen calendar event added; native share/print works; expired/revoked QR denies data | NOT RUN | BLOCKED |
| Network/session recovery | Slow/offline network; expired session; revoked role | Honest loading/error/offline state; no false save success, duplicate actions, cross-account data or authorization bypass | NOT RUN | BLOCKED |
| Update and rollback rehearsal | Synthetic device only; record last approved artifact/signature | Upgrade verified; lower versionCodes are not normal in-place rollback; create a higher-code corrective build if needed | NOT RUN | BLOCKED |

For each execution record: case ID, EAS build ID and source commit, artifact hash,
device model/OS, tester, role, synthetic scenario, timestamp/timezone, steps,
expected/actual behavior, PASS/FAIL/BLOCKED, sanitized evidence, defect link and
retest build. Keep account identifiers, UDIDs, tokens, messages, medical details
and unredacted screenshots out of public GitHub. Use the client's protected QA
record for evidence requiring personal information.

## Acceptance and remaining release gates

An EAS `FINISHED` build and a reachable APK establish an artifact, not physical
device acceptance. Physical testing, accessibility, real participation consent,
clinical review and client launch approval remain pending until genuine evidence
is provided. Do not fill the matrix with automated-test results.

Four existing advisory exceptions expire **11 November 2026**. They were not
extended. Resolve or obtain explicit security review before expiry; retain the
preflight's expiry enforcement. This step also repairs Windows execution of the
existing audit gate and fails closed on incomplete/failed audit responses.

The [Step 8 handover](STEP8_PREPILOT_QA_HANDOVER_2026-11-04.md) and Step 9 ownership,
privacy and clinical requirements continue to apply. A documentation or build
tooling PR does not require redeploying Render or changing Supabase.
