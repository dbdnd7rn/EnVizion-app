import type {
  CareAuditEvent,
  CareRole,
  ConsentEvent,
} from "./careTeam";

export type CareTeamActivityCategory = "access" | "activity";

export type CareTeamActivityItem = {
  id: string;
  source: "consent" | "audit";
  category: CareTeamActivityCategory;
  title: string;
  detail: string;
  createdAt: string;
  actorUserId: string | null;
  subjectUserId: string | null;
  participantUserIds: string[];
  eventType: string;
  icon: string;
  tone: "purple" | "green" | "amber" | "rose" | "neutral";
};

function roleLabel(role: CareRole | null) {
  if (role === "owner") return "Primary Advocate";
  if (role === "caregiver") return "Co-Caregiver";
  if (role === "patient") return "Care Recipient";
  if (role === "viewer") return "Family Member";
  return "care-team";
}

function personName(
  userId: string | null,
  names: Map<string, string>,
  fallback: string,
) {
  if (!userId) return fallback;
  return names.get(userId) ?? fallback;
}

function consentPresentation(
  event: ConsentEvent,
  names: Map<string, string>,
): Omit<CareTeamActivityItem, "id" | "source" | "category" | "createdAt" | "actorUserId" | "subjectUserId" | "participantUserIds" | "eventType"> {
  const actor = personName(event.actorUserId, names, "System");
  const subject = personName(event.subjectUserId, names, "Care team member");
  const role = roleLabel(event.role);

  switch (event.eventType) {
    case "invite_sent":
      return {
        title: "Invitation sent",
        detail: `${actor} invited ${subject} as ${role}.`,
        icon: "person-add-outline",
        tone: "purple",
      };
    case "access_reinvited":
      return {
        title: "Invitation re-opened",
        detail: `${actor} re-opened ${subject}’s ${role} invitation.`,
        icon: "refresh-outline",
        tone: "purple",
      };
    case "invite_accepted":
      return {
        title: "Invitation accepted",
        detail: `${subject} accepted ${role} access.`,
        icon: "checkmark-circle-outline",
        tone: "green",
      };
    case "invite_declined":
      return {
        title: "Invitation declined",
        detail: `${subject} declined ${role} access.`,
        icon: "close-circle-outline",
        tone: "neutral",
      };
    case "invite_reminder_sent":
      return {
        title: "Invitation reminder sent",
        detail: `${actor} reminded ${subject} about the pending ${role} invitation.`,
        icon: "notifications-outline",
        tone: "amber",
      };
    case "invite_auto_reminder_sent":
      return {
        title: "Automatic invitation reminder",
        detail: `EnVizion reminded ${subject} because the ${role} invitation was nearing expiry.`,
        icon: "time-outline",
        tone: "amber",
      };
    case "role_changed": {
      const previous = event.note?.replace(/^Previous role:\s*/i, "").trim();
      const previousLabel = previous
        ? roleLabel(previous as CareRole)
        : "previous access";
      return {
        title: "Access role changed",
        detail: `${actor} changed ${subject} from ${previousLabel} to ${role}.`,
        icon: "swap-horizontal-outline",
        tone: "purple",
      };
    }
    case "access_revoked":
      return {
        title: "Access revoked",
        detail: `${actor} revoked ${subject}’s ${role} access.`,
        icon: "remove-circle-outline",
        tone: "rose",
      };
    case "security_remediation_applied":
      return {
        title: "Security remediation applied",
        detail:
          event.note ??
          `${actor} applied a confirmed access remediation for ${subject}.`,
        icon: "shield-checkmark-outline",
        tone: "purple",
      };
    case "advocate_handover_requested":
    case "advocate_handover_accepted":
    case "advocate_handover_declined":
    case "advocate_handover_cancelled":
      return {
        title: `Primary Advocate handover ${event.eventType.replace("advocate_handover_", "")}`,
        detail: event.note ?? `${actor} recorded a handover decision for ${subject}.`,
        icon: "swap-horizontal-outline",
        tone: event.eventType === "advocate_handover_accepted" ? "green" : "purple",
      };
    case "access_recertified":
      return {
        title: "90-day access review completed",
        detail:
          event.note ??
          `${actor} reviewed ${subject}’s ${role} access.`,
        icon: "calendar-outline",
        tone: "green",
      };
    default:
      return {
        title: event.eventType.replaceAll("_", " "),
        detail:
          event.note ??
          `${actor} recorded an access event for ${subject}${event.role ? ` · ${role}` : ""}.`,
        icon: "shield-checkmark-outline",
        tone: "neutral",
      };
  }
}

function auditPresentation(
  event: CareAuditEvent,
  names: Map<string, string>,
): Omit<CareTeamActivityItem, "id" | "source" | "category" | "createdAt" | "actorUserId" | "subjectUserId" | "participantUserIds" | "eventType"> {
  const actor = personName(event.actorUserId, names, "System");

  if (event.action === "workspace_opened") {
    return {
      title: "Care workspace opened",
      detail: `${actor} opened the shared care workspace.`,
      icon: "eye-outline",
      tone: "neutral",
    };
  }

  if (event.action === "weekly_coordination_report_generated") {
    return {
      title: "Coordination report generated",
      detail:
        event.summary ??
        `${actor} generated the weekly coordination report.`,
      icon: "analytics-outline",
      tone: "purple",
    };
  }

  if (event.action === "access_report_generated") {
    return {
      title: "Care Team Access Report generated",
      detail:
        event.summary ??
        `${actor} generated a Care Team Access Report.`,
      icon: "document-text-outline",
      tone: "purple",
    };
  }

  if (event.action === "security_remediation_applied") {
    return {
      title: "Security remediation confirmed",
      detail:
        event.summary ??
        `${actor} applied a confirmed care-team security remediation.`,
      icon: "shield-checkmark-outline",
      tone: "purple",
    };
  }

  if (event.action === "security_access_confirmed") {
    return {
      title: "Access need reconfirmed",
      detail:
        event.summary ??
        `${actor} reviewed inactive-looking access and confirmed it is still needed.`,
      icon: "checkmark-circle-outline",
      tone: "green",
    };
  }

  if (event.action === "access_recertification_completed") {
    return {
      title: "Periodic access recertification signed off",
      detail:
        event.summary ??
        `${actor} completed a 90-day care-team access review.`,
      icon: "calendar-outline",
      tone: "green",
    };
  }

  return {
    title: event.action.replaceAll("_", " "),
    detail:
      event.summary ??
      `${actor} recorded activity for ${event.entityType.replaceAll("_", " ")}.`,
    icon: "pulse-outline",
    tone: "neutral",
  };
}

export function buildCareTeamActivity(
  consent: ConsentEvent[],
  audit: CareAuditEvent[],
  names: Map<string, string>,
): CareTeamActivityItem[] {
  const consentItems = consent.map((event) => {
    const presentation = consentPresentation(event, names);
    const participantUserIds = [
      event.actorUserId,
      event.subjectUserId,
    ].filter((value): value is string => Boolean(value));

    return {
      id: `consent:${event.id}`,
      source: "consent" as const,
      category: "access" as const,
      createdAt: event.createdAt,
      actorUserId: event.actorUserId,
      subjectUserId: event.subjectUserId,
      participantUserIds: [...new Set(participantUserIds)],
      eventType: event.eventType,
      ...presentation,
    };
  });

  const auditItems = audit.map((event) => {
    const presentation = auditPresentation(event, names);
    return {
      id: `audit:${event.id}`,
      source: "audit" as const,
      category: "activity" as const,
      createdAt: event.createdAt,
      actorUserId: event.actorUserId,
      subjectUserId: null,
      participantUserIds: event.actorUserId ? [event.actorUserId] : [],
      eventType: event.action,
      ...presentation,
    };
  });

  return [...consentItems, ...auditItems].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function filterCareTeamActivity(
  items: CareTeamActivityItem[],
  category: "all" | CareTeamActivityCategory,
  memberUserId: string | null,
) {
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (
      memberUserId &&
      !item.participantUserIds.includes(memberUserId)
    ) {
      return false;
    }
    return true;
  });
}

export function summarizeCareTeamActivity(items: CareTeamActivityItem[]) {
  return {
    invitations: items.filter((item) =>
      ["invite_sent", "access_reinvited"].includes(item.eventType),
    ).length,
    accepted: items.filter(
      (item) => item.eventType === "invite_accepted",
    ).length,
    roleChanges: items.filter(
      (item) => item.eventType === "role_changed",
    ).length,
    revoked: items.filter(
      (item) => item.eventType === "access_revoked",
    ).length,
  };
}
