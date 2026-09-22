import type { CareCommunication } from "./careCommunications";
import type { CoordinationConflict } from "./careCoordinationConflicts";
import type { MedicationRecord } from "./medications";

export type HandoffMedicationSnapshot = {
  id: string;
  medicationName: string;
  instructions: string;
  recordedAt: string;
  correctedAt: string | null;
};

export type HandoffCommunicationSnapshot = {
  id: string;
  summary: string;
  occurredAt: string;
  personSpokenTo: string;
  organizationName: string;
  outcome: string;
  notes: string;
  followUpNeeded: boolean;
  followUpAt: string | null;
  priority: string;
};

export type HandoffCoordinationSnapshot = {
  id: string;
  title: string;
  detail: string;
  startsAt: string;
  priority: string;
};

export type HandoffAppointmentSnapshot = {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  notes: string;
};

export type HandoffFollowUpSnapshot = {
  id: string;
  summary: string;
  followUpAt: string;
  personSpokenTo: string;
  organizationName: string;
  priority: string;
};

export function handoffWindowStart(
  handoffs: Array<{ createdAt: string }>,
  now = new Date(),
) {
  const previous = handoffs
    .map((handoff) => new Date(handoff.createdAt))
    .filter((date) => Number.isFinite(date.getTime()) && date <= now)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (previous) return previous.toISOString();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export function handoffMedicationActivity(
  records: MedicationRecord[],
  sinceIso: string,
): HandoffMedicationSnapshot[] {
  const since = new Date(sinceIso).getTime();

  return records
    .filter((record) => {
      const recorded = new Date(record.recordedAt).getTime();
      const corrected = record.correctedAt
        ? new Date(record.correctedAt).getTime()
        : NaN;

      return (
        (Number.isFinite(recorded) && recorded >= since) ||
        (Number.isFinite(corrected) && corrected >= since)
      );
    })
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )
    .slice(0, 30)
    .map((record) => ({
      id: record.id,
      medicationName: record.medication.name,
      instructions: record.medication.instructions,
      recordedAt: record.recordedAt,
      correctedAt: record.correctedAt ?? null,
    }));
}

export function handoffCommunicationActivity(
  communications: CareCommunication[],
  sinceIso: string,
): HandoffCommunicationSnapshot[] {
  const since = new Date(sinceIso).getTime();

  return communications
    .filter(
      (communication) =>
        new Date(communication.occurredAt).getTime() >= since,
    )
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() -
        new Date(a.occurredAt).getTime(),
    )
    .slice(0, 20)
    .map((communication) => ({
      id: communication.id,
      summary: communication.summary,
      occurredAt: communication.occurredAt,
      personSpokenTo: communication.personSpokenTo,
      organizationName: communication.organizationName,
      outcome: communication.outcome,
      notes: communication.notes,
      followUpNeeded: communication.followUpNeeded,
      followUpAt: communication.followUpAt,
      priority: communication.priority,
    }));
}

export function handoffCoordinationActivity(
  conflicts: CoordinationConflict[],
): HandoffCoordinationSnapshot[] {
  return conflicts
    .slice()
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === "time_sensitive" ? -1 : 1;
      }
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    })
    .slice(0, 20)
    .map((conflict) => ({
      id: conflict.id,
      title: conflict.title,
      detail: conflict.detail,
      startsAt: conflict.startsAt,
      priority: conflict.priority,
    }));
}

export function handoffFollowUps(
  communications: CareCommunication[],
  now = new Date(),
): HandoffFollowUpSnapshot[] {
  return communications
    .filter(
      (communication) =>
        communication.followUpNeeded && Boolean(communication.followUpAt),
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.followUpAt!).getTime() -
        new Date(b.followUpAt!).getTime(),
    )
    .filter((communication) => {
      const time = new Date(communication.followUpAt!).getTime();
      return Number.isFinite(time) && time >= now.getTime() - 24 * 60 * 60_000;
    })
    .slice(0, 12)
    .map((communication) => ({
      id: communication.id,
      summary: communication.summary,
      followUpAt: communication.followUpAt!,
      personSpokenTo: communication.personSpokenTo,
      organizationName: communication.organizationName,
      priority: communication.priority,
    }));
}

export function handoffAppointmentSnapshot(
  nextAppointment:
    | {
        appointment: {
          id: string;
          title: string;
          location: string;
          notes: string;
        };
        startsAt: string;
      }
    | null,
): HandoffAppointmentSnapshot | null {
  if (!nextAppointment) return null;

  return {
    id: nextAppointment.appointment.id,
    title: nextAppointment.appointment.title,
    startsAt: nextAppointment.startsAt,
    location: nextAppointment.appointment.location,
    notes: nextAppointment.appointment.notes,
  };
}

export function handoffBriefingCounts(input: {
  openTasks: Array<unknown>;
  completedTasks: Array<unknown>;
  medications: HandoffMedicationSnapshot[];
  communications: HandoffCommunicationSnapshot[];
  coordination: HandoffCoordinationSnapshot[];
  followUps: HandoffFollowUpSnapshot[];
  nextAppointment: HandoffAppointmentSnapshot | null;
}) {
  return {
    openTasks: input.openTasks.length,
    completedTasks: input.completedTasks.length,
    medications: input.medications.length,
    communications: input.communications.length,
    coordination: input.coordination.length,
    followUps: input.followUps.length,
    hasNextAppointment: Boolean(input.nextAppointment),
  };
}
