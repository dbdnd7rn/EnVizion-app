import type {
  PilotOperationsSummary,
  PilotSummary,
  ProgramDocumentType,
} from "./pilot";
import { missingPilotDocumentTypes, pilotDocumentLabels, requiredPilotDocumentTypes } from "./pilotConsentSafety.ts";

export type LaunchReadinessLevel = "ready" | "attention" | "blocked";

export type LaunchReadinessResult = {
  level: LaunchReadinessLevel;
  issues: string[];
};

export function launchReadiness(input: {
  pilot: PilotSummary | null;
  operations: PilotOperationsSummary | null;
  publishedRequiredDocuments: number;
  publishedRequiredDocumentTypes?: readonly ProgramDocumentType[];
}) : LaunchReadinessResult {
  const issues: string[] = [];

  if (!input.pilot) {
    return {
      level: "blocked",
      issues: ["Pilot summary unavailable"],
    };
  }

  if (!input.operations) {
    return {
      level: "blocked",
      issues: ["Operations summary unavailable"],
    };
  }

  const missingDocuments = input.publishedRequiredDocumentTypes
    ? missingPilotDocumentTypes(input.publishedRequiredDocumentTypes)
    : null;
  const missingRequiredDocuments = missingDocuments !== null
    ? missingDocuments.length > 0
    : input.publishedRequiredDocuments < requiredPilotDocumentTypes.length;

  if (missingDocuments?.length) {
    issues.push(
      "Required participation documents are not all published: " +
      missingDocuments.map((type) => pilotDocumentLabels[type]).join(", "),
    );
  } else if (missingRequiredDocuments) {
    issues.push("No complete set of required participation documents is published");
  }

  if (input.pilot.activePilot === 0) {
    issues.push("No active pilot participants have been enrolled and validated");
  }

  if (
    input.pilot.activePilot > 0 &&
    input.pilot.activeConsentComplete < input.pilot.activePilot
  ) {
    issues.push("Some active pilot users are not current on required documents");
  }

  if (input.operations.failedPacketExports24h > 0) {
    issues.push(
      `${input.operations.failedPacketExports24h} care packet export failure${input.operations.failedPacketExports24h === 1 ? "" : "s"} in the last 24 hours`,
    );
  }

  if (input.operations.pushDeliveryErrors24h > 5) {
    issues.push(
      `${input.operations.pushDeliveryErrors24h} failed push attempts in the last 24 hours`,
    );
  }

  if (input.operations.staleSupportRequests > 0) {
    issues.push(
      `${input.operations.staleSupportRequests} support request${input.operations.staleSupportRequests === 1 ? "" : "s"} open longer than 24 hours`,
    );
  }

  if (input.operations.openDiagnostics > 5) {
    issues.push(
      `${input.operations.openDiagnostics} open technical diagnostic reports`,
    );
  }

  const hardBlock =
    missingRequiredDocuments ||
    input.operations.failedPacketExports24h > 0 ||
    (
      input.pilot.activePilot > 0 &&
      input.pilot.activeConsentComplete < input.pilot.activePilot
    );

  return {
    level: hardBlock ? "blocked" : issues.length ? "attention" : "ready",
    issues,
  };
}
