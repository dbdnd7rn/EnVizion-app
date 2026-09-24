import { supabase } from "./supabase";

export type LaunchPlatform = "ios" | "android" | "web";
export type LaunchDeviceClass = "phone" | "tablet" | "desktop";
export type LaunchRole = "owner" | "caregiver" | "viewer";
export type LaunchRunStatus = "in_progress" | "passed" | "failed" | "blocked";
export type LaunchWaveStatus = "draft" | "active" | "completed" | "cancelled";
export type RecoveryDrillType =
  | "network_reconnect"
  | "session_revocation"
  | "packet_recovery"
  | "notification_recovery";
export type RecoveryDrillStatus = "passed" | "failed" | "blocked";

export type LaunchWave = {
  id: string;
  name: string;
  cohort: string;
  status: LaunchWaveStatus;
  requiredPlatforms: LaunchPlatform[];
  notes: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LaunchCareProfile = {
  careRecipientId: string;
  displayName: string;
  role: LaunchRole;
};

export type LaunchAcceptanceRun = {
  id: string;
  waveId: string;
  careRecipientId: string;
  role: LaunchRole;
  platform: LaunchPlatform;
  deviceClass: LaunchDeviceClass;
  appVersion: string;
  steps: Record<string, boolean>;
  deviceChecks: Record<string, boolean>;
  status: LaunchRunStatus;
  notes: string;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type LaunchRecoveryDrill = {
  id: string;
  waveId: string;
  drillType: RecoveryDrillType;
  status: RecoveryDrillStatus;
  evidence: Record<string, unknown>;
  notes: string;
  performedAt: string;
};

export type LaunchValidationWorkspace = {
  cohort: string;
  waves: LaunchWave[];
  profiles: LaunchCareProfile[];
  runs: LaunchAcceptanceRun[];
  drills: LaunchRecoveryDrill[];
};

export type LaunchGate = {
  waveId: string;
  participants: {
    active: number;
    consentCurrent: number;
  };
  documents: {
    publishedRequired: number;
  };
  acceptance: {
    totalRuns: number;
    passedRuns: number;
    rolePasses: Record<LaunchRole, number>;
    platformPasses: Record<LaunchPlatform, number>;
  };
  drills: {
    totalRuns: number;
    passes: Record<RecoveryDrillType, number>;
  };
  operations: {
    openDiagnostics: number;
    failedPacketExports24h: number;
    staleSupportRequests: number;
    pushDeliveryErrors24h: number;
  };
  blockers: string[];
  ready: boolean;
  signoff: null | {
    id: string;
    status: "approved" | "held";
    notes: string | null;
    signedBy: string;
    signedAt: string;
  };
};

export type PilotFoundationCohort = {
  cohort: string;
  totalParticipants: number;
  activeParticipants: number;
  invitedParticipants: number;
  pausedParticipants: number;
  consentCurrent: number;
  roleCoverage: Record<LaunchRole, number>;
  activationBlockers: string[];
  activationReady: boolean;
};

export type PilotFoundationSnapshot = {
  publishedRequiredDocuments: number;
  publishedDocumentTypes: string[];
  missingDocumentTypes: string[];
  cohorts: PilotFoundationCohort[];
  foundationReady: boolean;
};

export type LaunchAdminDashboard = {
  waves: LaunchWave[];
  gates: LaunchGate[];
  operations: LaunchGate["operations"];
  foundation: PilotFoundationSnapshot;
};

function mapWave(row: any): LaunchWave {
  return {
    id: String(row.id),
    name: String(row.name),
    cohort: String(row.cohort),
    status: row.status as LaunchWaveStatus,
    requiredPlatforms: (row.required_platforms ?? []) as LaunchPlatform[],
    notes: row.notes ?? "",
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRun(row: any): LaunchAcceptanceRun {
  return {
    id: String(row.id),
    waveId: String(row.wave_id),
    careRecipientId: String(row.care_recipient_id),
    role: row.role as LaunchRole,
    platform: row.platform as LaunchPlatform,
    deviceClass: row.device_class as LaunchDeviceClass,
    appVersion: row.app_version ?? "",
    steps: (row.steps ?? {}) as Record<string, boolean>,
    deviceChecks: (row.device_checks ?? {}) as Record<string, boolean>,
    status: row.status as LaunchRunStatus,
    notes: row.notes ?? "",
    startedAt: String(row.started_at),
    completedAt: row.completed_at ?? null,
    updatedAt: String(row.updated_at),
  };
}

function mapDrill(row: any): LaunchRecoveryDrill {
  return {
    id: String(row.id),
    waveId: String(row.wave_id),
    drillType: row.drill_type as RecoveryDrillType,
    status: row.status as RecoveryDrillStatus,
    evidence: (row.evidence ?? {}) as Record<string, unknown>,
    notes: row.notes ?? "",
    performedAt: String(row.performed_at),
  };
}

async function invokeValidation<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("launch-validation", {
    body,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

async function invokeLaunchAdmin<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("launch-admin", {
    body,
  });
  if (error) throw error;
  if (data?.error) {
    const blockerSuffix = Array.isArray(data.blockers)
      ? `: ${data.blockers.join("; ")}`
      : "";
    throw new Error(String(data.error) + blockerSuffix);
  }
  return data as T;
}

export async function loadLaunchValidationWorkspace(): Promise<LaunchValidationWorkspace> {
  const result = await invokeValidation<any>({ action: "workspace" });
  return {
    cohort: String(result.cohort ?? ""),
    waves: (result.waves ?? []).map(mapWave),
    profiles: (result.profiles ?? []).map((row: any) => ({
      careRecipientId: String(row.careRecipientId),
      displayName: String(row.displayName),
      role: row.role as LaunchRole,
    })),
    runs: (result.runs ?? []).map(mapRun),
    drills: (result.drills ?? []).map(mapDrill),
  };
}

export async function startLaunchAcceptance(input: {
  waveId: string;
  careRecipientId: string;
  platform: LaunchPlatform;
  deviceClass: LaunchDeviceClass;
  appVersion: string;
}) {
  const result = await invokeValidation<{ run: any }>({
    action: "start_acceptance",
    ...input,
  });
  return mapRun(result.run);
}

export async function saveLaunchAcceptance(input: {
  runId: string;
  steps: Record<string, boolean>;
  deviceChecks: Record<string, boolean>;
  status: LaunchRunStatus;
  notes: string;
}) {
  const result = await invokeValidation<{ run: any }>({
    action: "save_acceptance",
    ...input,
  });
  return mapRun(result.run);
}

export async function recordLaunchRecoveryDrill(input: {
  waveId: string;
  drillType: RecoveryDrillType;
  status: RecoveryDrillStatus;
  notes: string;
  evidence: Record<string, unknown>;
}) {
  const result = await invokeValidation<{ drill: any }>({
    action: "record_drill",
    ...input,
  });
  return mapDrill(result.drill);
}

export async function loadLaunchAdminDashboard(): Promise<LaunchAdminDashboard> {
  const result = await invokeLaunchAdmin<any>({ action: "dashboard" });
  return {
    waves: (result.waves ?? []).map(mapWave),
    gates: (result.gates ?? []).map((gate: any) => ({
      waveId: String(gate.waveId),
      participants: gate.participants,
      documents: gate.documents,
      acceptance: gate.acceptance,
      drills: gate.drills,
      operations: gate.operations,
      blockers: gate.blockers ?? [],
      ready: Boolean(gate.ready),
      signoff: gate.signoff
        ? {
            id: String(gate.signoff.id),
            status: gate.signoff.status,
            notes: gate.signoff.notes ?? null,
            signedBy: String(gate.signoff.signed_by),
            signedAt: String(gate.signoff.signed_at),
          }
        : null,
    })),
    operations: result.operations,
    foundation: {
      publishedRequiredDocuments: Number(
        result.foundation?.publishedRequiredDocuments ?? 0,
      ),
      publishedDocumentTypes: result.foundation?.publishedDocumentTypes ?? [],
      missingDocumentTypes: result.foundation?.missingDocumentTypes ?? [],
      cohorts: (result.foundation?.cohorts ?? []).map((item: any) => ({
        cohort: String(item.cohort),
        totalParticipants: Number(item.totalParticipants ?? 0),
        activeParticipants: Number(item.activeParticipants ?? 0),
        invitedParticipants: Number(item.invitedParticipants ?? 0),
        pausedParticipants: Number(item.pausedParticipants ?? 0),
        consentCurrent: Number(item.consentCurrent ?? 0),
        roleCoverage: {
          owner: Number(item.roleCoverage?.owner ?? 0),
          caregiver: Number(item.roleCoverage?.caregiver ?? 0),
          viewer: Number(item.roleCoverage?.viewer ?? 0),
        },
        activationBlockers: item.activationBlockers ?? [],
        activationReady: Boolean(item.activationReady),
      })),
      foundationReady: Boolean(result.foundation?.foundationReady),
    },
  };
}

export async function saveLaunchWave(input: {
  waveId?: string | null;
  name: string;
  cohort: string;
  status: LaunchWaveStatus;
  requiredPlatforms: LaunchPlatform[];
  notes: string;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const result = await invokeLaunchAdmin<{ wave: any }>({
    action: "save_wave",
    ...input,
  });
  return mapWave(result.wave);
}

export async function signLaunchWave(input: {
  waveId: string;
  status: "approved" | "held";
  notes: string;
}) {
  return invokeLaunchAdmin<{ signoff: any; gate: LaunchGate }>({
    action: "signoff",
    ...input,
  });
}
