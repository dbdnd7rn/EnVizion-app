# App-wide visual system

This change applies the Hospital-to-home reference's visual language to existing
content: warm white, plum actions, navy text, Lora display headings, DM Sans
controls, restrained translucent cards, and subtle interaction feedback.

## Implementation

- `src/design.ts`: shared palette, fonts, geometry, motion, and surface styles.
- `src/ui.tsx`: headings, cards, buttons, fields, section labels, and page backgrounds.
- `src/components/DesignEnhancements.tsx`: progressive web focus, hover, reduced-motion,
  and reduced-transparency styling; removed on unmount.
- `App.tsx`: navigation surfaces and responsive application width.
- Existing custom headings use the same display font. Numeric metrics, labels,
  body text, and warning symbols remain in sans serif.
- Chat retains its custom keyboard layout and uses the common background.

All changes are presentation-only. Text content, route destinations, data access,
permissions, clinical guidance, and storage behavior are unchanged. Existing artwork
is retained. Native uses opaque card backgrounds where browser blur is unavailable.

## Screen coverage

Every screen module below imports the shared UI layer and inherits its applicable
components. Pages with existing custom designs retain those layouts and assets;
custom heading alignment is included where necessary. This inventory records source
coverage, not an authenticated end-to-end visual test of every route.

- AccessGovernanceAdminScreen.tsx
- AccessibilityScreen.tsx
- AdvocateHandoverScreen.tsx
- CareAccessRecertificationScreen.tsx
- CareAnalyticsScreen.tsx
- CareCalendarScreen.tsx
- CareCommunicationLogScreen.tsx
- CareContactsScreen.tsx
- CareContinuityScreen.tsx
- CareCoordinationInboxScreen.tsx
- CareCoverageRequestsScreen.tsx
- CareCoverageRequirementsScreen.tsx
- CareDocumentsScreen.tsx
- CareInsightsScreen.tsx
- CarePacketScreen.tsx
- CarePlanScreen.tsx
- CareScheduleScreen.tsx
- CareScreens.tsx
- CareShiftBoardScreen.tsx
- CareTasksScreen.tsx
- CareTeamAccessReportScreen.tsx
- CareTeamActivityScreen.tsx
- CareTeamScreen.tsx
- CareTeamSecurityRemediationScreen.tsx
- CareTeamSecurityReviewScreen.tsx
- ConversationScreens.tsx
- CoverageForecastScreen.tsx
- CoverageInsightsScreen.tsx
- DoctorVisitCompanionScreen.tsx
- EmergencyCenterScreen.tsx
- FamilyCommunicationScreen.tsx
- HospitalToHomeScreen.tsx
- LaunchCenterScreen.tsx
- LaunchValidationScreen.tsx
- MainScreens.tsx
- MedicationManagementScreen.tsx
- NotificationSettingsScreen.tsx
- NotificationsScreen.tsx
- OnShiftCaregiverScreen.tsx
- PilotAdminScreen.tsx
- PilotFeedbackScreen.tsx
- PilotIntelligenceScreen.tsx
- PrivacyDataScreen.tsx
- SmartCoveragePlannerScreen.tsx
- StaffClinicalContentScreens.tsx
- StaffManagementScreen.tsx
- StaffScreens.tsx
- SummaryScreen.tsx
- SupportScreens.tsx
- WeeklyCoveragePlanScreen.tsx
- WellnessScreen.tsx

## Verification

- TypeScript: passed.
- Existing domain tests: 282 passed under TZ=UTC (fixtures assume UTC).
- Expo production web export: passed.
- Export artifact smoke check: passed.
- Whitespace/conflict check: passed.
- Local browser visual verification: blocked because the Chromium download failed.
- Authenticated workflow testing and Render deployment verification: pending.

No new dependencies, schema changes, or backend changes are included.
