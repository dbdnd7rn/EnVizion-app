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

export async function loadFamilyCareDashboard(
  careRecipientId: string,
  now = new Date(),
) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const [agenda, schedule, tasks, communications, workflow, roster] =
    await Promise.all([
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
    ]);

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
  };
}

export type FamilyCareDashboardSnapshot = Awaited<
  ReturnType<typeof loadFamilyCareDashboard>
>;
