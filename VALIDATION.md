# Validation status

Verified on September 18, 2026.

## Passed

- Full dependency installation completed; `pnpm-lock.yaml` records resolved versions.
- TypeScript: `pnpm typecheck`.
- Six domain tests: `pnpm test` (required readings, numeric validation including overflow, required observations, safe printable HTML, calendar/time validation, and appointment worksheet content).
- Production web export: `pnpm build:web`.
- Browser: onboarding renders with the original logo and typography, demo onboarding opens the dashboard, the care form accepts a sample 120/80 reading, the saved observation appears in history, and back navigation updates dashboard progress.
- Fixed a web-only SVG accessibility warning and empty-string rendering warnings. Rechecked the health-entry flow without new console errors.
- Appointment browser flow: saved sample title, date, time, and location; cancelled an unsaved title change; removed and added questions; confirmed the dashboard reflects the saved visit and question count. No browser console errors were reported; React Native Web emits a pointerEvents deprecation warning.
- The print action completed without an application error, but the in-app browser did not expose the print window for inspection. Actual printed layout remains unverified.

## Still to verify

- All remaining interactive flows, printing, mobile viewport coverage, and screen-reader behavior.
- iOS and Android device behavior and native PDF sharing.

## Running locally

The development preview uses http://localhost:8081. Start it again with `pnpm web --localhost` if the local server stops.

The frontend is a session-only demo. Real coaching bookings, backend integration, persistent records, clinical content approval, and app-store distribution are outside this frontend increment.
