export type NotificationFilter = "all" | "unread";

export type NotificationPresentationRecord = {
  audience: "caregiver" | "staff";
  kind: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
};

export type NotificationDestination = {
  route:
    | "StaffSupportThread"
    | "StaffWorkspace"
    | "TeamConversation"
    | "Coaching"
    | "AdvocateHandover"
    | "CareTeam"
    | "CareCalendar"
    | "CareTasks"
    | "CareShiftBoard"
    | "WeeklyCoveragePlan"
    | "CoverageForecast"
    | "CareCoverageRequests"
    | "CareSchedule"
    | "CareCoordinationInbox"
    | "FamilyCommunication"
    | "CareDocuments";
  params?: { requestId: string };
  activateCareRecipientId?: string;
};

export function filterNotifications<T extends { readAt: string | null }>(
  items: T[],
  filter: NotificationFilter,
) {
  if (filter === "unread") return items.filter((item) => !item.readAt);
  return items;
}

export function notificationDestination(
  item: NotificationPresentationRecord,
): NotificationDestination | null {
  if (item.audience === "staff") {
    if (item.entityType === "support_request" && item.entityId) {
      return {
        route: "StaffSupportThread",
        params: { requestId: item.entityId },
      };
    }
    return { route: "StaffWorkspace" };
  }

  if (item.entityType === "support_request") return { route: "TeamConversation" };
  if (item.entityType === "coaching_request") return { route: "Coaching" };

  if (item.entityType === "care_advocate_handover" && item.entityId) {
    return {
      route: "AdvocateHandover",
      activateCareRecipientId: item.entityId,
    };
  }

  if (item.entityType === "care_recipient") return { route: "CareTeam" };
  if (item.entityType === "care_reminder") return { route: "CareCalendar" };

  if (item.entityType === "care_task") {
    return {
      route:
        item.kind.includes("assignment") || item.kind.includes("assigned")
          ? "CareTasks"
          : "CareShiftBoard",
    };
  }

  if (item.entityType === "care_shift_handoff") {
    return { route: "CareShiftBoard" };
  }

  if (item.entityType === "care_weekly_coverage_slot") {
    return { route: "WeeklyCoveragePlan" };
  }

  if (item.entityType === "care_coverage_forecast") {
    return { route: "CoverageForecast" };
  }

  if (item.entityType === "care_coverage_request") {
    return { route: "CareCoverageRequests" };
  }

  if (item.entityType === "care_shift" || item.entityType === "care_shift_swap") {
    return { route: "CareSchedule" };
  }

  if (
    item.entityType === "care_coordination_resolution" ||
    item.entityType === "care_coordination_digest"
  ) {
    return { route: "CareCoordinationInbox" };
  }

  if (item.entityType === "care_family_update") {
    return { route: "FamilyCommunication" };
  }

  if (item.entityType === "care_document") return { route: "CareDocuments" };

  return null;
}

export function unreadSummary(count: number) {
  if (count <= 0) return "You're all caught up.";
  return `${count} unread update${count === 1 ? "" : "s"}`;
}
