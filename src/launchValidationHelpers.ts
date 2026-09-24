import type {
  LaunchPlatform,
  LaunchRole,
  RecoveryDrillType,
} from "./launchValidation";

export type ValidationStep = {
  id: string;
  title: string;
  detail: string;
};

const roleSteps: Record<LaunchRole, ValidationStep[]> = {
  owner: [
    {
      id: "owner_dashboard",
      title: "Owner dashboard",
      detail: "Open Home and confirm the Owner command center reflects real care data.",
    },
    {
      id: "daily_care_plan",
      title: "Daily care plan",
      detail: "Open today's recurring care plan and confirm the routine state is understandable.",
    },
    {
      id: "medications",
      title: "Medication management",
      detail: "Open medication management and review reconciliation status without changing data unnecessarily.",
    },
    {
      id: "emergency_center",
      title: "Emergency information",
      detail: "Open the Emergency Information Center and confirm quick-reference information is readable.",
    },
    {
      id: "document_vault",
      title: "Care Document Vault",
      detail: "Open the Vault and confirm key/review-due document states are clear.",
    },
    {
      id: "family_communication",
      title: "Family communication",
      detail: "Open Family Communication and confirm acknowledgement state is understandable.",
    },
  ],
  caregiver: [
    {
      id: "schedule_shift",
      title: "Schedule / shift",
      detail: "Open caregiver schedule or on-shift workspace and confirm assigned work is clear.",
    },
    {
      id: "daily_care_plan",
      title: "Daily care plan",
      detail: "Open the recurring care plan and confirm caregiver actions are clear.",
    },
    {
      id: "family_communication",
      title: "Family communication",
      detail: "Open family updates and confirm acknowledgement flow is usable.",
    },
    {
      id: "care_packet",
      title: "Care Packet",
      detail: "Open Care Packet and confirm available sections are understandable.",
    },
    {
      id: "notifications",
      title: "Notifications",
      detail: "Open notifications and confirm care actions deep-link to the expected workspace.",
    },
    {
      id: "handoff",
      title: "Caregiver handoff",
      detail: "Open handoff/continuity tools and confirm the next caregiver can understand the transition.",
    },
  ],
  viewer: [
    {
      id: "profile_read",
      title: "Read care profile",
      detail: "Open the care profile and confirm the core information can be read.",
    },
    {
      id: "documents_read",
      title: "Read Care Vault",
      detail: "Open documents and confirm read-only access behaves as expected.",
    },
    {
      id: "family_updates_read",
      title: "Read family updates",
      detail: "Open Family Communication and confirm updates are visible.",
    },
    {
      id: "no_edit_controls",
      title: "Read-only boundaries",
      detail: "Confirm editing/posting controls are not available where Viewer access should be read-only.",
    },
    {
      id: "emergency_read",
      title: "Emergency information",
      detail: "Open Emergency Information and confirm quick-reference details are readable.",
    },
    {
      id: "notifications",
      title: "Notifications",
      detail: "Open notifications and confirm relevant items can be followed safely.",
    },
  ],
};

const commonDeviceChecks: ValidationStep[] = [
  {
    id: "navigation_safe",
    title: "Navigation remains reachable",
    detail: "Bottom/header navigation does not overlap system bars or content.",
  },
  {
    id: "content_not_clipped",
    title: "Content is not clipped",
    detail: "Cards, buttons and long text remain readable without unintended cropping.",
  },
  {
    id: "text_scaling",
    title: "Larger text remains usable",
    detail: "Increase system text size and confirm primary actions remain understandable.",
  },
  {
    id: "keyboard_safe",
    title: "Keyboard does not hide inputs",
    detail: "Open an editable field and confirm the active input/actions remain reachable.",
  },
  {
    id: "resume_refresh",
    title: "Background / resume refresh",
    detail: "Background the app, return, and confirm care data refreshes without a stuck screen.",
  },
  {
    id: "offline_state",
    title: "Offline state is explicit",
    detail: "Interrupt connectivity and confirm stale data is clearly labelled rather than silently presented as live.",
  },
  {
    id: "action_feedback",
    title: "Actions show clear feedback",
    detail: "Buttons that save/share/acknowledge visibly report success or failure.",
  },
];

export function acceptanceStepsForRole(role: LaunchRole) {
  return roleSteps[role];
}

export function deviceChecksForPlatform(platform: LaunchPlatform) {
  const extra: ValidationStep =
    platform === "ios"
      ? {
          id: "ios_safe_area",
          title: "iOS safe area",
          detail: "Home indicator/notch areas do not cover navigation or important actions.",
        }
      : platform === "android"
        ? {
            id: "android_system_nav",
            title: "Android system navigation",
            detail: "Gesture/three-button navigation does not overlap app controls.",
          }
        : {
            id: "responsive_layout",
            title: "Responsive web layout",
            detail: "Phone-width and desktop-width web layouts remain usable.",
          };

  return [...commonDeviceChecks, extra];
}

export const recoveryDrills: Array<{
  id: RecoveryDrillType;
  title: string;
  detail: string;
  route?: "PrivacyData" | "CarePacket" | "Notifications";
}> = [
  {
    id: "network_reconnect",
    title: "Network interruption + reconnect",
    detail: "Interrupt connectivity, confirm stale-state messaging, reconnect, and verify live refresh recovers.",
  },
  {
    id: "session_revocation",
    title: "Other-device session revocation",
    detail: "Use Account, privacy & data to sign out other devices and verify this device stays active.",
    route: "PrivacyData",
  },
  {
    id: "packet_recovery",
    title: "Care Packet retry path",
    detail: "Verify a failed/interrupted packet workflow can be retried without creating an incorrect completed export.",
    route: "CarePacket",
  },
  {
    id: "notification_recovery",
    title: "Notification fallback",
    detail: "Confirm important care updates remain visible in the in-app notification center even if push delivery is unavailable.",
    route: "Notifications",
  },
];

export function validationProgress(
  values: Record<string, boolean>,
  steps: ValidationStep[],
) {
  const complete = steps.filter((step) => values[step.id] === true).length;
  return {
    complete,
    total: steps.length,
    ready: steps.length > 0 && complete === steps.length,
  };
}

export function runCanPass(input: {
  role: LaunchRole;
  platform: LaunchPlatform;
  steps: Record<string, boolean>;
  deviceChecks: Record<string, boolean>;
}) {
  return (
    validationProgress(input.steps, acceptanceStepsForRole(input.role)).ready &&
    validationProgress(
      input.deviceChecks,
      deviceChecksForPlatform(input.platform),
    ).ready
  );
}

export function gateHeadline(ready: boolean, blockers: string[]) {
  if (ready) return "All required launch evidence is complete.";
  if (!blockers.length) return "Launch evidence is still being evaluated.";
  return `${blockers.length} launch blocker${blockers.length === 1 ? "" : "s"} remain.`;
}
