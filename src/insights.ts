import type { Appointment, Entry, TrackerKind } from "./domain";
import type { MedicationRecord } from "./medications";

export type DailyActivity = {
  dateKey: string;
  label: string;
  observations: number;
  medicationRecords: number;
  total: number;
};

export type NumericPoint = {
  recordedAt: string;
  value: number;
};

export type TimelineItem = {
  id: string;
  kind: "observation" | "medication";
  title: string;
  subtitle: string;
  recordedAt: string;
  corrected: boolean;
};

function dayKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function dayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function validDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function buildDailyActivity(
  entries: Entry[],
  medicationRecords: MedicationRecord[],
  days = 7,
  now = new Date(),
): DailyActivity[] {
  const count = Math.max(1, Math.floor(days));
  const rows: DailyActivity[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    rows.push({
      dateKey: dayKey(date),
      label: dayLabel(date),
      observations: 0,
      medicationRecords: 0,
      total: 0,
    });
  }

  const map = new Map(rows.map((row) => [row.dateKey, row]));

  for (const entry of entries) {
    const date = validDate(entry.recordedAt);
    if (!date) continue;
    const row = map.get(dayKey(date));
    if (!row) continue;
    row.observations += 1;
    row.total += 1;
  }

  for (const record of medicationRecords) {
    if (record.correctedAt) continue;
    const date = validDate(record.recordedAt);
    if (!date) continue;
    const row = map.get(dayKey(date));
    if (!row) continue;
    row.medicationRecords += 1;
    row.total += 1;
  }

  return rows;
}

export function numericSeries(
  entries: Entry[],
  kind: TrackerKind,
  key: string,
  limit = 10,
): NumericPoint[] {
  return entries
    .filter((entry) => entry.kind === kind)
    .map((entry) => {
      const value = Number(entry.values[key]);
      return {
        recordedAt: entry.recordedAt,
        value,
      };
    })
    .filter(
      (point) =>
        Number.isFinite(point.value) && Boolean(validDate(point.recordedAt)),
    )
    .sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    )
    .slice(-Math.max(1, Math.floor(limit)));
}

export function appointmentPreparation(
  appointment: Appointment,
  questions: string[],
) {
  const items = [
    { key: "date", ready: Boolean(appointment.date.trim()) },
    { key: "time", ready: Boolean(appointment.time.trim()) },
    { key: "location", ready: Boolean(appointment.location.trim()) },
    { key: "questions", ready: questions.some((item) => item.trim().length > 0) },
    { key: "notes", ready: Boolean(appointment.notes.trim()) },
  ];

  return {
    ready: items.filter((item) => item.ready).length,
    total: items.length,
    items,
  };
}

export function medicationStats(records: MedicationRecord[]) {
  const recorded = records.filter((record) => !record.correctedAt);
  const corrected = records.filter((record) => Boolean(record.correctedAt));

  return {
    recordedCount: recorded.length,
    correctedCount: corrected.length,
    latestRecordedAt:
      recorded
        .map((record) => record.recordedAt)
        .filter((value) => Boolean(validDate(value)))
        .sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime(),
        )[0] ?? null,
  };
}

function observationSummary(entry: Entry) {
  const parts = Object.values(entry.values)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.length ? parts.join(" · ") : "Care observation recorded";
}

export function buildCareTimeline(
  entries: Entry[],
  medicationRecords: MedicationRecord[],
  limit = 20,
): TimelineItem[] {
  const observationItems: TimelineItem[] = entries.map((entry) => ({
    id: `observation-${entry.id}`,
    kind: "observation",
    title: entry.kind,
    subtitle: observationSummary(entry),
    recordedAt: entry.recordedAt,
    corrected: false,
  }));

  const medicationItems: TimelineItem[] = medicationRecords.map((record) => ({
    id: `medication-${record.id}`,
    kind: "medication",
    title: record.medication.name,
    subtitle: record.correctedAt
      ? "Medication entry corrected / withdrawn"
      : "Medication entry recorded as taken",
    recordedAt: record.correctedAt ?? record.recordedAt,
    corrected: Boolean(record.correctedAt),
  }));

  return [...observationItems, ...medicationItems]
    .filter((item) => Boolean(validDate(item.recordedAt)))
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )
    .slice(0, Math.max(1, Math.floor(limit)));
}
