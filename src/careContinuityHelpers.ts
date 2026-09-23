import type {
  CaregiverShiftSession,
  CaregiverShiftSessionNote,
} from "./onShiftCaregiver";
import type {
  CareShiftHandoff,
  CareShiftHandoffAcknowledgement,
} from "./shiftBoard";
import type { CareShiftAttendance } from "./shiftAttendance";

export type CareContinuityEventKind =
  | "session_started"
  | "session_ended"
  | "shift_note"
  | "handoff_created"
  | "handoff_acknowledged"
  | "attendance_checkin"
  | "attendance_checkout";

export type CareContinuityEvent = {
  id: string;
  kind: CareContinuityEventKind;
  at: string;
  actorUserId: string | null;
  secondaryUserId: string | null;
  title: string;
  detail: string;
  sourceId: string;
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function continuityKindLabel(kind: CareContinuityEventKind) {
  if (kind === "session_started") return "On-shift start";
  if (kind === "session_ended") return "On-shift end";
  if (kind === "shift_note") return "Shift note";
  if (kind === "handoff_created") return "Handoff";
  if (kind === "handoff_acknowledged") return "Takeover";
  if (kind === "attendance_checkin") return "Check-in";
  return "Check-out";
}

export function buildCareContinuityTimeline(input: {
  sessions: CaregiverShiftSession[];
  notes: CaregiverShiftSessionNote[];
  handoffs: CareShiftHandoff[];
  acknowledgements: CareShiftHandoffAcknowledgement[];
  attendance: CareShiftAttendance[];
}) {
  const events: CareContinuityEvent[] = [];

  for (const session of input.sessions) {
    events.push({
      id: \`session-start:\${session.id}\`,
      kind: "session_started",
      at: session.startedAt,
      actorUserId: session.caregiverId,
      secondaryUserId: null,
      title: "On-shift session started",
      detail: "Caregiver takeover was acknowledged and on-shift mode began.",
      sourceId: session.id,
    });

    if (session.endedAt) {
      events.push({
        id: \`session-end:\${session.id}\`,
        kind: "session_ended",
        at: session.endedAt,
        actorUserId: session.caregiverId,
        secondaryUserId: null,
        title: "On-shift session ended",
        detail:
          clean(session.endNote) ||
          "The on-shift session closed and continuity moved to the next handoff.",
        sourceId: session.id,
      });
    }
  }

  for (const note of input.notes) {
    events.push({
      id: \`note:\${note.id}\`,
      kind: "shift_note",
      at: note.createdAt,
      actorUserId: note.createdBy,
      secondaryUserId: null,
      title: "Shift note added",
      detail: note.body,
      sourceId: note.id,
    });
  }

  for (const handoff of input.handoffs) {
    events.push({
      id: \`handoff:\${handoff.id}\`,
      kind: "handoff_created",
      at: handoff.createdAt,
      actorUserId: handoff.createdBy,
      secondaryUserId: handoff.handoffTo,
      title: handoff.shiftLabel || "Caregiver handoff created",
      detail:
        clean(handoff.note) ||
        "A caregiver handoff briefing was created for continuity.",
      sourceId: handoff.id,
    });
  }

  for (const acknowledgement of input.acknowledgements) {
    events.push({
      id: \`handoff-ack:\${acknowledgement.id}\`,
      kind: "handoff_acknowledged",
      at: acknowledgement.acceptedAt,
      actorUserId: acknowledgement.acceptedBy,
      secondaryUserId: null,
      title: "Caregiver handoff acknowledged",
      detail:
        clean(acknowledgement.note) ||
        "The incoming caregiver acknowledged the handoff.",
      sourceId: acknowledgement.handoffId,
    });
  }

  for (const item of input.attendance) {
    events.push({
      id: \`attendance-in:\${item.id}\`,
      kind: "attendance_checkin",
      at: item.checkedInAt,
      actorUserId: item.caregiverId,
      secondaryUserId: null,
      title: "Scheduled shift check-in",
      detail: [
        item.lateMinutes > 0
          ? \`\${item.lateMinutes} min after scheduled start\`
          : "On time",
        clean(item.checkInNote),
      ]
        .filter(Boolean)
        .join(" · "),
      sourceId: item.id,
    });

    if (item.checkedOutAt) {
      events.push({
        id: \`attendance-out:\${item.id}\`,
        kind: "attendance_checkout",
        at: item.checkedOutAt,
        actorUserId: item.caregiverId,
        secondaryUserId: null,
        title: "Scheduled shift check-out",
        detail:
          clean(item.checkOutNote) ||
          "Scheduled caregiver attendance was completed.",
        sourceId: item.id,
      });
    }
  }

  return events
    .filter((event) => Number.isFinite(new Date(event.at).getTime()))
    .sort(
      (a, b) =>
        new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
}

export function continuityEventCounts(events: CareContinuityEvent[]) {
  return {
    total: events.length,
    handoffs: events.filter(
      (event) =>
        event.kind === "handoff_created" ||
        event.kind === "handoff_acknowledged",
    ).length,
    shiftChanges: events.filter(
      (event) =>
        event.kind === "session_started" ||
        event.kind === "session_ended" ||
        event.kind === "attendance_checkin" ||
        event.kind === "attendance_checkout",
    ).length,
    notes: events.filter((event) => event.kind === "shift_note").length,
  };
}
