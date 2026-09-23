import { supabase } from "./supabase";

export type CaregiverCoverageInsight = {
  userId: string;
  displayName: string;
  notifiedRequests: number;
  respondedRequests: number;
  acceptedRequests: number;
  declinedRequests: number;
  savedRequests: number;
  responseRatePct: number | null;
  avgResponseMinutes: number | null;
};

export type CoverageGapPattern = {
  weekdayIso: number;
  localHour: number;
  gapCount: number;
  totalGapMinutes: number;
};

export type CoverageOperationalInsights = {
  periodDays: number;
  generatedAt: string;
  summary: {
    coverageEvents: number;
    filledEvents: number;
    unresolvedEndedEvents: number;
    avgFillMinutes: number | null;
  };
  caregivers: CaregiverCoverageInsight[];
  gapPatterns: CoverageGapPattern[];
};

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function loadCoverageOperationalInsights(
  careRecipientId: string,
  periodDays = 90,
): Promise<CoverageOperationalInsights> {
  const { data, error } = await supabase.rpc(
    "care_coverage_operational_insights",
    {
      p_care_recipient_id: careRecipientId,
      p_days: periodDays,
    },
  );

  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("Coverage insights were not returned.");
  }

  const raw = data as any;
  const summary = raw.summary ?? {};

  return {
    periodDays: numeric(raw.period_days, periodDays),
    generatedAt: String(raw.generated_at ?? new Date().toISOString()),
    summary: {
      coverageEvents: numeric(summary.coverage_events),
      filledEvents: numeric(summary.filled_events),
      unresolvedEndedEvents: numeric(summary.unresolved_ended_events),
      avgFillMinutes:
        summary.avg_fill_minutes == null
          ? null
          : numeric(summary.avg_fill_minutes),
    },
    caregivers: Array.isArray(raw.caregivers)
      ? raw.caregivers.map((row: any) => ({
          userId: String(row.user_id),
          displayName: String(row.display_name || "Caregiver"),
          notifiedRequests: numeric(row.notified_requests),
          respondedRequests: numeric(row.responded_requests),
          acceptedRequests: numeric(row.accepted_requests),
          declinedRequests: numeric(row.declined_requests),
          savedRequests: numeric(row.saved_requests),
          responseRatePct:
            row.response_rate_pct == null
              ? null
              : numeric(row.response_rate_pct),
          avgResponseMinutes:
            row.avg_response_minutes == null
              ? null
              : numeric(row.avg_response_minutes),
        }))
      : [],
    gapPatterns: Array.isArray(raw.gap_patterns)
      ? raw.gap_patterns.map((row: any) => ({
          weekdayIso: numeric(row.weekday_iso),
          localHour: numeric(row.local_hour),
          gapCount: numeric(row.gap_count),
          totalGapMinutes: numeric(row.total_gap_minutes),
        }))
      : [],
  };
}
