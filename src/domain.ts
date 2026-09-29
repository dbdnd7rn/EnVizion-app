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
function worksheetIconSvg(name: string) {
  const common =
    'width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#57217a" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const paths: Record<string, string> = {
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    note:
      '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h6M9 16h6"/>',
    pill:
      '<path d="M8.5 20.5 3.5 15.5a4.2 4.2 0 0 1 0-6l6-6a4.2 4.2 0 0 1 6 0l5 5a4.2 4.2 0 0 1 0 6l-6 6a4.2 4.2 0 0 1-6 0Z"/><path d="m7 7 10 10"/>',
    phone:
      '<path d="M5 3h4l2 5-2.5 1.5a15 15 0 0 0 6 6L16 13l5 2v4c0 1.1-.9 2-2 2C10.2 21 3 13.8 3 5c0-1.1.9-2 2-2Z"/>',
    heart:
      '<path d="M12 21S4 16.2 4 9.4C4 6.4 6.2 4 9.1 4c1.7 0 2.9.8 3.9 2 1-1.2 2.2-2 3.9-2C19.8 4 22 6.4 22 9.4 22 16.2 12 21 12 21Z"/>',
    people:
      '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-4 2.8-6 6-6s6 2 6 6M14 15c3.3 0 6 1.8 6 5"/>',
    chat:
      '<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 9h8M8 12h5"/>',
    info:
      '<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',
  };
  return '<svg ' + common + '>' + (paths[name] || paths.note) + '</svg>';
}

function worksheetHeroSvg(kind: "daily" | "advance") {
  if (kind === "daily") {
    return `<svg viewBox="0 0 310 250" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="clip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#b69ae1"/><stop offset="1" stop-color="#6744a7"/>
        </linearGradient>
        <linearGradient id="heart" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffb2c6"/><stop offset="1" stop-color="#f07b9b"/>
        </linearGradient>
      </defs>
      <path d="M20 205c28-54 45-80 82-104 43-28 91-34 132-11 36 20 54 58 46 104-7 38-34 51-77 52H62c-28 0-52-12-42-41Z" fill="#f2ecfb"/>
      <ellipse cx="64" cy="196" rx="24" ry="68" fill="#f7c6d5" transform="rotate(-34 64 196)"/>
      <ellipse cx="245" cy="178" rx="25" ry="68" fill="#c9b9e8" transform="rotate(28 245 178)"/>
      <ellipse cx="214" cy="189" rx="21" ry="61" fill="#ded2f2" transform="rotate(-10 214 189)"/>
      <g transform="translate(78 18) rotate(6 85 100)">
        <rect x="15" y="18" width="150" height="190" rx="18" fill="#6f4cb1" opacity=".24"/>
        <rect x="3" y="8" width="150" height="190" rx="18" fill="url(#clip)"/>
        <rect x="16" y="20" width="124" height="164" rx="12" fill="#fff"/>
        <rect x="54" y="0" width="50" height="30" rx="8" fill="#6a409c"/>
        <circle cx="79" cy="5" r="6" fill="#f4effb"/>
        <rect x="42" y="56" width="18" height="18" rx="3" fill="none" stroke="#9c80cd" stroke-width="4"/>
        <path d="m46 64 5 5 10-13" stroke="#9c80cd" stroke-width="3" fill="none"/>
        <rect x="74" y="58" width="47" height="7" rx="3.5" fill="#c7b5e7"/>
        <rect x="74" y="73" width="31" height="6" rx="3" fill="#d9cdef"/>
        <rect x="42" y="96" width="18" height="18" rx="3" fill="none" stroke="#9c80cd" stroke-width="4"/>
        <path d="m46 104 5 5 10-13" stroke="#9c80cd" stroke-width="3" fill="none"/>
        <rect x="74" y="98" width="47" height="7" rx="3.5" fill="#c7b5e7"/>
        <rect x="74" y="113" width="31" height="6" rx="3" fill="#d9cdef"/>
        <rect x="42" y="136" width="18" height="18" rx="3" fill="none" stroke="#9c80cd" stroke-width="4"/>
        <path d="m46 144 5 5 10-13" stroke="#9c80cd" stroke-width="3" fill="none"/>
        <rect x="74" y="138" width="47" height="7" rx="3.5" fill="#c7b5e7"/>
        <rect x="74" y="153" width="31" height="6" rx="3" fill="#d9cdef"/>
      </g>
      <path d="M218 174c-23-27-65-3-48 28 13 24 48 43 48 43s35-20 47-44c15-31-26-53-47-27Z" fill="url(#heart)"/>
    </svg>`;
  }

  return `<svg viewBox="0 0 360 280" width="100%" height="100%" aria-hidden="true">
    <path d="M26 229c-7-60 17-121 70-160 53-39 129-48 190-14 52 29 70 83 56 135-13 48-55 74-111 78H80c-28 0-50-12-54-39Z" fill="#f1ecfb"/>
    <ellipse cx="64" cy="204" rx="22" ry="74" fill="#f8c9d8" transform="rotate(-32 64 204)"/>
    <ellipse cx="310" cy="185" rx="22" ry="72" fill="#c9b9e8" transform="rotate(28 310 185)"/>
    <ellipse cx="288" cy="203" rx="18" ry="60" fill="#ded2f2" transform="rotate(-12 288 203)"/>
    <g transform="translate(128 30)">
      <rect x="0" y="0" width="132" height="76" rx="24" fill="#fff" opacity=".9"/>
      <path d="M42 30c-12-20-43-7-33 15 8 17 33 29 33 29s25-13 33-30c10-22-21-34-33-14Z" fill="#fa8fab"/>
      <rect x="82" y="24" width="34" height="7" rx="3.5" fill="#c9b7e7"/>
      <rect x="82" y="39" width="41" height="7" rx="3.5" fill="#c9b7e7"/>
      <rect x="82" y="54" width="27" height="7" rx="3.5" fill="#c9b7e7"/>
      <path d="m73 76 10 22 22-22" fill="#fff" opacity=".9"/>
    </g>
    <g transform="translate(42 106)">
      <circle cx="83" cy="42" r="31" fill="#f3c7b6"/>
      <path d="M47 52c-5-38 19-58 45-56 24 2 43 20 42 47-11-12-22-17-36-17-21 0-34 12-51 26Z" fill="#f5f2f8"/>
      <path d="M19 142c4-55 28-83 67-83 40 0 64 27 67 83H19Z" fill="#bda8df"/>
      <path d="M37 142c-3-39 5-60 21-78l20 22-13 56H37Z" fill="#a98dce"/>
      <circle cx="78" cy="48" r="2.4" fill="#704c55"/><circle cx="96" cy="48" r="2.4" fill="#704c55"/>
      <path d="M82 61c5 4 10 4 15 0" stroke="#c27b75" stroke-width="2.3" fill="none" stroke-linecap="round"/>
    </g>
    <g transform="translate(188 105)">
      <circle cx="83" cy="42" r="31" fill="#f2c4ae"/>
      <path d="M49 43C48 9 70-7 98 1c25 7 38 31 27 59-11-18-22-25-41-25-13 0-24 2-35 8Z" fill="#4d275f"/>
      <circle cx="112" cy="24" r="22" fill="#4d275f"/>
      <path d="M22 142c4-55 28-83 67-83 40 0 64 27 67 83H22Z" fill="#9d7ac4"/>
      <path d="M46 142c-6-35 3-60 20-77l18 22-12 55H46Z" fill="#8b66b3"/>
      <circle cx="77" cy="48" r="2.4" fill="#704c55"/><circle cx="95" cy="48" r="2.4" fill="#704c55"/>
      <path d="M81 61c5 4 10 4 15 0" stroke="#c27b75" stroke-width="2.3" fill="none" stroke-linecap="round"/>
      <path d="M48 90c-19 5-31 17-41 29" stroke="#f2c4ae" stroke-width="12" stroke-linecap="round"/>
      <path d="M7 119c-8-3-13-1-18 5" stroke="#f2c4ae" stroke-width="8" stroke-linecap="round"/>
    </g>
  </svg>`;
}

function worksheetResourceHtml(title: string): string | null {
  const isDaily = title === "Daily caregiver record";
  const isAdvance = title === "Advance care conversation starter";
  if (!isDaily && !isAdvance) return null;

  const hero = worksheetHeroSvg(isDaily ? "daily" : "advance");
  const subtitle = isDaily
    ? "Capture today’s key details to help you stay organized and informed."
    : "Use these prompts to help guide meaningful conversations about care, values, and future wishes.";

  const fields = isDaily
    ? [
        ["calendar", "Date and time", "Select date and time", "datetime-local", false],
        ["note", "Observations", "What did you notice today?", "text", true],
        ["pill", "Medication questions", "Any questions about medications?", "text", true],
        ["phone", "Who we contacted and next steps", "Who did you contact and what are the next steps?", "text", true],
        ["note", "My notes", "Add any additional notes here…", "text", true],
      ]
    : [
        ["heart", "What matters most to me?", "Share what’s most important to you…", "text", true],
        ["people", "Who would I want involved?", "List family members, friends, or others…", "text", true],
        ["chat", "What should we ask a qualified professional?", "Write any questions to ask a doctor, nurse, or other healthcare professional…", "text", true],
        ["note", "My notes", "Add any additional notes here…", "text", true],
      ];

  const fieldHtml = fields
    .map(([icon, label, placeholder, type, multiline], index) => {
      const tint = index % 2 === 0 ? "lavender" : "blush";
      const control =
        type === "datetime-local"
          ? `<input class="control single" type="datetime-local" aria-label="${escapeHtml(label as string)}"/>`
          : `<textarea class="control ${multiline ? "multi" : "single"}" aria-label="${escapeHtml(label as string)}" placeholder="${escapeHtml(placeholder as string)}"></textarea>`;
      return `<div class="field-row">
        <div class="icon-box ${tint}">${worksheetIconSvg(icon as string)}</div>
        <div class="field-main">
          <label>${escapeHtml(label as string)}</label>
          ${control}
        </div>
      </div>`;
    })
    .join("");

  const action = isDaily ? "Save record" : "Save notes";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>${escapeHtml(title)}</title>
  <style>
    :root{
      --ink:#20143f;
      --purple:#73369a;
      --purple-dark:#51206f;
      --muted:#727088;
      --line:#ddd8e7;
      --lavender:#f3edfb;
      --blush:#fff0f4;
      --paper:#fffdfd;
    }
    *{box-sizing:border-box}
    html,body{margin:0;background:#fffdfd;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif}
    body{padding:28px 18px 48px}
    .sheet{max-width:860px;margin:0 auto}
    .brand{font-size:15px;letter-spacing:.02em;color:#3d3551;margin:2px 0 24px}
    .hero{position:relative;min-height:245px;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(220px,.8fr);align-items:center;gap:10px;margin-bottom:12px;overflow:hidden}
    .hero-copy{position:relative;z-index:2;padding:10px 0 18px}
    h1{font-size:46px;line-height:1.03;letter-spacing:-1.4px;margin:0 0 14px;color:#35105c;max-width:590px}
    .subtitle{font-size:20px;line-height:1.45;color:#6f6b83;margin:0;max-width:560px}
    .hero-art{width:100%;height:240px;align-self:end}
    .form-card{background:#fff;border:1px solid #f1edf4;border-radius:28px;padding:24px 26px 18px;box-shadow:0 16px 44px rgba(61,34,83,.07)}
    .field-row{display:grid;grid-template-columns:64px minmax(0,1fr);gap:16px;align-items:start;padding:8px 0 16px}
    .field-row+.field-row{border-top:1px solid #f3eff5;padding-top:20px}
    .icon-box{width:56px;height:56px;border-radius:19px;display:flex;align-items:center;justify-content:center}
    .icon-box.lavender{background:#f1ebfb}
    .icon-box.blush{background:#fff0f4}
    .field-main label{display:block;font-size:20px;line-height:1.25;font-weight:700;color:#3d1262;margin:5px 0 10px}
    .control{width:100%;border:1.4px solid #d9d4e2;border-radius:15px;background:#fff;color:#2e2740;font:inherit;outline:none;padding:15px 17px;box-shadow:inset 0 1px 0 rgba(80,48,100,.02)}
    .control:focus{border-color:#9f70bc;box-shadow:0 0 0 3px rgba(137,75,169,.11)}
    .control::placeholder{color:#9995aa}
    .control.single{min-height:56px}
    textarea.control.multi{min-height:108px;resize:vertical;line-height:1.45}
    .save{width:100%;border:0;border-radius:28px;min-height:60px;margin:8px 0 16px;background:linear-gradient(90deg,#7b35a3,#944bb1);color:white;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:12px;cursor:pointer;box-shadow:0 10px 24px rgba(116,54,154,.18)}
    .save .arrow{position:absolute;right:58px;font-size:30px;font-weight:300}
    .save:hover{filter:brightness(.98)}
    .disclaimer{display:grid;grid-template-columns:38px 1fr;gap:12px;align-items:center;background:#f6f1fa;border-radius:18px;padding:14px 16px;color:#5f5970;font-size:14px;line-height:1.4}
    .disclaimer .info{width:32px;height:32px;border:2px solid #57217a;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#57217a;font-family:Georgia,serif}
    @media(max-width:640px){
      body{padding:22px 14px 38px}
      .brand{font-size:13px;margin-bottom:16px}
      .hero{grid-template-columns:minmax(0,1.25fr) minmax(126px,.75fr);min-height:205px;margin-bottom:4px}
      h1{font-size:36px;line-height:1.04;letter-spacing:-1px;margin-bottom:10px}
      .subtitle{font-size:16px;line-height:1.42}
      .hero-art{height:180px}
      .form-card{padding:18px 16px 14px;border-radius:24px}
      .field-row{grid-template-columns:50px minmax(0,1fr);gap:11px;padding-bottom:14px}
      .field-row+.field-row{padding-top:16px}
      .icon-box{width:46px;height:46px;border-radius:16px}
      .icon-box svg{width:23px;height:23px}
      .field-main label{font-size:16px;margin-top:3px}
      .control{padding:13px 14px;border-radius:14px;font-size:15px}
      textarea.control.multi{min-height:92px}
      .save{min-height:56px;font-size:17px}
      .save .arrow{right:34px}
      .disclaimer{font-size:12px}
    }
    @media(max-width:430px){
      .hero{grid-template-columns:minmax(0,1.35fr) minmax(112px,.65fr);min-height:190px}
      h1{font-size:31px}
      .subtitle{font-size:14px}
      .hero-art{height:160px}
      .field-main label{font-size:15px}
      .control{font-size:14px}
    }
    @media print{
      body{padding:12mm;background:#fff}
      .sheet{max-width:none}
      .save{print-color-adjust:exact;-webkit-print-color-adjust:exact}
      .form-card{box-shadow:none}
      textarea{resize:none}
    }
  </style>
</head>
<body>
  <main class="sheet">
    <div class="brand">ENVIZION LIFE • CAREGIVER TOOLKIT</div>
    <section class="hero">
      <div class="hero-copy">
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <div class="hero-art">${hero}</div>
    </section>

    <section class="form-card">
      ${fieldHtml}
      <button class="save" type="button" onclick="window.print()">
        ${escapeHtml(action)}
        <span class="arrow">→</span>
      </button>
      <div class="disclaimer">
        <div class="info">i</div>
        <div>Educational draft for review. Not a diagnosis or an individualized care plan. Discuss care decisions with your healthcare team.</div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

export function resourceHtml(title: string, lines: string[]) {
  const worksheet = worksheetResourceHtml(title);
  if (worksheet) return worksheet;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:16px Arial;line-height:1.7;color:#302239;padding:40px}h1{color:#75418b}li{margin:16px 0}footer{font-size:12px;margin-top:40px}</style></head><body><p>ENVIZION LIFE • CAREGIVER TOOLKIT</p><h1>${escapeHtml(title)}</h1><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul><p>My notes: __________________________________________________</p><p>___________________________________________________________</p><footer>Educational draft for review. Not a diagnosis or an individualized care plan. Discuss care decisions with your healthcare team.</footer></body></html>`;
}
