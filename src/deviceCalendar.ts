import { Platform } from "react-native";
import type { Appointment } from "./domain";
import type { CareReminder } from "./reminderHelpers";
import { localDateTimeToIso } from "./reminderHelpers";

function icsEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function utcStamp(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function downloadIcs(filename: string, body: string) {
  const documentRef = (globalThis as any).document;
  const urlRef = (globalThis as any).URL;
  const BlobCtor = (globalThis as any).Blob;

  if (!documentRef || !urlRef || !BlobCtor) {
    throw new Error("Calendar download is unavailable in this browser.");
  }

  const blob = new BlobCtor([body], { type: "text/calendar;charset=utf-8" });
  const url = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  urlRef.revokeObjectURL(url);
}

function eventIcs(input: {
  title: string;
  start: Date;
  end: Date;
  note?: string;
  location?: string;
}) {
  const now = utcStamp(new Date());
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EnVizion Life//Care Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@envizionlife`,
    `DTSTAMP:${now}`,
    `DTSTART:${utcStamp(input.start)}`,
    `DTEND:${utcStamp(input.end)}`,
    `SUMMARY:${icsEscape(input.title)}`,
    input.location ? `LOCATION:${icsEscape(input.location)}` : "",
    input.note ? `DESCRIPTION:${icsEscape(input.note)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export async function addReminderToDeviceCalendar(reminder: CareReminder) {
  const start = new Date(reminder.snoozedUntil ?? reminder.scheduledFor);
  if (!Number.isFinite(start.getTime())) {
    throw new Error("This reminder does not have a valid scheduled time.");
  }

  const end = new Date(start.getTime() + 30 * 60_000);
  const note = [
    reminder.note,
    reminder.recurrence === "none"
      ? "Added from EnVizion Life."
      : "Added from EnVizion Life. This calendar event represents the next reminder occurrence only.",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (Platform.OS === "web") {
    downloadIcs(
      "envizion-care-reminder.ics",
      eventIcs({
        title: `EnVizion: ${reminder.title}`,
        start,
        end,
        note,
      }),
    );
    return;
  }

  const Calendar = await import("expo-calendar");
  await Calendar.createEventInCalendarAsync({
    title: `EnVizion: ${reminder.title}`,
    startDate: start,
    endDate: end,
    notes: note,
    timeZone: reminder.timezone,
  });
}

function dateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export async function addAppointmentToDeviceCalendar(
  appointment: Appointment,
) {
  if (!appointment.date.trim()) {
    throw new Error("Add an appointment date before opening the calendar.");
  }

  let start: Date;
  let end: Date;
  let allDay = false;

  if (appointment.time.trim()) {
    const iso = localDateTimeToIso(appointment.date, appointment.time);
    if (!iso) throw new Error("The appointment date or time is invalid.");
    start = new Date(iso);
    end = new Date(start.getTime() + 60 * 60_000);
  } else {
    const parts = dateParts(appointment.date);
    if (!parts) throw new Error("The appointment date is invalid.");
    start = new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
    end = new Date(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0, 0);
    allDay = true;
  }

  const title = appointment.title.trim() || "Care appointment";

  if (Platform.OS === "web") {
    downloadIcs(
      "envizion-appointment.ics",
      eventIcs({
        title: `EnVizion: ${title}`,
        start,
        end,
        note: appointment.notes,
        location: appointment.location,
      }),
    );
    return;
  }

  const Calendar = await import("expo-calendar");
  await Calendar.createEventInCalendarAsync({
    title: `EnVizion: ${title}`,
    startDate: start,
    endDate: end,
    allDay,
    location: appointment.location || undefined,
    notes: appointment.notes || "Added from EnVizion Life.",
  });
}
