import type {
  FamilyUpdate,
  FamilyUpdateAcknowledgement,
} from "./familyCommunication";

export function familyUpdateAcknowledgements(
  updateId: string,
  acknowledgements: FamilyUpdateAcknowledgement[],
) {
  return acknowledgements.filter(
    (acknowledgement) => acknowledgement.updateId === updateId,
  );
}

export function familyUpdateAcknowledgedByUser(
  updateId: string,
  userId: string | null,
  acknowledgements: FamilyUpdateAcknowledgement[],
) {
  if (!userId) return false;
  return acknowledgements.some(
    (acknowledgement) =>
      acknowledgement.updateId === updateId &&
      acknowledgement.acknowledgedBy === userId,
  );
}

export function familyCommunicationSummary(
  updates: FamilyUpdate[],
  acknowledgements: FamilyUpdateAcknowledgement[],
  userId: string | null,
) {
  return updates.reduce(
    (summary, update) => {
      summary.total += 1;
      if (update.priority === "important") summary.important += 1;
      if (
        update.requiresAcknowledgement &&
        !familyUpdateAcknowledgedByUser(
          update.id,
          userId,
          acknowledgements,
        )
      ) {
        summary.needsMyAcknowledgement += 1;
      }
      return summary;
    },
    {
      total: 0,
      important: 0,
      needsMyAcknowledgement: 0,
    },
  );
}
