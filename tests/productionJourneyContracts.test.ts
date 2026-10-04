import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("production-critical routes remain registered", () => {
  const navigation = source("src/navigation.ts");
  const app = source("App.tsx");

  for (const route of [
    "Emergency",
    "CareDocuments",
    "CarePacket",
    "FamilyCommunication",
    "PrivacyData",
    "Accessibility",
    "PilotAdmin",
    "LaunchValidation",
    "LaunchCenter",
    "PilotFeedback",
    "PilotIntelligence",
  ]) {
    assert.match(navigation, new RegExp(`\\b${route}\\b`));
    assert.match(app, new RegExp(`name=["']${route}["']`));
  }
});

test("care provider exposes reconnect-aware sync state", () => {
  const store = source("src/store.tsx");
  assert.match(store, /syncStatus/);
  assert.match(store, /lastSyncedAt/);
  assert.match(store, /AppState\.addEventListener/);
});

test("privacy center exposes session revocation and minimized diagnostics", () => {
  const privacy = source("src/screens/PrivacyDataScreen.tsx");
  assert.match(privacy, /Sign out other devices/);
  assert.match(privacy, /Send technical diagnostics/);
  assert.match(privacy, /does not include medication names/i);
});

test("pilot admin exposes production operations without clinical record fields", () => {
  const admin = source("src/screens/PilotAdminScreen.tsx");
  assert.match(admin, /Production operations/);
  assert.match(admin, /failed packet exports/i);
  assert.match(admin, /does not expose/i);
});

test("pilot launch validation uses server-backed real-role evidence", () => {
  const validation = source("src/screens/LaunchValidationScreen.tsx");
  const client = source("src/launchValidation.ts");

  assert.match(validation, /Server-verified role/i);
  assert.match(validation, /no demo or synthetic care record/i);
  assert.match(validation, /Failure & recovery drills/i);
  assert.match(client, /launch-validation/);
  assert.match(client, /start_acceptance/);
  assert.match(client, /record_drill/);
});

test("admin launch center enforces evidence-based sign-off", () => {
  const center = source("src/screens/LaunchCenterScreen.tsx");
  const client = source("src/launchValidation.ts");

  assert.match(center, /Resolve blockers before approval/);
  assert.match(center, /Primary Advocate.*Co-Caregiver.*Care Recipient.*Family Member/s);
  assert.match(center, /iOS.*Android.*Web/s);
  assert.match(client, /launch-admin/);
  assert.match(client, /signoff/);
});

test("launch center blocks synthetic pilot foundation setup", () => {
  const center = source("src/screens/LaunchCenterScreen.tsx");
  const client = source("src/launchValidation.ts");

  assert.match(center, /Pilot foundation/);
  assert.match(center, /No real pilot cohort exists yet/);
  assert.match(center, /Real pilot cohort/);
  assert.match(center, /Open Pilot Administration/);
  assert.doesNotMatch(center, /label="Pilot cohort"/);
  assert.match(client, /PilotFoundationSnapshot/);
  assert.match(client, /activationReady/);
});

test("pilot admin exposes the five-stage activation command center", () => {
  const screen = source("src/screens/PilotAdminScreen.tsx");
  const client = source("src/pilot.ts");
  const helpers = source("src/pilotOnboardingHelpers.ts");

  assert.match(screen, /Activation command center/);
  assert.match(screen, /invitation acceptance/i);
  assert.match(screen, /first sign-in/i);
  assert.match(screen, /Outstanding documents/);
  assert.match(screen, /Care-role access is intentionally not assigned/);
  assert.match(screen, /Active · locked/);
  assert.match(client, /readyForActivation/);
  assert.match(client, /launchTestingReady/);
  assert.match(helpers, /Invitation accepted/);
  assert.match(helpers, /Real care-team role available/);
});

test("pilot operations automation stays visible and evidence based", () => {
  const admin = source("src/screens/PilotAdminScreen.tsx");
  const client = source("src/pilot.ts");
  const feedback = source("src/screens/PilotFeedbackScreen.tsx");

  assert.match(admin, /Stalled onboarding follow-up/);
  assert.match(admin, /scheduled reminder sweep runs every 6 hours/i);
  assert.match(admin, /Cohort progress/);
  assert.match(admin, /Pilot feedback triage/);
  assert.match(admin, /Completion locked · validation required/);
  assert.match(admin, /Withdraw \/ exit pilot/);
  assert.match(client, /loadPilotCohortProgress/);
  assert.match(client, /closeoutPilotParticipant/);
  assert.match(feedback, /PILOT FEEDBACK/);
  assert.match(feedback, /Bugs go to technical diagnostics/i);
});


test("pilot intelligence closes the operational reporting loop", () => {
  const screen = source("src/screens/PilotIntelligenceScreen.tsx");
  const client = source("src/pilotIntelligence.ts");
  const helpers = source("src/pilotIntelligenceHelpers.ts");
  const admin = source("src/screens/PilotAdminScreen.tsx");

  assert.match(screen, /PILOT METRICS & LAUNCH INTELLIGENCE/);
  assert.match(screen, /Device & platform validation matrix/);
  assert.match(screen, /Feedback trends/);
  assert.match(screen, /Launch-wave comparison/);
  assert.match(screen, /Generate pilot outcome report/);
  assert.match(client, /action: "intelligence"/);
  assert.match(helpers, /operational pilot evidence only/i);
  assert.match(admin, /Open Pilot Intelligence/);
});


test("Care Recipient role stays read-only across mutating care workspaces", () => {
  const protectedScreens = [
    "src/screens/CareCalendarScreen.tsx",
    "src/screens/CareTasksScreen.tsx",
    "src/screens/CareContactsScreen.tsx",
    "src/screens/MedicationManagementScreen.tsx",
    "src/screens/CareScheduleScreen.tsx",
    "src/screens/CareShiftBoardScreen.tsx",
    "src/screens/CarePlanScreen.tsx",
    "src/screens/CareCommunicationLogScreen.tsx",
    "src/screens/CareCoordinationInboxScreen.tsx",
    "src/screens/CareCoverageRequestsScreen.tsx",
    "src/screens/CareCoverageRequirementsScreen.tsx",
    "src/screens/SmartCoveragePlannerScreen.tsx",
    "src/screens/WeeklyCoveragePlanScreen.tsx",
    "src/screens/OnShiftCaregiverScreen.tsx",
    "src/screens/CareContinuityScreen.tsx",
    "src/screens/CareAnalyticsScreen.tsx",
    "src/screens/CareScreens.tsx",
    "src/screens/HospitalToHomeScreen.tsx",
    "src/screens/DoctorVisitCompanionScreen.tsx",
    "src/screens/EmergencyCenterScreen.tsx",
    "src/screens/CareDocumentsScreen.tsx",
    "src/screens/FamilyCommunicationScreen.tsx",
  ];

  for (const path of protectedScreens) {
    assert.match(
      source(path),
      /accessRole\s*(?:===|!==)\s*["']patient["']/,
      `${path} must explicitly handle the Care Recipient role`,
    );
  }

  const backend = source("src/backend.ts");
  assert.match(
    backend,
    /context\.accessRole === ["']patient["']/,
    "backend mutation guard must keep Care Recipient access read-only",
  );
});


test("Emergency QR uses the temporary secure share link", () => {
  const emergency = source("src/screens/EmergencyCenterScreen.tsx");
  const packageJson = source("package.json");

  assert.match(packageJson, /react-native-qrcode-svg/);
  assert.match(emergency, /react-native-qrcode-svg/);
  assert.match(emergency, /<QRCode/);
  assert.match(emergency, /value=\{createdShare\.shareUrl\}/);
  assert.match(emergency, /Scan at ER or triage/);
});


test("CareGroup membership can resolve and switch active care profiles", () => {
  const careTeam = source("src/careTeam.ts");
  const backend = source("src/backend.ts");

  assert.match(careTeam, /care_group_members/);
  assert.match(careTeam, /primary_advocate/);
  assert.match(careTeam, /co_caregiver/);
  assert.match(careTeam, /read_only/);
  assert.match(careTeam, /loadAccessibleCareContexts/);
  assert.match(careTeam, /setActiveCareRecipient/);
  assert.match(
    careTeam,
    /contexts\.some\(\(item\) => item\.careRecipientId === careRecipientId\)/,
  );
  assert.match(backend, /loadAccessibleCareContexts/);
  assert.match(backend, /contexts\.find\(\(context\) => context\.careRecipientId === preferredId\)/);
});


test("care team administration synchronizes invitation lifecycle into CareGroups", () => {
  const admin = source("supabase/functions/care-team-admin/index.ts");
  const migration = source(
    "supabase/migrations/20261004081000_sync_care_recipient_members_to_care_groups.sql",
  );

  assert.match(admin, /care_group_members/);
  assert.match(admin, /primary_advocate/);
  assert.match(admin, /co_caregiver/);
  assert.match(admin, /read_only/);
  assert.match(admin, /Only a Primary Advocate can manage care access/);
  assert.match(admin, /already has active access to this CareGroup/);
  assert.match(migration, /sync_care_group_member_from_recipient_member/);
  assert.match(migration, /after insert or update of role, status, invited_by, accepted_at, revoked_at/i);
  assert.match(migration, /when 'caregiver' then 'co_caregiver'/);
  assert.match(migration, /when 'viewer' then 'read_only'/);
  assert.match(migration, /new\.role = 'patient'/);
});


test("care invitation handoff identifies inviter and explains role access", () => {
  const careTeam = source("src/careTeam.ts");
  const admin = source("supabase/functions/care-team-admin/index.ts");
  const onboarding = source("src/screens/SupportScreens.tsx");
  const careTeamScreen = source("src/screens/CareTeamScreen.tsx");

  assert.match(careTeam, /inviterName: string/);
  assert.match(admin, /inviterName/);
  assert.match(admin, /user_metadata\?\.full_name/);
  assert.match(onboarding, /PRIVATE INVITATION/);
  assert.match(onboarding, /INVITED BY/);
  assert.match(onboarding, /What .* access means/);
  assert.match(onboarding, /Accept as/);
  assert.match(onboarding, /Nothing is shared with you until you accept/);
  assert.match(careTeamScreen, /Invited by \{invitation\.inviterName\}/);
  assert.match(careTeamScreen, /Access stays inactive until you/);
});


test("care invitation management exposes expiry reminders and accurate email state", () => {
  const careTeam = source("src/careTeam.ts");
  const admin = source("supabase/functions/care-team-admin/index.ts");
  const screen = source("src/screens/CareTeamScreen.tsx");
  const migration = source(
    "supabase/migrations/20261004094500_add_care_invitation_management_fields.sql",
  );

  assert.match(migration, /invite_expires_at/);
  assert.match(migration, /last_reminded_at/);
  assert.match(migration, /invite_email_requested_at/);
  assert.match(admin, /INVITATION_TTL_DAYS = 14/);
  assert.match(admin, /REMINDER_COOLDOWN_HOURS = 24/);
  assert.match(admin, /send_reminder/);
  assert.match(admin, /This invitation has expired/);
  assert.match(careTeam, /sendCareInvitationReminder/);
  assert.match(screen, /Invitation management/);
  assert.match(screen, /Send invitation reminder/);
  assert.match(screen, /Re-open invitation/);
  assert.match(screen, /Email requested/);
  assert.match(screen, /does not claim that the message was/);
});


test("automatic care invitation follow-up is scheduled and visible to Primary Advocates", () => {
  const migration = source(
    "supabase/migrations/20261004134800_automate_care_invitation_followups.sql",
  );
  const admin = source("supabase/functions/care-team-admin/index.ts");
  const careTeam = source("src/careTeam.ts");
  const home = source("src/screens/MainScreens.tsx");

  assert.match(migration, /dispatch_care_invitation_followups/);
  assert.match(migration, /invite_auto_reminder_sent/);
  assert.match(migration, /care_invite_needs_attention/);
  assert.match(migration, /care_invite_expiring/);
  assert.match(migration, /care_invite_expired/);
  assert.match(migration, /13 \* \* \* \*/);
  assert.match(admin, /action === "attention"/);
  assert.match(admin, /needsAttention/);
  assert.match(careTeam, /loadCareInvitationAttention/);
  assert.match(home, /CARE TEAM NEEDS ATTENTION/);
  assert.match(home, /expires within 48 hours/);
});


test("care team activity center keeps access accountability filterable", () => {
  const navigation = source("src/navigation.ts");
  const app = source("App.tsx");
  const careTeam = source("src/screens/CareTeamScreen.tsx");
  const activity = source("src/screens/CareTeamActivityScreen.tsx");
  const helpers = source("src/careTeamActivityHelpers.ts");

  assert.match(navigation, /CareTeamActivity/);
  assert.match(app, /name=["']CareTeamActivity["']/);
  assert.match(careTeam, /Care Team Activity Center/);
  assert.match(activity, /ACTIVITY & ACCOUNTABILITY/);
  assert.match(activity, /Filter timeline/);
  assert.match(activity, /Team member/);
  assert.match(activity, /Accountability timeline/);
  assert.match(helpers, /invite_sent/);
  assert.match(helpers, /invite_accepted/);
  assert.match(helpers, /invite_declined/);
  assert.match(helpers, /invite_reminder_sent/);
  assert.match(helpers, /invite_auto_reminder_sent/);
  assert.match(helpers, /role_changed/);
  assert.match(helpers, /access_revoked/);
  assert.match(helpers, /access_reinvited/);
});


test("care team access report stays privacy-minimized and Primary Advocate controlled", () => {
  const navigation = source("src/navigation.ts");
  const app = source("App.tsx");
  const screen = source("src/screens/CareTeamAccessReportScreen.tsx");
  const helpers = source("src/careTeamAccessReportHelpers.ts");
  const careTeam = source("src/careTeam.ts");
  const admin = source("supabase/functions/care-team-admin/index.ts");

  assert.match(navigation, /CareTeamAccessReport/);
  assert.match(app, /name=["']CareTeamAccessReport["']/);
  assert.match(screen, /Primary Advocate access required/);
  assert.match(screen, /Privacy-minimized export/);
  assert.match(screen, /Open report & save PDF/);
  assert.match(screen, /Create & share report PDF/);
  assert.match(helpers, /intentionally excludes medications, diagnoses, observations/i);
  assert.doesNotMatch(helpers, /member\.email/);
  assert.match(careTeam, /loadCareAccessReportData/);
  assert.match(careTeam, /recordCareAccessReportGeneration/);
  assert.match(admin, /record_access_report/);
  assert.match(admin, /Only a Primary Advocate can generate care access reports/);
  assert.match(admin, /access_report_generated/);
});


test("care team security review detects access conflicts without changing permissions", () => {
  const navigation = source("src/navigation.ts");
  const app = source("App.tsx");
  const careTeam = source("src/careTeam.ts");
  const screen = source("src/screens/CareTeamSecurityReviewScreen.tsx");
  const teamScreen = source("src/screens/CareTeamScreen.tsx");
  const admin = source("supabase/functions/care-team-admin/index.ts");

  assert.match(navigation, /CareTeamSecurityReview/);
  assert.match(app, /name=["']CareTeamSecurityReview["']/);
  assert.match(careTeam, /loadCareTeamSecurityReview/);
  assert.match(teamScreen, /Care Team Security Review/);
  assert.match(screen, /Primary Advocate access required/);
  assert.match(screen, /Run security review again/);
  assert.match(screen, /full forensic security audit/);
  assert.match(admin, /action === "security_review"/);
  assert.match(admin, /patient-write-conflict/);
  assert.match(admin, /revoked-still-group-active/);
  assert.match(admin, /role-mismatch/);
  assert.match(admin, /expired-invite/);
  assert.match(admin, /stale-active-access/);
  assert.doesNotMatch(admin, /action === "security_review"[\s\S]{0,22000}\.update\(/);
});


test("security remediation requires a current preview and explicit confirmation", () => {
  const navigation = source("src/navigation.ts");
  const app = source("App.tsx");
  const careTeam = source("src/careTeam.ts");
  const review = source("src/screens/CareTeamSecurityReviewScreen.tsx");
  const remediation = source("src/screens/CareTeamSecurityRemediationScreen.tsx");
  const admin = source("supabase/functions/care-team-admin/index.ts");
  const activity = source("src/careTeamActivityHelpers.ts");

  assert.match(navigation, /CareTeamSecurityRemediation/);
  assert.match(app, /name=["']CareTeamSecurityRemediation["']/);
  assert.match(review, /Security Remediation Center/);
  assert.match(careTeam, /loadCareTeamSecurityRemediationOptions/);
  assert.match(careTeam, /applyCareTeamSecurityRemediation/);
  assert.match(remediation, /Before & after preview/);
  assert.match(remediation, /I reviewed this before-and-after change/);
  assert.match(remediation, /Confirm & apply change/);
  assert.match(admin, /security_remediation_options/);
  assert.match(admin, /security_remediation_apply/);
  assert.match(admin, /payload\.confirm !== true/);
  assert.match(admin, /fingerprintValue/);
  assert.match(admin, /Care-team access changed after the preview/);
  assert.match(admin, /reduce_to_least_privilege/);
  assert.match(admin, /security_remediation_applied/);
  assert.match(admin, /security_access_confirmed/);
  assert.match(activity, /Security remediation applied/);
  assert.match(activity, /Access need reconfirmed/);
});


test("periodic care access recertification requires Primary Advocate sign-off", () => {
  const navigation = source("src/navigation.ts");
  const app = source("App.tsx");
  const careTeam = source("src/careTeam.ts");
  const screen = source("src/screens/CareAccessRecertificationScreen.tsx");
  const teamScreen = source("src/screens/CareTeamScreen.tsx");
  const activity = source("src/careTeamActivityHelpers.ts");
  const admin = source("supabase/functions/care-team-admin/index.ts");
  const scheduler = source(
    "supabase/migrations/20261004150000_add_periodic_care_access_recertification.sql",
  );
  const signoff = source(
    "supabase/migrations/20261004150500_add_atomic_care_access_recertification_signoff.sql",
  );

  assert.match(navigation, /CareAccessRecertification/);
  assert.match(app, /name=["']CareAccessRecertification["']/);
  assert.match(teamScreen, /Periodic Access Recertification/);
  assert.match(screen, /90-DAY ACCESS RECERTIFICATION/);
  assert.match(screen, /Keep access/);
  assert.match(screen, /Change role/);
  assert.match(screen, /Revoke access/);
  assert.match(screen, /I reviewed this person’s access/);
  assert.match(screen, /Confirm 90-day access decision/);
  assert.match(screen, /Primary Advocate access required/);
  assert.match(careTeam, /loadCareAccessRecertifications/);
  assert.match(careTeam, /completeCareAccessRecertification/);
  assert.match(admin, /action === "recertifications"/);
  assert.match(admin, /action === "recertify_access"/);
  assert.match(admin, /Explicit sign-off confirmation is required/);
  assert.match(scheduler, /care_access_recertifications/);
  assert.match(scheduler, /interval '90 days'/);
  assert.match(scheduler, /envizion-care-access-recertifications/);
  assert.match(scheduler, /29 \*\/6 \* \* \*/);
  assert.match(scheduler, /care_access_recertification_due/);
  assert.match(signoff, /apply_care_access_recertification/);
  assert.match(signoff, /Only a Primary Advocate can sign off access recertification/);
  assert.match(signoff, /role_snapshot is distinct from current_access_role/);
  assert.match(signoff, /access_recertification_completed/);
  assert.match(signoff, /access_recertified/);
  assert.match(signoff, /grant execute[\s\S]*service_role/i);
  assert.match(activity, /90-day access review completed/);
  assert.match(activity, /Periodic access recertification signed off/);
});
