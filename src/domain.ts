export type TrackerKind =
  | "Vitals"
  | "Blood sugar"
  | "CHF symptoms"
  | "Behavior & memory"
  | "Red-flag symptoms";
export type Entry = {
  id: string;
  kind: TrackerKind;
  values: Record<string, string>;
  recordedAt: string;
};
export type Appointment = {
  title: string;
  date: string;
  time: string;
  location: string;
  notes: string;
};
export function validateAppointment(appointment: Appointment): string | null {
  if (!appointment.title.trim()) return "Please add a visit title.";
  if (appointment.date) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appointment.date);
    if (!parts) return "Use YYYY-MM-DD for the appointment date.";
    const [, year, month, day] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    )
      return "Enter a valid calendar date.";
  }
  if (appointment.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointment.time))
    return "Use a 24-hour time, such as 14:30.";
  return null;
}
export function appointmentLines(
  appointment: Appointment,
  questions: string[],
): string[] {
  return [
    `Visit: ${appointment.title}`,
    `Date: ${appointment.date || "To be confirmed"}`,
    `Time: ${appointment.time || "To be confirmed"}`,
    `Location or joining details: ${appointment.location || "To be confirmed"}`,
    ...(appointment.notes.trim()
      ? [`Preparation notes: ${appointment.notes}`]
      : []),
    ...questions.map((question, index) => `Question ${index + 1}: ${question}`),
  ];
}
export type Field = {
  key: string;
  label: string;
  numeric?: boolean;
  required?: boolean;
};
export const trackerFields: Record<TrackerKind, Field[]> = {
  Vitals: [
    {
      key: "systolic",
      label: "Systolic blood pressure (mmHg)",
      numeric: true,
      required: true,
    },
    {
      key: "diastolic",
      label: "Diastolic blood pressure (mmHg)",
      numeric: true,
      required: true,
    },
    { key: "pulse", label: "Pulse (bpm)", numeric: true },
    { key: "temperature", label: "Temperature (°F)", numeric: true },
  ],
  "Blood sugar": [
    {
      key: "glucose",
      label: "Blood glucose (mg/dL)",
      numeric: true,
      required: true,
    },
    {
      key: "timing",
      label: "Timing, such as before breakfast",
      required: true,
    },
  ],
  "CHF symptoms": [
    { key: "weight", label: "Weight (lb)", numeric: true },
    {
      key: "breathing",
      label: "Breathing compared with usual",
      required: true,
    },
    { key: "swelling", label: "Swelling or other changes" },
  ],
  "Behavior & memory": [
    {
      key: "observed",
      label: "What changed from their usual behavior?",
      required: true,
    },
    { key: "onset", label: "When did you first notice it?", required: true },
    { key: "sleep", label: "Sleep, alertness, or other observations" },
  ],
  "Red-flag symptoms": [
    { key: "observed", label: "What did you notice?", required: true },
    { key: "onset", label: "When did it begin?", required: true },
    { key: "action", label: "Who did you contact? What happened next?" },
  ],
};
export function validateEntry(
  kind: TrackerKind,
  values: Record<string, string>,
): string | null {
  for (const field of trackerFields[kind]) {
    const value = (values[field.key] || "").trim();
    if (field.required && !value) return `Please complete: ${field.label}.`;
    if (
      value &&
      field.numeric &&
      (!/^\d+(\.\d+)?$/.test(value) ||
        !Number.isFinite(Number(value)) ||
        Number(value) <= 0)
    )
      return `Enter a positive number for ${field.label}.`;
  }
  return null;
}
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function resourceHtml(title: string, lines: string[]) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:16px Arial;line-height:1.7;color:#302239;padding:40px}h1{color:#75418b}li{margin:16px 0}footer{font-size:12px;margin-top:40px}</style></head><body><p>ENVIZION LIFE • CAREGIVER TOOLKIT</p><h1>${escapeHtml(title)}</h1><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul><p>My notes: __________________________________________________</p><p>___________________________________________________________</p><footer>Educational draft for review. Not a diagnosis or an individualized care plan. Discuss care decisions with your healthcare team.</footer></body></html>`;
}
