import type { Entry } from "./domain";
export type TemperatureUnit = "C" | "F";

/** Fahrenheit is the canonical unit for new records; older untagged records remain unverified. */
export function toFahrenheit(value: number, unit: TemperatureUnit): number {
  return unit === "F" ? value : value * 9 / 5 + 32;
}
export function fromFahrenheit(value: number, unit: TemperatureUnit): number {
  return unit === "F" ? value : (value - 32) * 5 / 9;
}
export function formatTemperature(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toString();
}
/** Convert from canonical F, rather than converting a previously rounded display value. */
export function displayedTemperature(fahrenheit: number, unit: TemperatureUnit): string {
  return formatTemperature(fromFahrenheit(fahrenheit, unit));
}
export function legacyTemperatureUnit(values: Record<string, string>): TemperatureUnit | null {
  const recorded = values.temperature_unit;
  return recorded === "C" || recorded === "F" ? recorded : null;
}
/** Never infer the unit of an old row that has no temperature_unit metadata. */
export function temperatureForDisplay(values: Record<string, string>, target: TemperatureUnit): string | null {
  const raw = Number(values.temperature);
  if (!values.temperature || !Number.isFinite(raw)) return null;
  const recorded = legacyTemperatureUnit(values);
  if (!recorded) return `${values.temperature} (unit not recorded)`;
  const f = toFahrenheit(raw, recorded);
  return `${displayedTemperature(f, target)} °${target}`;
}
export function validateVitals(values: Record<string, string>, displayUnit: TemperatureUnit): string | null {
  for (const [key, label, lower, upper, whole] of [
    ["systolic", "Systolic blood pressure", 50, 300, true],
    ["diastolic", "Diastolic blood pressure", 30, 200, true],
    ["pulse", "Pulse", 25, 250, true],
    ["temperature", "Temperature", displayUnit === "C" ? 25 : 77, displayUnit === "C" ? 45 : 113, false],
  ] as const) {
    const raw = (values[key] ?? "").trim();
    if (!raw) {
      if (key === "systolic" || key === "diastolic") return `Please complete: ${label}.`;
      continue;
    }
    if (!/^\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw)) ||
        Number(raw) < lower || Number(raw) > upper || (whole && !Number.isInteger(Number(raw)))) {
      return `Enter a valid ${label.toLowerCase()} value (${lower}–${upper}${whole ? ", whole number" : ""}).`;
    }
  }
  if (Number(values.systolic) <= Number(values.diastolic)) {
    return "Systolic blood pressure must be higher than diastolic.";
  }
  if ((values.notes ?? "").length > 4000) return "Notes must be no longer than 4,000 characters.";
  return null;
}
export function canonicalVitals(values: Record<string, string>, unit: TemperatureUnit): Record<string, string> {
  const { temperature, ...rest } = values;
  if (!temperature?.trim()) return rest;
  // Canonical Fahrenheit is stored at 3 decimals, separate from the display's 1 decimal.
  return {
    ...rest,
    temperature: String(Number(toFahrenheit(Number(temperature), unit).toFixed(3))),
    temperature_unit: "F",
  };
}
export function localDayBounds(date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
export function dateRangeBounds(days: number, now = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return { start: start.toISOString(), end: now.toISOString() };
}
export function customRangeBounds(startText: string, endText: string): { start: string; end: string } | null {
  const parse = (s: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
  };
  const start = parse(startText), last = parse(endText);
  if (!start || !last || start > last || last.getTime() > Date.now()) return null;
  return { start: start.toISOString(), end: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).toISOString() };
}
export function vitalsEntries(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.kind === "Vitals")
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      || b.id.localeCompare(a.id));
}
