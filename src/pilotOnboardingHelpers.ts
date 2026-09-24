import type {
  PilotOnboardingStage,
  PilotParticipant,
} from "./pilot";

export type PilotOnboardingStep = {
  id: "invitation" | "sign_in" | "documents" | "role" | "activation";
  title: string;
  detail: string;
  complete: boolean;
};

const stageLabels: Record<PilotOnboardingStage, string> = {
  invitation_pending: "Invitation pending",
  first_sign_in_pending: "First sign-in pending",
  documents_pending: "Documents pending",
  role_pending: "Care role pending",
  ready_for_activation: "Ready to activate",
  active_ready: "Launch testing ready",
  paused_ready: "Paused · otherwise ready",
  exited: "Exited",
};

export function pilotOnboardingStageLabel(stage: PilotOnboardingStage) {
  return stageLabels[stage];
}

export function pilotOnboardingSteps(
  participant: PilotParticipant,
): PilotOnboardingStep[] {
  return [
    {
      id: "invitation",
      title: "Invitation accepted",
      detail: participant.invitation.accountConfirmed
        ? "The participant account/email invitation is confirmed."
        : "The participant still needs to accept the account invitation.",
      complete: participant.invitation.accountConfirmed,
    },
    {
      id: "sign_in",
      title: "First sign-in completed",
      detail: participant.invitation.signedIn
        ? "The participant has signed in to EnVizion."
        : "The participant has not completed a first sign-in yet.",
      complete: participant.invitation.signedIn,
    },
    {
      id: "documents",
      title: "Required documents accepted",
      detail: participant.documents.complete
        ? `${participant.documents.accepted}/${participant.documents.required} current documents accepted.`
        : participant.documents.publishedRequiredTypesComplete
          ? `${participant.documents.accepted}/${participant.documents.required} accepted.`
          : "Privacy notice, pilot consent and terms must all be published first.",
      complete: participant.documents.complete,
    },
    {
      id: "role",
      title: "Real care-team role available",
      detail: participant.roles.ready
        ? `Owner ${participant.roles.owner} · Caregiver ${participant.roles.caregiver} · Viewer ${participant.roles.viewer}`
        : "A care owner must grant and the participant must accept real care-profile access.",
      complete: participant.roles.ready,
    },
    {
      id: "activation",
      title: "Pilot activated",
      detail:
        participant.status === "active"
          ? participant.launchTestingReady
            ? "Active and ready for launch validation."
            : "Active, but a readiness requirement now needs attention."
          : participant.readyForActivation
            ? "All prerequisites are complete; Admin can activate the participant."
            : "Activation remains locked until the prerequisites above are complete.",
      complete: participant.status === "active" && participant.launchTestingReady,
    },
  ];
}

export function pilotOnboardingProgress(participant: PilotParticipant) {
  const steps = pilotOnboardingSteps(participant);
  return {
    complete: steps.filter((step) => step.complete).length,
    total: steps.length,
    readyForActivation: participant.readyForActivation,
    launchTestingReady: participant.launchTestingReady,
  };
}
