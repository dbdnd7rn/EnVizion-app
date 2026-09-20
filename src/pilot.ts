import { supabase } from "./supabase";
import type { StaffMembership } from "./staff";

export type PilotStatus = "invited" | "active" | "paused" | "exited";
export type ProgramDocumentType =
  | "privacy_notice"
  | "pilot_consent"
  | "terms_of_use";
export type ProgramDocumentStatus = "draft" | "published" | "retired";

export type ProgramDocument = {
  id: string;
  documentType: ProgramDocumentType;
  title: string;
  version: number;
  body: string;
  status: ProgramDocumentStatus;
  effectiveAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PilotParticipant = {
  userId: string;
  email: string;
  displayName: string;
  status: PilotStatus;
  cohort: string;
  enrolledAt: string | null;
  exitedAt: string | null;
  createdAt: string;
  updatedAt: string;
  consentComplete: boolean;
  careProfileCount: number;
};

export type PilotSummary = {
  totalAccounts: number;
  invitedPilot: number;
  activePilot: number;
  pausedPilot: number;
  exitedPilot: number;
  activeConsentComplete: number;
  currentRequiredDocuments: number;
  careProfiles: number;
  openSupport: number;
  activeCoaching: number;
};

export type PilotAdminAudit = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type PilotConsentState = {
  enrolled: boolean;
  status: PilotStatus | null;
  outstanding: ProgramDocument[];
};

async function invokePilotAdmin<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pilot-admin", {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function claimInitialAdminIfAllowed(): Promise<StaffMembership | null> {
  const { data, error } = await supabase.functions.invoke("pilot-admin", {
    body: { action: "claim_initial_admin" },
  });

  if (error || !data?.claimed || !data.membership) return null;

  return {
    userId: String(data.membership.userId),
    displayName: String(data.membership.displayName),
    role: "admin",
  };
}

export async function loadPilotConsentState(): Promise<PilotConsentState> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { enrolled: false, status: null, outstanding: [] };
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("pilot_enrollments")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (enrollmentError) throw enrollmentError;
  if (!enrollment) {
    return { enrolled: false, status: null, outstanding: [] };
  }

  const status = enrollment.status as PilotStatus;
  if (!["invited", "active"].includes(status)) {
    return { enrolled: true, status, outstanding: [] };
  }

  const now = new Date().toISOString();
  const [{ data: documents, error: documentError }, { data: accepted, error: acceptedError }] =
    await Promise.all([
      supabase
        .from("program_documents")
        .select(
          "id, document_type, title, version, body_markdown, status, effective_at, published_at, created_at, updated_at",
        )
        .eq("status", "published")
        .or(`effective_at.is.null,effective_at.lte.${now}`)
        .order("document_type", { ascending: true }),
      supabase
        .from("user_document_acceptances")
        .select("document_id")
        .eq("user_id", user.id),
    ]);

  if (documentError) throw documentError;
  if (acceptedError) throw acceptedError;

  const acceptedIds = new Set((accepted ?? []).map((row) => row.document_id));

  return {
    enrolled: true,
    status,
    outstanding: (documents ?? [])
      .filter((row) => !acceptedIds.has(row.id))
      .map((row) => ({
        id: row.id,
        documentType: row.document_type as ProgramDocumentType,
        title: row.title,
        version: row.version,
        body: row.body_markdown,
        status: row.status as ProgramDocumentStatus,
        effectiveAt: row.effective_at,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
  };
}

export async function acceptProgramDocument(documentId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { error } = await supabase
    .from("user_document_acceptances")
    .insert({
      user_id: user.id,
      document_id: documentId,
    });

  if (error && error.code !== "23505") throw error;
}

export async function loadPilotSummary(): Promise<PilotSummary> {
  const result = await invokePilotAdmin<{ summary: PilotSummary }>({
    action: "summary",
  });
  return result.summary;
}

export async function loadPilotParticipants(): Promise<PilotParticipant[]> {
  const result = await invokePilotAdmin<{ participants: PilotParticipant[] }>({
    action: "list_participants",
  });
  return result.participants ?? [];
}

export async function invitePilotParticipant(input: {
  email: string;
  displayName: string;
  cohort: string;
}) {
  return invokePilotAdmin<{
    ok: boolean;
    invitationEmailSent: boolean;
    userId: string;
  }>({
    action: "invite_participant",
    email: input.email,
    displayName: input.displayName,
    cohort: input.cohort,
  });
}

export async function updatePilotParticipant(input: {
  userId: string;
  status: PilotStatus;
  cohort: string;
}) {
  await invokePilotAdmin({
    action: "update_participant",
    userId: input.userId,
    status: input.status,
    cohort: input.cohort,
  });
}

export async function loadProgramDocuments(): Promise<ProgramDocument[]> {
  const result = await invokePilotAdmin<{ documents: ProgramDocument[] }>({
    action: "list_documents",
  });
  return result.documents ?? [];
}

export async function saveProgramDocument(input: {
  documentId?: string | null;
  documentType: ProgramDocumentType;
  title: string;
  body: string;
}) {
  return invokePilotAdmin<{ ok: boolean; documentId: string }>({
    action: "save_document",
    documentId: input.documentId ?? "",
    documentType: input.documentType,
    title: input.title,
    body: input.body,
  });
}

export async function publishProgramDocument(documentId: string) {
  await invokePilotAdmin({
    action: "publish_document",
    documentId,
  });
}

export async function retireProgramDocument(documentId: string) {
  await invokePilotAdmin({
    action: "retire_document",
    documentId,
  });
}

export async function loadPilotAdminAudit(): Promise<PilotAdminAudit[]> {
  const result = await invokePilotAdmin<{ audit: PilotAdminAudit[] }>({
    action: "audit",
  });
  return result.audit ?? [];
}
