import type { AgendaEvent } from "./careAgendaHelpers";

function icsEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function utcStamp(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function localDateStamp(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(
    value.getDate(),
  )}`;
}

function nextLocalDay(value: Date) {
  const next = new Date(value);
  next.setDate(next.getDate() + 1);
  return next;
}

function safeUid(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 160);
}

function eventLines(event: AgendaEvent, careRecipientName: string) {
  const start = new Date(event.startsAt);
  if (!Number.isFinite(start.getTime())) return [];

  const title = event.title.trim() || event.sourceLabel || "Care event";
  const description = [
    event.sourceLabel,
    event.subtitle,
    careRecipientName ? `Care profile: ${careRecipientName}` : "",
    "Exported from EnVizion Life.",
  ]
    .filter(Boolean)
    .join("\n");

  const end = event.endsAt ? new Date(event.endsAt) : null;
  const validEnd = end && Number.isFinite(end.getTime()) ? end : null;

  const rows = [
    "BEGIN:VEVENT",
    `UID:${safeUid(event.id)}@envizionlife`,
    `DTSTAMP:${utcStamp(new Date())}`,
  ];

  if (event.allDay) {
    rows.push(`DTSTART;VALUE=DATE:${localDateStamp(start)}`);
    rows.push(
      `DTEND;VALUE=DATE:${localDateStamp(
        validEnd ? validEnd : nextLocalDay(start),
      )}`,
    );
  } else {
    rows.push(`DTSTART:${utcStamp(start)}`);
    rows.push(
      `DTEND:${utcStamp(
        validEnd ?? new Date(start.getTime() + 30 * 60_000),
      )}`,
    );
  }

  rows.push(`SUMMARY:${icsEscape(title)}`);
  if (description) rows.push(`DESCRIPTION:${icsEscape(description)}`);
  rows.push(`CATEGORIES:${icsEscape(event.sourceLabel || event.category)}`);
  rows.push("END:VEVENT");
  return rows;
}

export function buildCareAgendaIcs(input: {
  events: AgendaEvent[];
  careRecipientName: string;
  calendarLabel: string;
}) {
  const safeEvents = input.events.filter(
    (event) => !event.cancelled && event.category !== "medication",
  );

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EnVizion Life//Family Care Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(
      input.calendarLabel.trim() || "EnVizion Family Care",
    )}`,
    ...safeEvents.flatMap((event) =>
      eventLines(event, input.careRecipientName.trim()),
    ),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function calendarExportFilename(
  careRecipientName: string,
  view: "day" | "week",
) {
  const safeName =
    careRecipientName
      .trim()
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 50) || "care-profile";

  return `envizion-${safeName}-${view}-agenda.ics`;
}
