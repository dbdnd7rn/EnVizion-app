# EnVizion Life appearance system

## User control
Open **Profile → Accessibility & display → Appearance** and choose **Light** or **Dark**. The selection changes without clearing navigation, forms, or care records. The choice is stored locally using AsyncStorage at `@envizion-life/appearance/mode/v1` and loaded before the main interface appears. Light is the default for a device with no stored choice. A storage write failure displays a message and leaves the current visual mode in place for that session.

## Design
Light retains the previous cream/white/lavender palette. Dark uses charcoal and aubergine surfaces, lavender text accents, subdued borders, and a deeper plum for filled buttons. White button labels must retain at least a 4.5:1 contrast ratio. Alerts retain text/icon/status identifiers; color alone does not carry meaning. Device text scaling, reduced motion and screen reader support are unchanged.

## Implementation
- `src/themeColors.ts`: semantic palettes and role-aware legacy-color mapping. `themeAction` is for white-on-primary filled controls; `themeForeground` is for accent labels and icons. Do not interchange them.
- `src/appearance.tsx`: shared provider, AsyncStorage persistence and stable `themedScreen` wrapper. Wrappers subscribe to changes without remounting the screen.
- `src/ui.tsx` and `src/screens/ProfileLinkedUI.tsx`: theme-aware shared layout/text/card/input styles. Static StyleSheet objects use `themedStyles` so their color properties respond to changes.
- `App.tsx`: navigation, tab bar, status bar and both user/staff routes use the selected appearance.

## Rules for future pages
1. Prefer `C.paper`, `C.ink`, `C.muted`, `C.lavender`, `C.line` and the shared `Page`, `Card`, `Field`, and `Button` primitives.
2. For new bespoke graphics or exact brand shades, use `themeBackground`, `themeForeground`, `themeBorder`, `themeTint`, or `themeAction` according to the actual use. Avoid white text on the bright lavender text-accent shade.
3. Do not compute a theme-dependent color at module-import time. Compute it while rendering, or use `themedStyles` for static StyleSheet dictionaries.
4. Register new screens with the stable `themedScreen(Component)` wrapper or otherwise subscribe to `useAppearance`.
5. Both themes must support loading, disabled, validation/error, empty and success states; keep clinically important instructions readable. No changes to database permissions or care data should depend on appearance.

## Validation
Run `npm run typecheck`, `npm test`, `npm run build:web`, and `npm run smoke:dist`. The color/contrast and persistence-wiring regression checks are in `tests/appearanceTheme.test.ts`. For release QA, use a signed-in account on web and mobile to navigate Home, Care, Learn, Support, Profile, Accessibility, Care Team, 90-day review, medications, calendar, notifications, forms, and staff pages. Switch modes on a deep screen, then reload and re-check the persisted selection.
