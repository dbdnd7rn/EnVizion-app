import { supabase } from "./supabase";

export type CoverageForecastResolutionState =
  | "active"
  | "improved"
  | "in_progress"
  | "resolved"
  | "expired";

export type CoverageForecastResolution = {
  alertId: string;
  requirementId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  riskLevel: "high" | "elevated";
  originalAssignableCount: number;
  currentState: CoverageForecastResolutionState;
  resolutionType: string | null;
  resolutionSummary: string;
  resolvedAt: string | null;
  createdAt: string;
};

export async function loadCoverageForecastResolutionHistory(
  careRecipientId: string,
  days = 180,
): Promise<CoverageForecastResolution[]> {
  const { data, error } = await supabase.rpc(
    "care_coverage_forecast_resolution_history",
    {
      p_care_recipient_id: careRecipientId,
      p_days: days,
    },
  );

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    alertId: String(row.alert_id),
    requirementId: String(row.requirement_id),
    label: String(row.label || "Care coverage"),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    riskLevel: String(row.risk_level) as "high" | "elevated",
    originalAssignableCount: Number(row.original_assignable_count ?? 0),
    currentState: String(row.current_state) as CoverageForecastResolutionState,
    resolutionType: row.resolution_type
      ? String(row.resolution_type)
      : null,
    resolutionSummary: String(row.resolution_summary ?? ""),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: String(row.created_at),
  }));
}
