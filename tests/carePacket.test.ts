import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCarePacketHtml,
  carePacketDefaultSections,
  carePacketTitle,
  type CarePacketBuildInput,
} from "../src/carePacketHelpers.ts";

function baseInput(): CarePacketBuildInput {
  return {
    packetType: "visit",
    generatedAt: "2026-09-22T00:30:00.000Z",
    careRecipient: {
      displayName: "Loved & One",
      relationship: "Parent",
      emergencyContactName: "Jane Doe",
      emergencyContactPhone: "+1 555 0100",
    },
    appointment: {
      title: "Cardiology review",
      date: "2026-09-25",
      time: "09:30",
      location: "Clinic A",
      notes: "Bring discharge papers",
    },
    questions: ["Can we review swelling?"],
    medications: [
      {
        id: "med-1",
        name: "Medication A",
        instructions: "Take as directed",
        time: "Morning",
      },
    ],
    medicationRecords: [
      {
        id: "record-1",
        medication: {
          id: "med-1",
          name: "Medication A",
          instructions: "Take as directed",
          time: "Morning",
        },
        recordedAt: "2026-09-21T08:00:00.000Z",
      },
    ],
    entries: [
      {
        id: "entry-1",
        kind: "Vitals",
        values: {
          systolic: "120",
          diastolic: "80",
          notes: "Resting",
        },
        recordedAt: "2026-09-21T10:00:00.000Z",
      },
    ],
    reminders: [
      {
        id: "rem-1",
        careRecipientId: "care-1",
        createdBy: "user-1",
        title: "Bring insurance card",
        note: "",
        reminderType: "appointment",
        scheduledFor: "2026-09-24T15:00:00.000Z",
        timezone: "America/New_York",
        recurrence: "none",
        notifyScope: "creator",
        completedAt: null,
        dismissedAt: null,
        snoozedUntil: null,
        createdAt: "2026-09-20T10:00:00.000Z",
        updatedAt: "2026-09-20T10:00:00.000Z",
      },
    ],
    transitionSteps: ["Review medication list", "Confirm transport"],
    transitionCompleted: [0],
    careContacts: [
      {
        id: "contact-1",
        providerName: "Dr. Rivera",
        organizationName: "Heart Center",
        specialty: "Cardiology",
        phone: "+1 555 0200",
        email: "cardiology@example.org",
        address: "100 Clinic Way",
        officeHours: "Mon-Fri 8-5",
        notes: "Ask for the nurse line",
        categoryLabel: "Specialist",
        preferredContactLabel: "Phone",
      },
    ],
    careCommunications: [
      {
        id: "communication-1",
        communicationTypeLabel: "Phone call",
        occurredAt: "2026-09-21T14:00:00.000Z",
        personSpokenTo: "Nurse James",
        organizationName: "Heart Center",
        summary: "Reviewed swelling <changes>",
        outcome: "Continue monitoring and call if symptoms worsen",
        followUpNeeded: true,
        followUpAt: "2026-09-23T13:00:00.000Z",
        notes: "Ask about the new appointment time",
        priorityLabel: "Follow-up",
        tag: "Cardiology",
        linkedContactName: "Dr. Rivera",
        linkedContactRole: "Specialist · Cardiology · Heart Center",
      },
    ],
    selectedDocuments: [
      {
        id: "doc-1",
        displayName: "Discharge summary",
        originalName: "discharge.pdf",
        categoryLabel: "Discharge",
        sizeLabel: "1.2 MB",
      },
    ],
    selectedSections: [
      "profile",
      "appointment",
      "medications",
      "observations",
      "vault_documents",
    ],
    observationLimit: 5,
    receiverNote: "Please review <carefully> & confirm.",
  };
}

test("care packet title varies by packet type", () => {
  assert.equal(carePacketTitle("visit"), "Visit Preparation Packet");
  assert.equal(carePacketTitle("handoff"), "Caregiver Handoff Packet");
  assert.equal(carePacketTitle("emergency"), "Emergency Information Packet");
});

test("emergency packet defaults include quick-reference safety context", () => {
  const sections = carePacketDefaultSections("emergency");
  assert.equal(sections.includes("emergency_profile"), true);
  assert.equal(sections.includes("medication_reconciliation"), true);
  assert.equal(sections.includes("transition_plan"), true);
  assert.equal(sections.includes("vault_documents"), true);
});

test("packet includes only explicitly selected sections", () => {
  const html = buildCarePacketHtml(baseInput());

  assert.match(html, /Care profile/);
  assert.match(html, /Appointment preparation/);
  assert.match(html, /Active medication list/);
  assert.match(html, /Recent observations/);
  assert.match(html, /Documents to bring or share separately/);

  assert.doesNotMatch(html, /Emergency contact/);
  assert.doesNotMatch(html, /Recent medication records/);
  assert.doesNotMatch(html, /Upcoming reminders/);
  assert.doesNotMatch(html, /Hospital-to-home transition checklist/);
});

test("packet includes only explicitly selected care contacts", () => {
  const input = baseInput();
  input.selectedSections = [...input.selectedSections, "care_contacts"];
  const html = buildCarePacketHtml(input);

  assert.match(html, /Care contacts &amp; providers/);
  assert.match(html, /Dr\. Rivera/);
  assert.match(html, /Preferred contact: Phone/);
});

test("packet includes only selected communication history", () => {
  const input = baseInput();
  input.selectedSections = [...input.selectedSections, "communication_log"];
  const html = buildCarePacketHtml(input);

  assert.match(html, /Provider \/ insurance communication history/);
  assert.match(html, /Nurse James/);
  assert.match(html, /Dr\. Rivera/);
  assert.match(html, /Follow-up/);
  assert.match(html, /Reviewed swelling &lt;changes&gt;/);
  assert.doesNotMatch(html, /Reviewed swelling <changes>/);
});

test("packet can render emergency and reconciliation sections", () => {
  const input = baseInput();
  input.packetType = "emergency";
  input.selectedSections = [
    "profile",
    "emergency_contact",
    "emergency_profile",
    "medications",
    "medication_reconciliation",
    "transition_plan",
  ];
  input.emergencyProfile = {
    localEmergencyNumber: "911",
    preferredHospital: "Central Hospital",
    allergies: "Penicillin",
    importantConditions: "CHF",
    medicalDevices: "Home oxygen",
    advanceDirectiveLocation: "Care Vault",
    emergencyNotes: "Bring medication list",
    lastReviewedAt: "2026-09-23T11:00:00.000Z",
  };
  input.medicationReconciliation = {
    medicationCount: 1,
    note: "Confirmed against discharge paperwork",
    createdAt: "2026-09-23T12:00:00.000Z",
  };
  input.transitionPlan = {
    hospitalName: "Central Hospital",
    dischargeDate: "2026-09-22",
    dischargeSummary: "Continue home recovery plan",
    primaryDiagnosis: "Heart failure",
    medicationChanges: "See reconciled list",
    followUpPlan: "Cardiology follow-up",
    equipmentPlan: "Scale",
    transportPlan: "Family transport",
    warningSigns: "Call for severe breathing difficulty",
    afterHoursContact: "Hospital nurse line",
  };
  input.transitionFollowUps = [
    {
      title: "Cardiology review",
      dueAt: "2026-09-30T10:00:00.000Z",
      provider: "Dr. Rivera",
      details: "Bring weight log",
    },
  ];

  const html = buildCarePacketHtml(input);

  assert.match(html, /Emergency Information Packet/);
  assert.match(html, /Known allergies: Penicillin/);
  assert.match(html, /Medication reconciliation/);
  assert.match(html, /Confirmed against discharge paperwork/);
  assert.match(html, /Hospital-to-home plan/);
  assert.match(html, /Cardiology review/);
});

test("packet escapes user-entered HTML-sensitive content", () => {
  const html = buildCarePacketHtml(baseInput());

  assert.match(html, /Loved &amp; One/);
  assert.match(html, /Please review &lt;carefully&gt; &amp; confirm/);
  assert.doesNotMatch(html, /<carefully>/);
});

test("vault documents are listed as a checklist and never claimed embedded", () => {
  const html = buildCarePacketHtml(baseInput());

  assert.match(html, /Discharge summary/);
  assert.match(html, /not embedded in this PDF/i);
});

test("observation labels are caregiver-friendly", () => {
  const html = buildCarePacketHtml(baseInput());

  assert.match(html, /Systolic blood pressure \(mmHg\): 120/);
  assert.match(html, /Diastolic blood pressure \(mmHg\): 80/);
  assert.match(html, /Notes: Resting/);
});
