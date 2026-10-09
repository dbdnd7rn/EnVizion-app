# EnVizion Life navigation ownership

Last updated: 2026-10-10

## One home per feature

The mobile navigation is designed around a caregiver's next action, not around every module a developer can expose. A feature should have one **primary place** in the app. Contextual links are acceptable only when the user has a specific reason to act now (for example, an access invitation expiring or an emergency shortcut).

| Surface | Purpose | Primary destinations |
| --- | --- | --- |
| Home | What needs attention today and a small number of next steps | Daily priority, compact summary, up to three context-sensitive shortcuts, care-profile switcher |
| Care (Toolkit) | Record, plan and coordinate care | Observations, medications, care plan, calendar, care contacts, team access, tasks, shifts, coverage and documents |
| Learn (Library) | Find trusted, published educational content | Published guides, saved resources, healthcare specialist education |
| Support | Talk to someone or get personal support | EnVizion Assistant, team conversation, advocate coaching, spiritual wellness |
| Profile | Manage the signed-in user's account | Profile picture, privacy and data, accessibility, notification preferences, pilot feedback and sign out |

Screens remain registered in the root navigation stack, so existing workflows and deep links continue to work. Removing repeated entry cards **does not remove the underlying feature**, its data, or its permissions.

## Rules for adding navigation

1. Before introducing a card or button, identify its primary tab or the screen that owns the action.
2. Never show the same destination twice within one ordinary screen just under different labels (for example, "See all", "Open resources", and "Explore" all opening Resources).
3. Home may expose up to three shortcut actions at once; do not repeat the current primary action in those shortcuts.
4. Pinned/recent tools are reached using the Care search/filter controls instead of duplicating the category directory.
5. An exceptional link is allowed when it is prompted by real, relevant care data: a time-sensitive invitation, a missing shift, an urgent coordination issue, or emergency guidance.
6. Do not use unpublished demo guides, fictional care profiles, fabricated counters or fake notifications as navigation placeholders. The Learn featured area only shows published guide records.
7. Each stack screen should show one back control. If a screen draws a custom back/header, set `headerShown: false`; otherwise rely on the native stack header.
8. Cross-feature actions inside active workflows can stay where they help a user complete that workflow, but avoid recreating another tab's full feature directory.

## Regression checks

- `tests/profileDashboardNavigation.test.ts`: profile stack header and account separation.
- `tests/navigationClarity.test.ts`: one entry for core care features, unique educational route, no repeated Home/Support promo links, real Learn guide cards.
- GitHub Actions runs TypeScript, domain tests, Expo web export and artifact smoke before enforcing the existing dependency security audit. The security audit remains blocking and reports unrelated upstream advisories.

## Manual acceptance passes

- Home: confirm that the priority action is not repeated in the quick actions row; check both a new-care-profile state and an account with saved observations.
- Care: search for medications, coordination, contacts and coverage; open each directory group and check there is one ordinary entry per action. Verify pinning/search/filtering.
- Learn: verify zero published guides shows a proper empty state, not pretend guide cards; when guides exist, each featured card opens the matching published guide.
- Support: verify there is no clinical-transition or healthcare-navigation duplicate; support-specific options still work.
- Profile: verify photo editing, privacy, accessibility, notifications, pilot settings and sign-out remain accessible.
- Daily Care Plan and Care Team: verify one visible back arrow in each, and one account/profile settings link in Care Team.
- Navigate into a feature from its owning tab, use back, and confirm the user returns to the tab rather than losing context.
