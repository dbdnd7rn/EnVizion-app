# EnVizion Life — Emergency alert and preparedness fix

**Date:** 10 November 2026  
**Scope:** Existing \`Emergency information\` screen in \`src/screens/EmergencyCenterScreen.tsx\`; no VAC HMS changes.

## Documented client experience and implemented behavior

The provided *EnVizion Life / Client Experience Guide*, Section 19, describes the **Emergency alert** as an information shortcut to urgent-situation guidance. It explicitly says this control is **not an automatic call or emergency-responder dispatch**.

The previous implementation dialed a configured number immediately or opened profile editing; for read-only users without a configured number, pressing the alert produced no response.

The new behavior:

- The Emergency alert always opens a dedicated, accessible guidance view; patients and read-only family viewers can open it too.
- Gives direct instructions to contact local emergency services and warning-sign awareness, including standard B.E. F.A.S.T. stroke signs. This is general safety guidance only, with sources below. It is not a clinician-prescribed individual emergency action plan.
- Offers a **separate, explicit** button to open the telephone dialer **only when a plausible service number is saved**. It cannot assert that a call was connected or dispatched. If no valid number is saved, explains how to obtain it and offers authorized profile editing; no region-specific number is guessed.
- Provides a route to existing care contacts without sending automatic notifications.
- Shows the *same six real saved-record preparedness checks* behind the existing 0/6 indicator, with links to the correct existing profile, contacts, medications and documents views.
- Makes Last Review meaningful by explaining how the existing authorized confirmation works; no fake review timestamp or clinical certification.
- Improves dark-theme contrast and text wrapping for the two status cards; removes misleading decorative progress on Last Review.

Existing Emergency Vault features are preserved: sensitive records remain scoped to the active care profile, encrypted native offline snapshots, one-page PDF, QR sharing with time limits and revocation, focused clinical profile tiles, care contacts and medication links.

## Source provenance and boundaries

- The **client walkthrough**, not a signed instruction from Dr. Tolbert personally, supports the information-only emergency alert, six-part preparedness indication, last-review status, profile tiles, emergency contacts/medications, and temporary sharing. Do not attribute additional clinical protocols to her without an explicit source.
- The emergency warning signs and B.E. F.A.S.T. reference draw on:
  - American Heart Association: https://www.heart.org/en/about-us/heart-attack-and-stroke-symptoms
  - American Stroke Association: https://www.stroke.org/en/about-stroke/stroke-symptoms
  - NHS: https://www.nhs.uk/symptoms/shortness-of-breath/
- The app has not received approval to publish disease-specific clinical action plans (e.g. COPD oxygen settings, green/yellow/red thresholds), and they should not be invented here. Clinician-specific emergency protocols require Dr. Tolbert or her designated clinical reviewer to approve copy and patient applicability.
- **Lock-screen emergency access** is a separate native-device integration and privacy/security decision; an in-app modal or browser shortcut does not satisfy it. Device passcode/OS restrictions and preview beta builds must be tested before claiming lock-screen support.
- Neither this fix nor any code-based test constitutes an actual emergency response, completed clinical review, validated emergency phone number, signed-off pilot or physical-device acceptance.

## Verify with safe fictional data

1. As an authorized caregiver with no saved local emergency number, tap Emergency alert. Warning guidance must open immediately; tapping it must **not** initiate a call. It must offer a route to add the local number.
2. As a patient/read-only family viewer with no local number, tap Emergency alert. Guidance must still open, show safe missing-number messaging and Care contacts, and must not expose edit permissions.
3. With a **fictional/non-operational test number** in a non-production test care profile, verify the dialer button is visible and requires explicit tapping. Do **not** place a real emergency-service call during testing.
4. Tap Preparedness and confirm the six items reflect stored test records. Follow a missing item to the existing authorized editor/document/contacts view.
5. Tap Last Review and confirm it explains the existing review action; do not create fake review evidence.
6. Test dark/light mode, keyboard, small screen, native Android back button, large fonts, offline snapshot permission denial and switching care profiles. The source-code tests cannot replace manual device UAT.
