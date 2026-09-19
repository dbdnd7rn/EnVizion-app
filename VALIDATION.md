# Validation status

Verified on September 20, 2026.

## Passed

- Full dependency installation completed; `pnpm-lock.yaml` records resolved versions.
- TypeScript: `pnpm typecheck`.
- Ten domain tests: `pnpm test` (required readings, numeric validation including overflow, required observations, safe printable HTML, calendar/time validation, and appointment worksheet content).
- Production web export: `pnpm build:web`.
- Browser: onboarding renders with the original logo and typography, demo onboarding opens the dashboard, the care form accepts a sample 120/80 reading, the saved observation appears in history, and back navigation updates dashboard progress.
- Fixed a web-only SVG accessibility warning and empty-string rendering warnings. Rechecked the health-entry flow without new console errors.
- Appointment browser flow: saved sample title, date, time, and location; cancelled an unsaved title change; removed and added questions; confirmed the dashboard reflects the saved visit and question count. No browser console errors were reported; React Native Web emits a pointerEvents deprecation warning.
- The print action completed without an application error, but the in-app browser did not expose the print window for inspection. Actual printed layout remains unverified.

## Still to verify

- All remaining interactive flows, printing, mobile viewport coverage, and screen-reader behavior.
- iOS and Android device behavior and native PDF sharing.

## Running locally

The development preview uses http://localhost:8082. Start it again with `pnpm web --localhost` if the local server stops.

The frontend is a session-only demo. Real coaching bookings, backend integration, persistent records, clinical content approval, and app-store distribution are outside this frontend increment.

## Medication logging increment

- Type checking and production web export pass.
- New test verifies corrections preserve original entries and printed history retains the earlier medication name after an edit.
- Browser verified: recording a dose adds a timestamp, withdrawing it reduces the count and preserves history, and editing the medication name updates the list without changing the original record.
- Medication print layout and native device behavior remain unverified.

## Care summary increment

- Type checking, eight tests, and production web export pass.
- Browser verified dashboard navigation, empty states, medication-history navigation, and summary total updating after a dose entry.
- Summary data test checks observation units, notes, questions, and medication corrections.
- Final print layout and native device behavior remain unverified.

## Assistant and staff inbox preview

- TypeScript, ten domain tests, and production web export pass.
- Tests cover scripted-answer boundaries, spiritual opt-in, excluded conversation context, snapshot immutability, stale request IDs, duplicate open requests, staff replies, and rejection of replies after closure.
- Browser verified assistant navigation and starter question, handoff transcript preview, WhatsApp preference, local request creation, staff inbox context, staff reply appearing for caregiver, caregiver follow-up, and disabled composer after closure.
- Browser screenshot reviewed for the caregiver team conversation. Native keyboard behavior and broader small-screen/accessibility coverage remain unverified.
- Live AI and real staff, email, or WhatsApp delivery are not implemented or claimed.
