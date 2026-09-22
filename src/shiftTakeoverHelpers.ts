import type { CareTask } from "./careTasks";
import type {
  CareShiftHandoff,
  CareShiftHandoffAcknowledgement,
} from "./shiftBoard";

export function canAcceptHandoff(input: {
  handoff: CareShiftHandoff;
  acknowledgement?: CareShiftHandoffAcknowledgement | null;
  currentUserId: string | null;
  readOnly: boolean;
}) {
  if (input.readOnly || !input.currentUserId) return false;
  if (!input.handoff.requiresAcknowledgement) return false;
  if (input.acknowledgement) return false;
  if (input.handoff.createdBy === input.currentUserId) return false;

  return (
    input.handoff.handoffTo === null ||
    input.handoff.handoffTo === input.currentUserId
  );
}

export function takeoverResponsibilities(
  tasks: CareTask[],
  currentUserId: string | null,
) {
  const open = tasks.filter((task) => task.status === "open");

  return {
    mine: currentUserId
      ? open.filter((task) => task.assignedTo === currentUserId)
      : [],
    shared: open.filter((task) => task.assignedTo === null),
    assignedElsewhere: currentUserId
      ? open.filter(
          (task) =>
            task.assignedTo !== null &&
            task.assignedTo !== currentUserId,
        )
      : open.filter((task) => task.assignedTo !== null),
  };
}

export function latestAcceptableHandoff(input: {
  handoffs: CareShiftHandoff[];
  acknowledgements: CareShiftHandoffAcknowledgement[];
  currentUserId: string | null;
  readOnly: boolean;
}) {
  const acknowledgementMap = new Map(
    input.acknowledgements.map((item) => [item.handoffId, item]),
  );

  return (
    input.handoffs.find((handoff) =>
      canAcceptHandoff({
        handoff,
        acknowledgement: acknowledgementMap.get(handoff.id),
        currentUserId: input.currentUserId,
        readOnly: input.readOnly,
      }),
    ) ?? null
  );
}
