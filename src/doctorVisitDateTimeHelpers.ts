/** Cross-platform calendar and time helpers for doctor visit scheduling. */
import { localDateTimeToIso } from "./reminderHelpers";

export function parseDoctorVisitDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Noon avoids the majority of DST transitions, including midnight transitions.
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day ? date : null;
}

export function formatDoctorVisitDate(year: number, monthIndex: number, day: number): string {
  return [String(year).padStart(4, "0"), String(monthIndex + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

export function doctorVisitCalendarDays(month: Date): Array<number | null> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leading = new Date(year, monthIndex, 1, 12).getDay();
  const lastDay = new Date(year, monthIndex + 1, 0, 12).getDate();
  const length = Math.ceil((leading + lastDay) / 7) * 7;
  return Array.from({ length }, (_, index) => {
    const day = index - leading + 1;
    return day > 0 && day <= lastDay ? day : null;
  });
}

export function moveDoctorVisitMonth(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1, 12);
}

export function parseDoctorVisitTime(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export function formatDoctorVisitTime(hour: number, minute: number): string {
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new RangeError("Choose a valid hour (00–23) and minute (00–59).");
  }
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}

export function doctorVisitTimeLabel(value: string): string {
  const time = parseDoctorVisitTime(value);
  if (!time) return "Choose time";
  const twelveHour = time.hour % 12 || 12;
  return twelveHour + ":" + String(time.minute).padStart(2, "0") + (time.hour < 12 ? " AM" : " PM");
}

export function doctorVisitDateLabel(value: string): string {
  const date = parseDoctorVisitDate(value);
  if (!date) return "Choose date";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function doctorVisitSchedulingError(date: string, time: string): string | null {
  if (!parseDoctorVisitDate(date)) return "Please select a valid visit date from the calendar.";
  if (!parseDoctorVisitTime(time)) return "Please select a valid visit time (minutes must be 00–59).";
  if (!localDateTimeToIso(date, time)) return "This time is unavailable on that date in your local time zone. Choose another time.";
  return null;
}
