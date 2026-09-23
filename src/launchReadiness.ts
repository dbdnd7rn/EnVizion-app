import type {
  PilotOperationsSummary,
  PilotSummary,
} from "./pilot";

export type LaunchReadinessLevel = "ready" | "attention" | "blocked";

export type LaunchReadinessResult = {
  level: LaunchReadinessLevel;
  issues: string[];
};

export function launchReadiness(input: {
  pilot: PilotSummary | null;
  operations: PilotOperationsSummary | null;
  publishedRequiredDocuments: number;
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

  if (input.publishedRequiredDocuments === 0) {
    issues.push("No required participation documents are published");
  }

  if (
    input.pilot.activePilot > 0 &&
    input.pilot.activeConsentComplete < input.pilot.activePilot
  ) {
    issues.push("Some active pilot users are not current on required documents");
  }

  if (input.operations.failedPackets24h > 0) {
    issues.push(
      `${input.operations.failedPackets24h} care packet export failure${input.operations.failedPackets24h === 1 ? "" : "s"} in the last 24 hours`,
    );
  }

  if (input.operations.failedPushes24h > 5) {
    issues.push(
      `${input.operations.failedPushes24h} failed push attempts in the last 24 hours`,
    );
  }

  if (input.operations.staleSupport48h > 0) {
    issues.push(
      `${input.operations.staleSupport48h} support request${input.operations.staleSupport48h === 1 ? "" : "s"} open longer than 48 hours`,
    );
  }

  if (input.operations.openDiagnostics > 5) {
    issues.push(
      `${input.operations.openDiagnostics} open technical diagnostic reports`,
    );
  }

  const hardBlock =
    input.operations.failedPackets24h > 0 ||
    (
      input.pilot.activePilot > 0 &&
      input.pilot.activeConsentComplete < input.pilot.activePilot
    );

  return {
    level: hardBlock ? "blocked" : issues.length ? "attention" : "ready",
    issues,
  };
}
