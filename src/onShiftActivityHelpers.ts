import type { CareCommunication } from "./careCommunications";
import type { MedicationRecord } from "./medications";
import type { CaregiverShiftSession, CaregiverShiftSessionNote } from "./onShiftCaregiver";
import type { CareTask, CareTaskCompletion } from "./careTasks";

export type OnShiftActivityType =
  | "shift_start"
  | "task_completed"
  | "medication_recorded"
  | "medication_corrected"
  | "communication"
  | "shift_note";

export type OnShiftActivity = {
  id: string;
  type: OnShiftActivityType;
  occurredAt: string;
  title: string;
  detail: string;
};

function validAt(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function buildOnShiftActivityTimeline(input: {
  session: Pick<CaregiverShiftSession, "id" | "startedAt">;
  notes: CaregiverShiftSessionNote[];
  taskCompletions: CareTaskCompletion[];
  tasks: CareTask[];
  medicationRecords: MedicationRecord[];
  communications: CareCommunication[];
}) {
  const start = validAt(input.session.startedAt) ?? 0;
  const taskMap = new Map(input.tasks.map((task) => [task.id, task]));
  const entries: OnShiftActivity[] = [
    {
      id: `shift-start-${input.session.id}`,
      type: "shift_start",
      occurredAt: input.session.startedAt,
      title: "Shift takeover started",
      detail: "Focused on-shift caregiver workspace opened.",
    },
  ];

  for (const note of input.notes) {
    const at = validAt(note.createdAt);
    if (at === null || at < start) continue;

    entries.push({
      id: `note-${note.id}`,
      type: "shift_note",
      occurredAt: note.createdAt,
      title: "Shift note added",
      detail: note.body,
    });
  }

  for (const completion of input.taskCompletions) {
    const at = validAt(completion.completedAt);
    if (at === null || at < start) continue;

    const task = taskMap.get(completion.taskId);
    entries.push({
      id: `task-${completion.id}`,
      type: "task_completed",
      occurredAt: completion.completedAt,
      title: task?.title || "Care task completed",
      detail: completion.note || "Marked complete during this shift.",
    });
  }

  for (const record of input.medicationRecords) {
    const recordedAt = validAt(record.recordedAt);
    if (recordedAt !== null && recordedAt >= start) {
      entries.push({
        id: `med-recorded-${record.id}`,
        type: "medication_recorded",
        occurredAt: record.recordedAt,
        title: `${record.medication.name} recorded`,
        detail:
          "Caregiver medication record added. This does not independently verify administration.",
      });
    }

    if (record.correctedAt) {
      const correctedAt = validAt(record.correctedAt);
      if (correctedAt !== null && correctedAt >= start) {
        entries.push({
          id: `med-corrected-${record.id}`,
          type: "medication_corrected",
          occurredAt: record.correctedAt,
          title: `${record.medication.name} record corrected`,
          detail: "The earlier caregiver medication entry was withdrawn/corrected.",
        });
      }
    }
  }

  for (const communication of input.communications) {
    const at = validAt(communication.occurredAt);
    if (at === null || at < start) continue;

    entries.push({
      id: `communication-${communication.id}`,
      type: "communication",
      occurredAt: communication.occurredAt,
      title: communication.summary,
      detail: [
        communication.personSpokenTo,
        communication.organizationName,
        communication.outcome,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  return entries.sort((a, b) => {
    const aTime = validAt(a.occurredAt) ?? 0;
    const bTime = validAt(b.occurredAt) ?? 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.id.localeCompare(b.id);
  });
}

export function onShiftActivityCounts(items: OnShiftActivity[]) {
  return items.reduce(
    (counts, item) => {
      counts.total += 1;
      counts[item.type] += 1;
      return counts;
    },
    {
      total: 0,
      shift_start: 0,
      task_completed: 0,
      medication_recorded: 0,
      medication_corrected: 0,
      communication: 0,
      shift_note: 0,
    } satisfies Record<OnShiftActivityType | "total", number>,
  );
}
