import { loadCareAgendaData } from "./careAgenda";
import {
  dashboardAttentionItems,
  dashboardRecentCommunications,
  dashboardShiftStatus,
  dashboardTaskBuckets,
  nextDashboardAppointment,
} from "./careDashboardHelpers";
import { loadCareCommunications } from "./careCommunications";
import { detectCoordinationConflicts } from "./careCoordinationConflicts";
import {
  loadCoordinationWorkflow,
  type CoordinationResolution,
} from "./careCoordinationWorkflow";
import { currentActionableConflicts } from "./careCoordinationWorkflowHelpers";
import { loadCareSchedule } from "./careSchedule";
import { loadCareTasks } from "./careTasks";
import { loadCareTeam } from "./careTeam";
import { loadCarePlan } from "./carePlan";
import { carePlanTodaySummary } from "./carePlanHelpers";
import { loadCareDocuments } from "./documents";
import {
  familyCommunicationCurrentUserId,
  loadFamilyCommunicationCenter,
} from "./familyCommunication";
import { familyCommunicationSummary } from "./familyCommunicationHelpers";
import { loadMedicationManagement } from "./medicationManagement";
import { loadCareTransitionWorkspace } from "./careTransition";
import {
  ownerDocumentStatus,
  ownerReconciliationStatus,
} from "./ownerDashboardHelpers";
import { supabase } from "./supabase";

export async function loadFamilyCareDashboard(
  careRecipientId: string,
  now = new Date(),
) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const [
    agenda,
    schedule,
    tasks,
    communications,
    workflow,
    roster,
    carePlan,
    documents,
    familyCenter,
    currentUserId,
    medicationData,
    transitionData,
    emergencyResult,
  ] = await Promise.all([
      loadCareAgendaData({
        careRecipientId,
        rangeStartIso: start.toISOString(),
        rangeEndIso: end.toISOString(),
      }),
      loadCareSchedule(careRecipientId),
      loadCareTasks(careRecipientId),
      loadCareCommunications(careRecipientId),
      loadCoordinationWorkflow(careRecipientId),
      loadCareTeam(careRecipientId),
      loadCarePlan(careRecipientId),
      loadCareDocuments(careRecipientId, { includeArchived: true }),
      loadFamilyCommunicationCenter(careRecipientId),
      familyCommunicationCurrentUserId(),
      loadMedicationManagement(careRecipientId),
      loadCareTransitionWorkspace(careRecipientId),
      supabase
        .from("care_emergency_profiles")
        .select("last_reviewed_at")
        .eq("care_recipient_id", careRecipientId)
        .maybeSingle(),
    ]);

  if (emergencyResult.error) throw emergencyResult.error;

  const conflicts = detectCoordinationConflicts({
    agenda,
    shifts: schedule.shifts,
    availability: schedule.availability,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    now,
  });

  const actionableConflicts = currentActionableConflicts(
    conflicts,
    workflow.resolutions,
    now,
  );
  const taskBuckets = dashboardTaskBuckets(tasks, now);
  const shiftStatus = dashboardShiftStatus(schedule.shifts, now);
  const nextAppointment = nextDashboardAppointment(agenda.appointments, now);
  const recentCommunications = dashboardRecentCommunications(communications, 3);
  const attention = dashboardAttentionItems({
    tasks,
    conflicts: actionableConflicts,
    communications,
    now,
    limit: 5,
  });

  const carePlanSummary = carePlanTodaySummary(
    carePlan.items,
    carePlan.completions,
    now,
  );
  const familySummary = familyCommunicationSummary(
    familyCenter.updates,
    familyCenter.acknowledgements,
    currentUserId,
  );
  const documentStatus = ownerDocumentStatus(documents, now);
  const latestReconciliation =
    medicationData.reconciliations[0] ?? null;
  const reconciliationStatus = ownerReconciliationStatus(
    latestReconciliation?.createdAt ?? null,
    now,
  );
  const openTransitionFollowUps = transitionData.followUps.filter(
    (followUp) => followUp.status === "open",
  );

  const memberMap = new Map(
    roster.members.map((member) => [member.userId, member]),
  );
  const caregiverName = (userId: string | null) => {
    if (!userId) return "Shared care team";
    const member = memberMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? `${member.displayName || "Me"} (me)`
      : member.displayName || "Caregiver";
  };

  const resolutionMap = new Map<string, CoordinationResolution>(
    workflow.resolutions.map((row) => [row.conflictKey, row]),
  );

  return {
    activeShift: shiftStatus.active
      ? {
          shift: shiftStatus.active,
          caregiverName: caregiverName(shiftStatus.active.caregiverId),
        }
      : null,
    nextShift: shiftStatus.next
      ? {
          shift: shiftStatus.next,
          caregiverName: caregiverName(shiftStatus.next.caregiverId),
        }
      : null,
    nextAppointment,
    overdueTasks: taskBuckets.overdue,
    dueSoonTasks: taskBuckets.dueSoon,
    dueTodayTasks: taskBuckets.dueToday,
    recentCommunications,
    actionableConflicts,
    timeSensitiveConflicts: actionableConflicts.filter(
      (conflict) => conflict.priority === "time_sensitive",
    ),
    unassignedTimeSensitiveConflicts: actionableConflicts.filter(
      (conflict) =>
        conflict.priority === "time_sensitive" &&
        !resolutionMap.get(conflict.id)?.assignedTo,
    ),
    attention,
    caregiverName,
    ownerSummary: {
      carePlan: carePlanSummary,
      family: familySummary,
      documents: documentStatus,
      medication: {
        activeCount: medicationData.medications.filter(
          (medication) => medication.active,
        ).length,
        reconciliationLabel: reconciliationStatus.label,
        reconciliationNeedsReview: reconciliationStatus.needsReview,
      },
      transition: {
        active: transitionData.plan?.status === "active",
        openFollowUps: openTransitionFollowUps.length,
      },
      emergency: {
        lastReviewedAt: emergencyResult.data?.last_reviewed_at ?? null,
      },
    },
  };
}

export type FamilyCareDashboardSnapshot = Awaited<
  ReturnType<typeof loadFamilyCareDashboard>
>;
