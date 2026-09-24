# Validation Status

Updated: 24 September 2026.

The old prototype validation notes have been retired. EnVizion Life now has authentication, persistent Supabase-backed care data, staff administration, pilot operations, launch validation and a production Render deployment.

## Automated release gate

Run:

```bash
npm install
npm run typecheck
npm test
npm run build:web
npm run smoke:dist
```

The GitHub Actions workflow `.github/workflows/security-quality-gate.yml` enforces the same production checks before a release is promoted.

## What automated validation covers

- dependency audit,
- TypeScript correctness,
- domain behavior and safety helpers,
- access/route contracts,
- care coordination and coverage planning helpers,
- pilot onboarding/activation contracts,
- launch validation/reporting contracts,
- Expo web export,
- production artifact structure.

## What automated validation cannot prove

- clinical accuracy/approval by EnVizion Life,
- real user consent,
- real Owner/Caregiver/Viewer workflows across multiple people,
- physical iOS/Android device behavior,
- screen-reader quality on target devices,
- real push delivery across every OS/device state,
- App Store/Play Store review acceptance,
- organizational/legal/regulatory readiness.

Those are captured as pilot/launch evidence and external dependencies rather than marked passed without evidence.

## Current production-pilot evidence

At the 24 September 2026 handoff snapshot, production contains no real pilot enrollments, launch waves, acceptance runs, recovery drills or sign-offs. All eight clinical-content records are still Draft. This is expected until EnVizion Life begins the real pilot.

The Pilot Intelligence Center and Launch Center will populate automatically as real evidence is recorded.
