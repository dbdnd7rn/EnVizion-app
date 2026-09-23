import { supabase } from "./supabase";

export type CoverageForecastSnooze = {
  requirementId: string;
  startsAt: string;
  endsAt: string;
  snoozedUntil: string;
};

export function coverageForecastWindowKey(
  requirementId: string,
  startsAt: string,
  endsAt: string,
) {
  const normalized = (value: string) => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
  };

  return (
    requirementId +
    "|" +
    normalized(startsAt) +
    "|" +
    normalized(endsAt)
  );
}

export async function loadCoverageForecastSnoozes(
  careRecipientId: string,
): Promise<CoverageForecastSnooze[]> {
  const { data, error } = await supabase.rpc(
    "list_care_coverage_forecast_snoozes",
    { p_care_recipient_id: careRecipientId },
  );

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    requirementId: String(row.requirement_id),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    snoozedUntil: String(row.snoozed_until),
  }));
}

export async function snoozeCoverageForecastWindow(input: {
  careRecipientId: string;
  requirementId: string;
  startsAt: string;
  endsAt: string;
  hours: 6 | 24 | 72;
}) {
  const { data, error } = await supabase.rpc(
    "snooze_care_coverage_forecast_window",
    {
      p_care_recipient_id: input.careRecipientId,
      p_requirement_id: input.requirementId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_hours: input.hours,
    },
  );

  if (error) throw error;
  if (!data) throw new Error("Forecast snooze was not saved.");
  return String(data);
}

export async function unsnoozeCoverageForecastWindow(input: {
  careRecipientId: string;
  requirementId: string;
  startsAt: string;
  endsAt: string;
}) {
  const { data, error } = await supabase.rpc(
    "unsnooze_care_coverage_forecast_window",
    {
      p_care_recipient_id: input.careRecipientId,
      p_requirement_id: input.requirementId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
    },
  );

  if (error) throw error;
  return Boolean(data);
}
