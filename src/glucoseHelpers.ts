import type { Entry } from "./domain";

export type GlucoseUnit = "mg/dL" | "mmol/L";
export const GLUCOSE_MGDL_PER_MMOLL = 18.0182;

export const GLUCOSE_TIMING_OPTIONS = [
  "Before breakfast",
  "After a meal",
  "Before bedtime",
  "Fasting",
] as const;

export type GlucosePeriod = 7 | 30 | 90 | null;

/** Store newly entered glucose in mg/dL, irrespective of the selected display unit. */
export function glucoseToMgDl(value: number, unit: GlucoseUnit): number {
  return unit === "mmol/L" ? value * GLUCOSE_MGDL_PER_MMOLL : value;
}
export function glucoseFromMgDl(value: number, unit: GlucoseUnit): number {
  return unit === "mmol/L" ? value / GLUCOSE_MGDL_PER_MMOLL : value;
}
export function glucoseDisplay(valueMgDl: number, unit: GlucoseUnit): string {
  const rounded = Number(glucoseFromMgDl(valueMgDl, unit).toFixed(unit === "mmol/L" ? 2 : 1));
  return String(rounded);
}

/** Previously entered readings originated in the mg/dL-only form. */
export function storedGlucoseMgDl(values: Record<string, string>): number | null {
  const raw = (values.glucose ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = values.glucose_unit;
  if (unit === "mmol/L") return glucoseToMgDl(value, "mmol/L");
  if (unit === "mg/dL" || !unit) return value;
  return null;
}
export function canonicalGlucose(values: Record<string, string>, unit: GlucoseUnit): Record<string, string> {
  const raw = Number(values.glucose);
  if (!Number.isFinite(raw) || raw <= 0) return values;
  return {
    ...values,
    glucose: String(Number(glucoseToMgDl(raw, unit).toFixed(3))),
    glucose_unit: "mg/dL",
  };
}
export function glucoseHistoryEntries(entries: Entry[], days: GlucosePeriod, now = new Date()): Entry[] {
  const start = days === null ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime();
  return entries.filter((entry) => {
    const timestamp = Date.parse(entry.recordedAt);
    return entry.kind === "Blood sugar" && Number.isFinite(timestamp) &&
      timestamp <= now.getTime() && (start === null || timestamp >= start) &&
      storedGlucoseMgDl(entry.values) !== null;
  }).sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.id.localeCompare(a.id));
}
