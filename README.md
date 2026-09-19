# EnVizion Life mobile MVP

A caregiver-facing Expo + React Native + TypeScript frontend for iOS, Android, and web review. Uses React Navigation, shared design tokens, bundled DM Sans and Lora typography, and the original EnVizion Life logo extracted from the supplied care-team document.

The browser preview runs at http://localhost:8082. Dependency installation, type checking, domain tests, and a production web export have completed successfully. See [validation details](VALIDATION.md).

## Run

Node 22.13+ and pnpm are required (verified with Node 24 and pnpm 11.19).

```sh
pnpm install
pnpm web
# Or start on a phone/emulator:
pnpm start
pnpm android
pnpm ios
```

iOS simulator requires macOS. Physical device testing can use a compatible Expo development environment. The browser preview is at http://localhost:8082.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build:web
```

Tests use the Node 22+ built-in TypeScript stripping feature (validated with Node 24).

## Included flows

- Two-step onboarding with name, caregiving relationship, and optional spiritual encouragement
- Home dashboard, Toolkit, Library, and Support tabs
- Vitals, blood sugar, CHF observations, behavior/delirium observations, and red-flag logs, with input validation and session history
- Editable sample medication list, timestamped dose history, corrections that retain original entries, and printable medication records; editable appointment title, date, time, location, and preparation notes, with question add/remove and a printable plan
- Hospital-to-home checklist with progress and printable worksheet
- Patient rights and advance care conversation starters
- COPD, heart failure, diabetes, kidney health, memory/neurological care, and stroke/TIA guides
- Eight specialist guides and visit preparation
- Coaching interest selection, explicitly not a sent request or confirmed booking
- Spiritual reflection, optional encouragement, and a one-minute quiet timer
- Saved guides, trusted resource links, printing on web, and PDF sharing on native
- Prominent emergency guidance and explicit US 911 action

## Architecture

`App.tsx` owns the native stack and bottom tabs. `src/navigation.ts` defines route contracts. `src/ui.tsx` contains shared components and design tokens. Feature screens live in `src/screens/`. `src/content.ts` separates educational content from presentation. `src/domain.ts` contains pure validation and safe printable HTML rendering. `src/store.tsx` owns session state through a typed reducer. `src/printing.ts` adapts export to the platform.

The frontend intentionally has no authentication, backend, analytics, external messaging, or persistent health data. Only sample information should be entered. Reloading clears session state. No medical thresholds, risk scoring, medication dosing, or automated clinical recommendations are generated.

## Content and branding

Original logo source: `Professional_Care_Team_for_Chronic_Illness_Management_EnVizion.docx`, supplied in the referenced conversation. Red and purple are taken from the logo; supporting lavender, ivory, and typography are proposed UI choices, not a claimed approved brand standard.

The educational summaries are draft content for Dr. Tolbert’s clinical review, not verbatim reproductions of the source documents. Stroke information was checked against [CDC guidance](https://www.cdc.gov/stroke/signs-symptoms/index.html). Other resource links point to Medicare, NIH/NIA/NHLBI/NIDDK, MedlinePlus, and EnVizion Life. Printouts are educational worksheets, not legal advance directive forms.

## Next integration phase

1. Confirm launch locations, emergency contacts, approved content, and exact medication/log requirements.
2. Add identity, consent, secure storage, user access controls, and backend services before collecting real health information.
3. Replace content fixtures with versioned, clinically reviewed content from an admin service.
4. Connect real coaching availability and explicit booking submission.
5. Add persistent care profiles, reminders only if requested, and approved PDF resources.
6. Verify on iOS and Android devices, including screen readers, larger text, keyboard behavior, and reduced motion.

No App Store build, production deployment, or clinical approval is implied by this frontend prototype.
