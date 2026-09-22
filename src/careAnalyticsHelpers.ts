import { escapeHtml } from "./domain.ts";
import type {
  AnalyticsAttendance,
  AnalyticsCoverageEvent,
  AnalyticsShift,
  AnalyticsTask,
  AnalyticsTaskCompletion,
  CareAnalyticsData,
} from "./careAnalytics";

export type AnalyticsPeriod = {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  label: string;
};

export type CaregiverAnalyticsRow = {
  caregiverId: string;
  scheduledMinutes: number;
  actualMinutes: number;
  completedTasks: number;
  lateCheckIns: number;
  lateMinutes: number;
  missedCheckIns: number;
  coverageGapEvents: number;
};

export type WeeklyAnalyticsSummary = {
  scheduledMinutes: number;
  actualMinutes: number;
  completedTasks: number;
  lateCheckIns: number;
  missedCheckIns: number;
  coverageGapEvents: number;
};

function validTime(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function weekPeriod(offset = 0, now = new Date()): AnalyticsPeriod {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const mondayDistance = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayDistance + offset * 7);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const labelEnd = new Date(end);
  labelEnd.setDate(labelEnd.getDate() - 1);

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: `${start.toLocaleDateString()} – ${labelEnd.toLocaleDateString()}`,
  };
}

export function clippedMinutes(
  startValue: string,
  endValue: string | null,
  periodStart: string,
  periodEnd: string,
  now = new Date(),
) {
  const start = validTime(startValue);
  const end = endValue ? validTime(endValue) : now.getTime();
  const rangeStart = validTime(periodStart);
  const rangeEnd = validTime(periodEnd);

  if (![start, end, rangeStart, rangeEnd].every(Number.isFinite)) return 0;

  const clippedStart = Math.max(start, rangeStart);
  const clippedEnd = Math.min(end, rangeEnd, now.getTime());
  if (clippedEnd <= clippedStart) return 0;
  return Math.round((clippedEnd - clippedStart) / 60_000);
}

export function missedCheckInShiftIds(
  shifts: AnalyticsShift[],
  attendance: AnalyticsAttendance[],
  periodStart: string,
  periodEnd: string,
  now = new Date(),
) {
  const attendanceShiftIds = new Set(attendance.map((item) => item.shiftId));
  const cutoff = now.getTime() - 15 * 60_000;
  const rangeStart = validTime(periodStart);
  const rangeEnd = validTime(periodEnd);

  return shifts
    .filter((shift) => {
      const start = validTime(shift.startsAt);
      return (
        shift.status !== "cancelled" &&
        Number.isFinite(start) &&
        start >= rangeStart &&
        start < rangeEnd &&
        start <= cutoff &&
        !attendanceShiftIds.has(shift.id)
      );
    })
    .map((shift) => shift.id);
}

export function buildCaregiverAnalytics(
  data: CareAnalyticsData,
  caregiverIds: string[],
  periodStart: string,
  periodEnd: string,
  now = new Date(),
) {
  const missedIds = new Set(
    missedCheckInShiftIds(
      data.shifts,
      data.attendance,
      periodStart,
      periodEnd,
      now,
    ),
  );

  return caregiverIds.map((caregiverId): CaregiverAnalyticsRow => {
    const caregiverShifts = data.shifts.filter(
      (shift) =>
        shift.caregiverId === caregiverId && shift.status !== "cancelled",
    );
    const caregiverAttendance = data.attendance.filter(
      (item) => item.caregiverId === caregiverId,
    );

    return {
      caregiverId,
      scheduledMinutes: caregiverShifts.reduce(
        (total, shift) =>
          total +
          clippedMinutes(
            shift.startsAt,
            shift.endsAt,
            periodStart,
            periodEnd,
            new Date(periodEnd),
          ),
        0,
      ),
      actualMinutes: caregiverAttendance.reduce(
        (total, item) =>
          total +
          clippedMinutes(
            item.checkedInAt,
            item.checkedOutAt,
            periodStart,
            periodEnd,
            now,
          ),
        0,
      ),
      completedTasks: data.completions.filter(
        (item) => item.completedBy === caregiverId,
      ).length,
      lateCheckIns: caregiverAttendance.filter((item) => item.lateMinutes > 0)
        .length,
      lateMinutes: caregiverAttendance.reduce(
        (total, item) => total + item.lateMinutes,
        0,
      ),
      missedCheckIns: caregiverShifts.filter((shift) => missedIds.has(shift.id))
        .length,
      coverageGapEvents: data.coverageEvents.filter(
        (event) => event.assignedTo === caregiverId,
      ).length,
    };
  });
}

export function weeklyAnalyticsSummary(
  rows: CaregiverAnalyticsRow[],
  data: CareAnalyticsData,
): WeeklyAnalyticsSummary {
  return {
    scheduledMinutes: rows.reduce(
      (total, row) => total + row.scheduledMinutes,
      0,
    ),
    actualMinutes: rows.reduce((total, row) => total + row.actualMinutes, 0),
    completedTasks: data.completions.length,
    lateCheckIns: rows.reduce((total, row) => total + row.lateCheckIns, 0),
    missedCheckIns: rows.reduce((total, row) => total + row.missedCheckIns, 0),
    coverageGapEvents: data.coverageEvents.length,
  };
}

export function formatHours(minutes: number) {
  if (!minutes) return "0h";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

export function scheduledSharePercent(
  row: CaregiverAnalyticsRow,
  rows: CaregiverAnalyticsRow[],
) {
  const total = rows.reduce((sum, item) => sum + item.scheduledMinutes, 0);
  if (!total) return 0;
  return Math.round((row.scheduledMinutes / total) * 100);
}

function safe(value: string) {
  return escapeHtml(value || "");
}

function item(value: string) {
  return `<li>${safe(value)}</li>`;
}

export function buildWeeklyCoordinationReportHtml(input: {
  careRecipientName: string;
  periodLabel: string;
  generatedAt: string;
  rows: CaregiverAnalyticsRow[];
  caregiverName: (userId: string) => string;
  data: CareAnalyticsData;
  summary: WeeklyAnalyticsSummary;
}) {
  const taskMap = new Map(input.data.tasks.map((task) => [task.id, task]));

  const caregiverRows = input.rows
    .map(
      (row) => `
      <tr>
        <td>${safe(input.caregiverName(row.caregiverId))}</td>
        <td>${safe(formatHours(row.scheduledMinutes))}</td>
        <td>${safe(formatHours(row.actualMinutes))}</td>
        <td>${row.completedTasks}</td>
        <td>${row.lateCheckIns}</td>
        <td>${row.missedCheckIns}</td>
        <td>${row.coverageGapEvents}</td>
      </tr>`,
    )
    .join("");

  const gapItems = input.data.coverageEvents.length
    ? `<ul>${input.data.coverageEvents
        .map((event) =>
          item(
            `${taskMap.get(event.taskId)?.title || "Care task"} · Due ${new Date(
              event.taskDueAt,
            ).toLocaleString()} · Detected ${new Date(
              event.detectedAt,
            ).toLocaleString()}`,
          ),
        )
        .join("")}</ul>`
    : "<p>No uncovered-task events were detected during this week.</p>";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Weekly Family Care Coordination Report</title>
<style>
  @page { margin: 20mm 16mm; }
  body { font-family: Arial, sans-serif; color: #2f2434; font-size: 12px; line-height: 1.45; }
  header { border-bottom: 3px solid #75418b; padding-bottom: 12px; margin-bottom: 18px; }
  .brand { font-size: 10px; letter-spacing: 1.4px; color: #75418b; font-weight: 700; }
  h1 { font-size: 24px; color: #3f2949; margin: 7px 0 3px; }
  h2 { font-size: 16px; color: #75418b; margin: 18px 0 7px; }
  .meta, .muted { color: #6d6272; font-size: 10px; }
  .metrics { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  .metric { border: 1px solid #ded5e4; border-radius: 8px; padding: 9px; min-width: 105px; }
  .metric strong { display: block; font-size: 17px; color: #3f2949; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border-bottom: 1px solid #ded5e4; padding: 7px 5px; text-align: left; vertical-align: top; }
  th { color: #75418b; font-size: 10px; }
  li { margin-bottom: 5px; }
  footer { margin-top: 24px; border-top: 1px solid #ded5e4; padding-top: 9px; color: #6d6272; font-size: 9px; }
</style>
</head>
<body>
<header>
  <div class="brand">ENVIZION LIFE · FAMILY CARE COORDINATION</div>
  <h1>Weekly Family Care Coordination Report</h1>
  <div class="meta">${safe(input.careRecipientName)} · ${safe(input.periodLabel)} · Generated ${safe(
    new Date(input.generatedAt).toLocaleString(),
  )}</div>
</header>
<div class="metrics">
  <div class="metric"><strong>${safe(formatHours(input.summary.scheduledMinutes))}</strong>Scheduled care</div>
  <div class="metric"><strong>${safe(formatHours(input.summary.actualMinutes))}</strong>Recorded attendance</div>
  <div class="metric"><strong>${input.summary.completedTasks}</strong>Tasks completed</div>
  <div class="metric"><strong>${input.summary.lateCheckIns}</strong>Late check-ins</div>
  <div class="metric"><strong>${input.summary.missedCheckIns}</strong>Missed check-ins</div>
  <div class="metric"><strong>${input.summary.coverageGapEvents}</strong>Coverage-gap alerts</div>
</div>
<h2>Caregiver workload</h2>
<table>
<thead><tr><th>Caregiver</th><th>Scheduled</th><th>Actual</th><th>Tasks</th><th>Late</th><th>Missed</th><th>Gaps</th></tr></thead>
<tbody>${caregiverRows || '<tr><td colspan="7">No caregiver activity recorded for this week.</td></tr>'}</tbody>
</table>
<h2>Detected coverage gaps</h2>
${gapItems}
<footer>
  Coordination summary generated from caregiver-entered EnVizion Life scheduling, attendance, and task records. It is not payroll, verified timekeeping, emergency monitoring, or a clinical record. Review important care coverage directly with the family and care team.
</footer>
</body>
</html>`;
}
