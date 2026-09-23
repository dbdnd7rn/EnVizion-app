import { escapeHtml, trackerFields } from "./domain.ts";
import type { Appointment, Entry } from "./domain";
import type { Medication, MedicationRecord } from "./medications.ts";
import type { CareReminder } from "./reminderHelpers.ts";

export const carePacketSections = [
  "profile",
  "emergency_contact",
  "emergency_profile",
  "appointment",
  "medications",
  "medication_reconciliation",
  "medication_history",
  "daily_care_plan",
  "observations",
  "reminders",
  "transition",
  "transition_plan",
  "family_updates",
  "vault_documents",
  "care_contacts",
  "communication_log",
] as const;

export type CarePacketSection = (typeof carePacketSections)[number];
export type CarePacketType = "visit" | "handoff" | "emergency";

export const carePacketSectionLabels: Record<CarePacketSection, string> = {
  profile: "Care profile basics",
  emergency_contact: "Primary emergency contact",
  emergency_profile: "Emergency information",
  appointment: "Appointment & questions",
  medications: "Active medication list",
  medication_reconciliation: "Medication reconciliation",
  medication_history: "Recent medication records",
  daily_care_plan: "Daily care plan & routines",
  observations: "Recent observations",
  reminders: "Upcoming reminders",
  transition: "Transition checklist",
  transition_plan: "Hospital-to-home plan",
  family_updates: "Recent family care updates",
  vault_documents: "Selected Care Vault documents",
  care_contacts: "Selected care contacts & providers",
  communication_log: "Selected provider / insurance communications",
};

export function carePacketDefaultSections(
  packetType: CarePacketType,
): CarePacketSection[] {
  if (packetType === "emergency") {
    return [
      "profile",
      "emergency_contact",
      "emergency_profile",
      "medications",
      "medication_reconciliation",
      "transition_plan",
      "care_contacts",
      "vault_documents",
    ];
  }

  if (packetType === "handoff") {
    return [
      "profile",
      "emergency_contact",
      "medications",
      "medication_reconciliation",
      "daily_care_plan",
      "reminders",
      "transition_plan",
      "family_updates",
    ];
  }

  return [
    "profile",
    "appointment",
    "medications",
    "medication_reconciliation",
    "observations",
    "care_contacts",
  ];
}

export type PacketDocumentReference = {
  id: string;
  displayName: string;
  originalName: string;
  categoryLabel: string;
  sizeLabel: string;
  sourceName?: string;
  documentDate?: string;
  isKeyDocument?: boolean;
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

export type PacketCareCommunication = {
  id: string;
  communicationTypeLabel: string;
  occurredAt: string;
  personSpokenTo: string;
  organizationName: string;
  summary: string;
  outcome: string;
  followUpNeeded: boolean;
  followUpAt: string | null;
  notes: string;
  priorityLabel: string;
  tag: string;
  linkedContactName: string;
  linkedContactRole: string;
};

export type PacketManagedMedication = {
  id: string;
  name: string;
  instructions: string;
  time: string;
  dose?: string;
  route?: string;
  purpose?: string;
  prescriber?: string;
  pharmacy?: string;
  isPrn?: boolean;
};

export type PacketManagedMedicationRecord = {
  id: string;
  medicationId: string;
  status: string;
  note: string;
  recordedAt: string;
  correctedAt: string | null;
};

export type PacketMedicationReconciliation = {
  medicationCount: number;
  note: string;
  createdAt: string;
} | null;

export type PacketCarePlanItem = {
  id: string;
  title: string;
  category: string;
  details: string;
  localTime: string;
  timezone: string;
  daysOfWeek: number[];
  priority: string;
};

export type PacketEmergencyProfile = {
  localEmergencyNumber: string;
  preferredHospital: string;
  allergies: string;
  importantConditions: string;
  medicalDevices: string;
  advanceDirectiveLocation: string;
  emergencyNotes: string;
  lastReviewedAt: string | null;
} | null;

export type PacketTransitionPlan = {
  hospitalName: string;
  dischargeDate: string;
  dischargeSummary: string;
  primaryDiagnosis: string;
  medicationChanges: string;
  followUpPlan: string;
  equipmentPlan: string;
  transportPlan: string;
  warningSigns: string;
  afterHoursContact: string;
} | null;

export type PacketTransitionFollowUp = {
  title: string;
  dueAt: string | null;
  provider: string;
  details: string;
};

export type PacketFamilyUpdate = {
  title: string;
  body: string;
  updateTypeLabel: string;
  priorityLabel: string;
  createdAt: string;
  authorName: string;
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
  medications: Medication[] | PacketManagedMedication[];
  medicationRecords: MedicationRecord[] | PacketManagedMedicationRecord[];
  medicationReconciliation?: PacketMedicationReconciliation;
  carePlanItems?: PacketCarePlanItem[];
  emergencyProfile?: PacketEmergencyProfile;
  entries: Entry[];
  reminders: CareReminder[];
  transitionSteps: string[];
  transitionCompleted: number[];
  transitionPlan?: PacketTransitionPlan;
  transitionFollowUps?: PacketTransitionFollowUp[];
  familyUpdates?: PacketFamilyUpdate[];
  selectedDocuments: PacketDocumentReference[];
  careContacts: PacketCareContact[];
  careCommunications: PacketCareCommunication[];
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

function medicationLine(medication: Medication | PacketManagedMedication) {
  const managed = medication as PacketManagedMedication;
  return [
    medication.name,
    managed.dose || "",
    managed.route || "",
    medication.instructions || "No directions recorded",
    medication.time ? `Scheduled: ${medication.time}` : "",
    managed.isPrn ? "PRN / as-needed" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function medicationRecordLine(
  record: MedicationRecord | PacketManagedMedicationRecord,
  medications: Array<Medication | PacketManagedMedication>,
) {
  if ("medication" in record) {
    return `${record.medication.name} · Recorded ${formattedDate(
      record.recordedAt,
    )}${
      record.correctedAt
        ? ` · Corrected ${formattedDate(record.correctedAt)}`
        : ""
    }`;
  }

  const medication = medications.find(
    (item) => item.id === record.medicationId,
  );

  return [
    medication?.name || "Medication",
    record.status.replaceAll("_", " "),
    formattedDate(record.recordedAt),
    record.note ? `Note: ${record.note}` : "",
    record.correctedAt
      ? `Corrected ${formattedDate(record.correctedAt)}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function carePacketTitle(packetType: CarePacketType) {
  if (packetType === "emergency") return "Emergency Information Packet";
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
          paragraph(
            `Relationship: ${input.careRecipient.relationship || "Not recorded"}`,
          ),
        ].join(""),
      ),
    );
  }

  if (selected.has("emergency_contact")) {
    blocks.push(
      section(
        "Primary emergency contact",
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

  if (selected.has("emergency_profile")) {
    const profile = input.emergencyProfile;
    blocks.push(
      section(
        "Emergency information",
        profile
          ? `<ul>${[
              `Local emergency number: ${profile.localEmergencyNumber || "Not recorded"}`,
              `Preferred hospital / facility: ${profile.preferredHospital || "Not recorded"}`,
              `Known allergies: ${profile.allergies || "Not recorded"}`,
              `Important conditions: ${profile.importantConditions || "Not recorded"}`,
              `Medical devices / equipment: ${profile.medicalDevices || "Not recorded"}`,
              `Advance directive / document location: ${profile.advanceDirectiveLocation || "Not recorded"}`,
              `Emergency notes: ${profile.emergencyNotes || "Not recorded"}`,
              profile.lastReviewedAt
                ? `Last reviewed: ${formattedDate(profile.lastReviewedAt)}`
                : "Last reviewed: Not recorded",
            ]
              .map(item)
              .join("")}</ul>`
          : paragraph("No emergency profile has been recorded."),
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
      ? `<h3>Questions to bring</h3><ol>${input.questions
          .map(item)
          .join("")}</ol>`
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
      ? `<ul>${input.medications.map((medication) =>
          item(medicationLine(medication)),
        ).join("")}</ul>`
      : paragraph("No active medications recorded.");

    blocks.push(section("Active medication list", body));
  }

  if (selected.has("medication_reconciliation")) {
    const reconciliation = input.medicationReconciliation ?? null;
    blocks.push(
      section(
        "Medication reconciliation",
        reconciliation
          ? [
              paragraph(
                `Reconciled ${formattedDate(reconciliation.createdAt)} · ${reconciliation.medicationCount} active medication${reconciliation.medicationCount === 1 ? "" : "s"}`,
              ),
              ...(reconciliation.note
                ? [paragraph(`Note: ${reconciliation.note}`)]
                : []),
            ].join("")
          : paragraph("No medication reconciliation snapshot is on file."),
      ),
    );
  }

  if (selected.has("medication_history")) {
    const recent = input.medicationRecords.slice(0, 10);
    const meds = input.medications as Array<
      Medication | PacketManagedMedication
    >;
    const body = recent.length
      ? `<ul>${recent
          .map((record) => item(medicationRecordLine(record, meds)))
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

  if (selected.has("daily_care_plan")) {
    const routines = input.carePlanItems ?? [];
    const body = routines.length
      ? routines
          .map((routine) => {
            const details = [
              routine.category,
              routine.localTime
                ? `${routine.localTime} · ${routine.timezone}`
                : "Any time",
              routine.priority === "important" ? "Important" : "",
              routine.details,
            ].filter(Boolean);

            return `<article class="observation"><strong>${escapeHtml(
              routine.title,
            )}</strong><ul>${details.map(item).join("")}</ul></article>`;
          })
          .join("")
      : paragraph("No active recurring care routines recorded.");

    blocks.push(section("Daily care plan & routines", body));
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
              )}${
                reminder.recurrence !== "none"
                  ? ` · ${reminder.recurrence}`
                  : ""
              }`,
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
              contact.officeHours
                ? `Office hours: ${contact.officeHours}`
                : "",
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

  if (selected.has("communication_log")) {
    const body = input.careCommunications.length
      ? input.careCommunications
          .map((communication) => {
            const details = [
              `${communication.communicationTypeLabel} · ${formattedDate(
                communication.occurredAt,
              )}`,
              communication.linkedContactName
                ? `Linked provider: ${communication.linkedContactName}${
                    communication.linkedContactRole
                      ? ` · ${communication.linkedContactRole}`
                      : ""
                  }`
                : "",
              communication.personSpokenTo
                ? `Person spoken to: ${communication.personSpokenTo}`
                : "",
              communication.organizationName
                ? `Organization: ${communication.organizationName}`
                : "",
              `Summary: ${communication.summary}`,
              communication.outcome
                ? `Outcome: ${communication.outcome}`
                : "",
              `Priority: ${communication.priorityLabel}${
                communication.tag ? ` · ${communication.tag}` : ""
              }`,
              communication.followUpNeeded
                ? `Follow-up: ${
                    communication.followUpAt
                      ? formattedDate(communication.followUpAt)
                      : "Needed; date not recorded"
                  }`
                : "",
              communication.notes
                ? `Caregiver notes: ${communication.notes}`
                : "",
            ].filter(Boolean);

            return `<article class="observation"><ul>${details
              .map(item)
              .join("")}</ul></article>`;
          })
          .join("")
      : paragraph("No communication entries selected.");

    blocks.push(section("Provider / insurance communication history", body));
  }

  if (selected.has("transition")) {
    const completed = new Set(input.transitionCompleted);
    const body = `<ul>${input.transitionSteps
      .map((step, index) =>
        item(
          `${completed.has(index) ? "Prepared" : "Not yet marked prepared"} · ${step}`,
        ),
      )
      .join("")}</ul>`;

    blocks.push(section("Hospital-to-home transition checklist", body));
  }

  if (selected.has("transition_plan")) {
    const plan = input.transitionPlan ?? null;
    const followUps = input.transitionFollowUps ?? [];
    const body = plan
      ? [
          paragraph(
            `Hospital / facility: ${plan.hospitalName || "Not recorded"}`,
          ),
          paragraph(
            `Discharge date: ${plan.dischargeDate || "Not recorded"}`,
          ),
          ...(plan.primaryDiagnosis
            ? [paragraph(`Reason for stay: ${plan.primaryDiagnosis}`)]
            : []),
          ...(plan.dischargeSummary
            ? [paragraph(`Key instructions: ${plan.dischargeSummary}`)]
            : []),
          ...(plan.medicationChanges
            ? [paragraph(`Medication changes: ${plan.medicationChanges}`)]
            : []),
          ...(plan.equipmentPlan
            ? [paragraph(`Equipment / supplies: ${plan.equipmentPlan}`)]
            : []),
          ...(plan.transportPlan
            ? [paragraph(`Transport: ${plan.transportPlan}`)]
            : []),
          ...(plan.warningSigns
            ? [paragraph(`Discharge-team warning signs: ${plan.warningSigns}`)]
            : []),
          ...(plan.afterHoursContact
            ? [paragraph(`After-hours instructions: ${plan.afterHoursContact}`)]
            : []),
          followUps.length
            ? `<h3>Open transition follow-ups</h3><ul>${followUps
                .map((followUp) =>
                  item(
                    [
                      followUp.title,
                      followUp.provider,
                      followUp.dueAt
                        ? formattedDate(followUp.dueAt)
                        : "",
                      followUp.details,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  ),
                )
                .join("")}</ul>`
            : paragraph("No open transition follow-ups."),
        ].join("")
      : paragraph("No active hospital-to-home transition plan.");

    blocks.push(section("Hospital-to-home plan", body));
  }

  if (selected.has("family_updates")) {
    const updates = (input.familyUpdates ?? []).slice(0, 10);
    const body = updates.length
      ? updates
          .map(
            (update) =>
              `<article class="observation"><strong>${escapeHtml(
                update.title,
              )}</strong><ul>${[
                `${update.updateTypeLabel} · ${update.priorityLabel}`,
                `${update.authorName} · ${formattedDate(update.createdAt)}`,
                update.body,
              ]
                .map(item)
                .join("")}</ul></article>`,
          )
          .join("")
      : paragraph("No recent family care updates.");

    blocks.push(section("Recent family care updates", body));
  }

  if (selected.has("vault_documents")) {
    const body = input.selectedDocuments.length
      ? `<ul>${input.selectedDocuments
          .map((document) =>
            item(
              [
                document.displayName,
                document.categoryLabel,
                document.sizeLabel,
                document.isKeyDocument ? "Key document" : "",
                document.sourceName ? `Source: ${document.sourceName}` : "",
                document.documentDate
                  ? `Document date: ${document.documentDate}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
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
  Caregiver-entered EnVizion Life information prepared for a care conversation. This packet is not a diagnosis, verified clinical medical record, emergency monitoring service, or individualized care plan. Review important details with the healthcare team. For a possible medical emergency, contact the appropriate emergency service directly.
</footer>
</body>
</html>`;
}
