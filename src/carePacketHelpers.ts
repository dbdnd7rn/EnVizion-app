import { escapeHtml, trackerFields } from "./domain.ts";
import type { Appointment, Entry } from "./domain";
import type { Medication, MedicationRecord } from "./medications.ts";
import type { CareReminder } from "./reminderHelpers.ts";

export const carePacketSections = [
  "profile",
  "emergency_contact",
  "appointment",
  "medications",
  "medication_history",
  "observations",
  "reminders",
  "transition",
  "vault_documents",
  "care_contacts",
] as const;

export type CarePacketSection = (typeof carePacketSections)[number];
export type CarePacketType = "visit" | "handoff";

export const carePacketSectionLabels: Record<CarePacketSection, string> = {
  profile: "Care profile basics",
  emergency_contact: "Emergency contact",
  appointment: "Appointment & questions",
  medications: "Active medication list",
  medication_history: "Recent medication records",
  observations: "Recent observations",
  reminders: "Upcoming reminders",
  transition: "Transition checklist",
  vault_documents: "Selected Care Vault documents",
  care_contacts: "Selected care contacts & providers",
};

export type PacketDocumentReference = {
  id: string;
  displayName: string;
  originalName: string;
  categoryLabel: string;
  sizeLabel: string;
};

export type PacketCareContact = {
  id: string;
  providerName: string;
  organizationName: string;
  specialty: string;
  phone: string;
  email: string;
  address: string;
  officeHours: string;
  notes: string;
  categoryLabel: string;
  preferredContactLabel: string;
};

export type CarePacketBuildInput = {
  packetType: CarePacketType;
  generatedAt: string;
  careRecipient: {
    displayName: string;
    relationship: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
  appointment: Appointment;
  questions: string[];
  medications: Medication[];
  medicationRecords: MedicationRecord[];
  entries: Entry[];
  reminders: CareReminder[];
  transitionSteps: string[];
  transitionCompleted: number[];
  selectedDocuments: PacketDocumentReference[];
  careContacts: PacketCareContact[];
  selectedSections: CarePacketSection[];
  observationLimit: number;
  receiverNote: string;
};

function section(title: string, body: string) {
  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function item(value: string) {
  return `<li>${escapeHtml(value)}</li>`;
}

function paragraph(value: string, className = "") {
  return `<p${className ? ` class="${className}"` : ""}>${escapeHtml(value)}</p>`;
}

function formattedDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString()
    : "Date unavailable";
}

function observationLines(entry: Entry) {
  const fields = trackerFields[entry.kind]
    .filter((field) => String(entry.values[field.key] ?? "").trim())
    .map(
      (field) =>
        `${field.label}: ${String(entry.values[field.key] ?? "").trim()}`,
    );

  const notes = String(entry.values.notes ?? "").trim();

  return [
    `${entry.kind} · ${formattedDate(entry.recordedAt)}`,
    ...fields,
    ...(notes ? [`Notes: ${notes}`] : []),
  ];
}

function activeReminder(reminder: CareReminder) {
  return !reminder.completedAt && !reminder.dismissedAt;
}

export function carePacketTitle(packetType: CarePacketType) {
  return packetType === "visit"
    ? "Visit Preparation Packet"
    : "Caregiver Handoff Packet";
}

export function buildCarePacketHtml(input: CarePacketBuildInput) {
  const selected = new Set(input.selectedSections);
  const blocks: string[] = [];

  if (selected.has("profile")) {
    blocks.push(
      section(
        "Care profile",
        [
          paragraph(`Name: ${input.careRecipient.displayName}`),
          paragraph(`Relationship: ${input.careRecipient.relationship || "Not recorded"}`),
        ].join(""),
      ),
    );
  }

  if (selected.has("emergency_contact")) {
    blocks.push(
      section(
        "Emergency contact",
        [
          paragraph(
            `Name: ${input.careRecipient.emergencyContactName || "Not recorded"}`,
          ),
          paragraph(
            `Phone: ${input.careRecipient.emergencyContactPhone || "Not recorded"}`,
          ),
        ].join(""),
      ),
    );
  }

  if (selected.has("appointment")) {
    const appointmentLines = [
      `Visit: ${input.appointment.title || "Next appointment"}`,
      `Date: ${input.appointment.date || "To be confirmed"}`,
      `Time: ${input.appointment.time || "To be confirmed"}`,
      `Location / joining details: ${input.appointment.location || "To be confirmed"}`,
      ...(input.appointment.notes.trim()
        ? [`Preparation notes: ${input.appointment.notes}`]
        : []),
    ];

    const questions = input.questions.length
      ? `<h3>Questions to bring</h3><ol>${input.questions.map(item).join("")}</ol>`
      : paragraph("No appointment questions recorded.");

    blocks.push(
      section(
        "Appointment preparation",
        `<ul>${appointmentLines.map(item).join("")}</ul>${questions}`,
      ),
    );
  }

  if (selected.has("medications")) {
    const body = input.medications.length
      ? `<ul>${input.medications
          .map((medication) =>
            item(
              [
                medication.name,
                medication.instructions || "No instructions recorded",
                medication.time ? `Scheduled: ${medication.time}` : "",
              ]
                .filter(Boolean)
                .join(" · "),
            ),
          )
          .join("")}</ul>`
      : paragraph("No active medications recorded.");

    blocks.push(section("Active medication list", body));
  }

  if (selected.has("medication_history")) {
    const recent = input.medicationRecords.slice(0, 10);
    const body = recent.length
      ? `<ul>${recent
          .map((record) =>
            item(
              `${record.medication.name} · Recorded ${formattedDate(record.recordedAt)}${
                record.correctedAt
                  ? ` · Corrected ${formattedDate(record.correctedAt)}`
                  : ""
              }`,
            ),
          )
          .join("")}</ul>`
      : paragraph("No medication record history available.");

    blocks.push(
      section(
        "Recent medication records",
        `${paragraph(
          "Caregiver-entered medication records. These entries do not independently verify administration.",
          "muted",
        )}${body}`,
      ),
    );
  }

  if (selected.has("observations")) {
    const observations = input.entries.slice(0, input.observationLimit);
    const body = observations.length
      ? observations
          .map(
            (entry) =>
              `<article class="observation"><strong>${escapeHtml(
                observationLines(entry)[0],
              )}</strong><ul>${observationLines(entry)
                .slice(1)
                .map(item)
                .join("")}</ul></article>`,
          )
          .join("")
      : paragraph("No observations recorded.");

    blocks.push(section("Recent observations", body));
  }

  if (selected.has("reminders")) {
    const reminders = input.reminders.filter(activeReminder).slice(0, 10);
    const body = reminders.length
      ? `<ul>${reminders
          .map((reminder) =>
            item(
              `${reminder.title} · ${formattedDate(
                reminder.snoozedUntil ?? reminder.scheduledFor,
              )}${reminder.recurrence !== "none" ? ` · ${reminder.recurrence}` : ""}`,
            ),
          )
          .join("")}</ul>`
      : paragraph("No active reminders.");

    blocks.push(section("Upcoming reminders", body));
  }

  if (selected.has("care_contacts")) {
    const body = input.careContacts.length
      ? input.careContacts
          .map((contact) => {
            const details = [
              contact.organizationName,
              contact.specialty,
              contact.phone ? `Phone: ${contact.phone}` : "",
              contact.email ? `Email: ${contact.email}` : "",
              contact.address ? `Address: ${contact.address}` : "",
              contact.officeHours ? `Office hours: ${contact.officeHours}` : "",
              `Preferred contact: ${contact.preferredContactLabel}`,
              contact.notes ? `Caregiver notes: ${contact.notes}` : "",
            ].filter(Boolean);

            return `<article class="observation"><strong>${escapeHtml(
              `${contact.providerName} · ${contact.categoryLabel}`,
            )}</strong><ul>${details.map(item).join("")}</ul></article>`;
          })
          .join("")
      : paragraph("No care contacts selected.");

    blocks.push(section("Care contacts & providers", body));
  }

  if (selected.has("transition")) {
    const completed = new Set(input.transitionCompleted);
    const body = `<ul>${input.transitionSteps
      .map((step, index) =>
        item(`${completed.has(index) ? "Prepared" : "Not yet marked prepared"} · ${step}`),
      )
      .join("")}</ul>`;

    blocks.push(section("Hospital-to-home transition checklist", body));
  }

  if (selected.has("vault_documents")) {
    const body = input.selectedDocuments.length
      ? `<ul>${input.selectedDocuments
          .map((document) =>
            item(
              `${document.displayName} · ${document.categoryLabel} · ${document.sizeLabel}`,
            ),
          )
          .join("")}</ul>${paragraph(
          "These Care Vault documents are listed as an attachment checklist only. They are not embedded in this PDF. Open or download them separately from the private Care Vault when needed.",
          "muted",
        )}`
      : paragraph("No Care Vault documents selected.");

    blocks.push(section("Documents to bring or share separately", body));
  }

  const receiverNote = input.receiverNote.trim()
    ? section("Note for the receiving person", paragraph(input.receiverNote))
    : "";

  const title = carePacketTitle(input.packetType);
  const recipientLabel = selected.has("profile")
    ? input.careRecipient.displayName
    : "Care profile name omitted";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 22mm 18mm; }
  body { font-family: Arial, sans-serif; color: #2f2434; font-size: 13px; line-height: 1.5; }
  header { border-bottom: 3px solid #75418b; padding-bottom: 14px; margin-bottom: 20px; }
  .brand { font-size: 11px; letter-spacing: 1.5px; color: #75418b; font-weight: 700; }
  h1 { font-size: 26px; margin: 8px 0 4px; color: #3f2949; }
  h2 { font-size: 17px; color: #75418b; margin: 0 0 8px; }
  h3 { font-size: 14px; color: #3f2949; margin: 12px 0 6px; }
  section { margin: 0 0 18px; break-inside: avoid; }
  ul, ol { margin: 6px 0 0 18px; padding: 0; }
  li { margin: 0 0 6px; }
  p { margin: 4px 0; }
  .meta { color: #6d6272; font-size: 11px; }
  .muted { color: #6d6272; font-size: 11px; }
  .observation { border-left: 3px solid #ded0e5; padding-left: 10px; margin-bottom: 10px; }
  footer { margin-top: 28px; border-top: 1px solid #ded5e4; padding-top: 10px; font-size: 10px; color: #6d6272; }
</style>
</head>
<body>
<header>
  <div class="brand">ENVIZION LIFE · CAREGIVER TOOLKIT</div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(recipientLabel)} · Generated ${escapeHtml(
    formattedDate(input.generatedAt),
  )}</div>
</header>
${receiverNote}
${blocks.join("")}
<footer>
  Caregiver-entered EnVizion Life information prepared for a care conversation. This packet is not a diagnosis, verified clinical medical record, emergency monitoring service, or individualized care plan. Review important details with the healthcare team.
</footer>
</body>
</html>`;
}
