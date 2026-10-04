import { supabase } from "./supabase";

export type AccessGovernanceStatus =
  | "action_required"
  | "attention"
  | "review"
  | "clear";

export type AccessReviewBucket =
  | "overdue_14"
  | "overdue_7"
  | "due"
  | "upcoming_7"
  | "scheduled";

export type AccessGovernanceQueueItem = {
  id: string;
  careRecipientId: string;
  careRecipientName: string;
  primaryAdvocateName: string;
  subjectUserId: string;
  memberName: string;
  role: "caregiver" | "viewer";
  status: "scheduled" | "due";
  bucket: AccessReviewBucket;
  dueAt: string;
  daysToDue: number;
  overdueDays: number;
  advanceNotifiedAt: string | null;
  overdue7NotifiedAt: string | null;
  overdue14NotifiedAt: string | null;
};

export type AccessGovernanceCoverageGap = {
  careRecipientId: string;
  careRecipientName: string;
  primaryAdvocateName: string;
  subjectUserId: string;
  memberName: string;
  role: "caregiver" | "viewer";
};

export type AccessGovernanceCompletedItem = {
  id: string;
  careRecipientId: string;
  careRecipientName: string;
  subjectUserId: string;
  memberName: string;
  roleBefore: "caregiver" | "viewer";
  decision: "keep" | "change_role" | "revoke" | null;
  roleAfter: "caregiver" | "viewer" | null;
  reviewedByName: string;
  reviewedAt: string | null;
};

export type AccessGovernanceDashboard = {
  generatedAt: string;
  summary: {
    status: AccessGovernanceStatus;
    eligibleAccess: number;
    openReviews: number;
    coverageGaps: number;
    completed90Days: number;
    overdue14: number;
    overdue7: number;
    due: number;
    upcoming7: number;
    scheduled: number;
  };
  queue: AccessGovernanceQueueItem[];
  coverageGaps: AccessGovernanceCoverageGap[];
  recentCompleted: AccessGovernanceCompletedItem[];
  policy: {
    cadenceDays: number;
    upcomingWindowDays: number;
    overdueEscalationDays: number[];
    scope: string;
  };
};

export async function loadAccessGovernanceDashboard(): Promise<AccessGovernanceDashboard> {
  const { data, error } = await supabase.functions.invoke("launch-admin", {
    body: { action: "access_governance" },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as AccessGovernanceDashboard;
}

export async function recordAccessGovernanceReportGeneration(
  generatedAt: string,
) {
  const { data, error } = await supabase.functions.invoke("launch-admin", {
    body: {
      action: "record_access_governance_report",
      generatedAt,
      reportVersion: "1",
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
}
