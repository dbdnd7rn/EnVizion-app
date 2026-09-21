import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCarePacketHtml,
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

  assert.match(html, /Care contacts & providers/);
  assert.match(html, /Dr\. Rivera/);
  assert.match(html, /Preferred contact: Phone/);
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
