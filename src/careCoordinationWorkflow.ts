import type { CoordinationConflict } from "./careCoordinationConflicts";
import { supabase } from "./supabase";

export type CoordinationResolutionStatus = "open" | "snoozed" | "resolved";

export type CoordinationResolution = {
  id: string;
  careRecipientId: string;
  conflictKey: string;
  conflictKind: CoordinationConflict["kind"];
  conflictTitle: string;
  conflictStartsAt: string;
  status: CoordinationResolutionStatus;
  assignedTo: string | null;
  snoozedUntil: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CoordinationComment = {
  id: string;
  careRecipientId: string;
  resolutionId: string;
  conflictKey: string;
  authorUserId: string | null;
  body: string;
  createdAt: string;
};

export type CoordinationHistoryEvent = {
  id: string;
  careRecipientId: string;
  resolutionId: string;
  conflictKey: string;
  actorUserId: string | null;
  action:
    | "tracking_started"
    | "assigned"
    | "unassigned"
    | "snoozed"
    | "resolved"
    | "reopened";
  fromStatus: string | null;
  toStatus: string | null;
  assignedTo: string | null;
  snoozedUntil: string | null;
  createdAt: string;
};

export type CoordinationWorkflowData = {
  resolutions: CoordinationResolution[];
  comments: CoordinationComment[];
  history: CoordinationHistoryEvent[];
};

function mapResolution(row: any): CoordinationResolution {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    conflictKey: row.conflict_key,
    conflictKind: row.conflict_kind,
    conflictTitle: row.conflict_title,
    conflictStartsAt: row.conflict_starts_at,
    status: row.status,
    assignedTo: row.assigned_to ?? null,
    snoozedUntil: row.snoozed_until ?? null,
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapComment(row: any): CoordinationComment {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    resolutionId: row.resolution_id,
    conflictKey: row.conflict_key,
    authorUserId: row.author_user_id ?? null,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapHistory(row: any): CoordinationHistoryEvent {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    resolutionId: row.resolution_id,
    conflictKey: row.conflict_key,
    actorUserId: row.actor_user_id ?? null,
    action: row.action,
    fromStatus: row.from_status ?? null,
    toStatus: row.to_status ?? null,
    assignedTo: row.assigned_to ?? null,
    snoozedUntil: row.snoozed_until ?? null,
    createdAt: row.created_at,
  };
}

async function currentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Please sign in again.");
  return user.id;
}

export async function loadCoordinationWorkflow(
  careRecipientId: string,
): Promise<CoordinationWorkflowData> {
  const [resolutions, comments, history] = await Promise.all([
    supabase
      .from("care_coordination_resolutions")
      .select(
        "id, care_recipient_id, conflict_key, conflict_kind, conflict_title, conflict_starts_at, status, assigned_to, snoozed_until, resolved_at, resolved_by, created_by, created_at, updated_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("care_coordination_comments")
      .select(
        "id, care_recipient_id, resolution_id, conflict_key, author_user_id, body, created_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("care_coordination_history")
      .select(
        "id, care_recipient_id, resolution_id, conflict_key, actor_user_id, action, from_status, to_status, assigned_to, snoozed_until, created_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("created_at", { ascending: true })
      .limit(750),
  ]);

  for (const result of [resolutions, comments, history]) {
    if (result.error) throw result.error;
  }

  return {
    resolutions: (resolutions.data ?? []).map(mapResolution),
    comments: (comments.data ?? []).map(mapComment),
    history: (history.data ?? []).map(mapHistory),
  };
}

export async function ensureCoordinationResolution(
  careRecipientId: string,
  conflict: CoordinationConflict,
) {
  const existing = await supabase
    .from("care_coordination_resolutions")
    .select(
      "id, care_recipient_id, conflict_key, conflict_kind, conflict_title, conflict_starts_at, status, assigned_to, snoozed_until, resolved_at, resolved_by, created_by, created_at, updated_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .eq("conflict_key", conflict.id)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return mapResolution(existing.data);

  const userId = await currentUserId();
  const inserted = await supabase
    .from("care_coordination_resolutions")
    .insert({
      care_recipient_id: careRecipientId,
      conflict_key: conflict.id,
      conflict_kind: conflict.kind,
      conflict_title: conflict.title,
      conflict_starts_at: conflict.startsAt,
      status: "open",
      created_by: userId,
    })
    .select(
      "id, care_recipient_id, conflict_key, conflict_kind, conflict_title, conflict_starts_at, status, assigned_to, snoozed_until, resolved_at, resolved_by, created_by, created_at, updated_at",
    )
    .single();

  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const raced = await supabase
        .from("care_coordination_resolutions")
        .select(
          "id, care_recipient_id, conflict_key, conflict_kind, conflict_title, conflict_starts_at, status, assigned_to, snoozed_until, resolved_at, resolved_by, created_by, created_at, updated_at",
        )
        .eq("care_recipient_id", careRecipientId)
        .eq("conflict_key", conflict.id)
        .single();
      if (raced.error) throw raced.error;
      return mapResolution(raced.data);
    }
    throw inserted.error;
  }

  return mapResolution(inserted.data);
}

async function updateResolution(
  careRecipientId: string,
  conflict: CoordinationConflict,
  patch: Record<string, unknown>,
) {
  const resolution = await ensureCoordinationResolution(
    careRecipientId,
    conflict,
  );

  const result = await supabase
    .from("care_coordination_resolutions")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resolution.id)
    .eq("care_recipient_id", careRecipientId)
    .select(
      "id, care_recipient_id, conflict_key, conflict_kind, conflict_title, conflict_starts_at, status, assigned_to, snoozed_until, resolved_at, resolved_by, created_by, created_at, updated_at",
    )
    .single();

  if (result.error) throw result.error;
  return mapResolution(result.data);
}

export function assignCoordinationConflict(
  careRecipientId: string,
  conflict: CoordinationConflict,
  assignedTo: string | null,
) {
  return updateResolution(careRecipientId, conflict, {
    assigned_to: assignedTo,
  });
}

export function snoozeCoordinationConflict(
  careRecipientId: string,
  conflict: CoordinationConflict,
  snoozedUntil: Date,
) {
  if (snoozedUntil.getTime() <= Date.now()) {
    throw new Error("Choose a snooze time in the future.");
  }

  return updateResolution(careRecipientId, conflict, {
    status: "snoozed",
    snoozed_until: snoozedUntil.toISOString(),
    resolved_at: null,
    resolved_by: null,
  });
}

export async function resolveCoordinationConflict(
  careRecipientId: string,
  conflict: CoordinationConflict,
) {
  const userId = await currentUserId();
  const now = new Date().toISOString();
  return updateResolution(careRecipientId, conflict, {
    status: "resolved",
    snoozed_until: null,
    resolved_at: now,
    resolved_by: userId,
  });
}

export function reopenCoordinationConflict(
  careRecipientId: string,
  conflict: CoordinationConflict,
) {
  return updateResolution(careRecipientId, conflict, {
    status: "open",
    snoozed_until: null,
    resolved_at: null,
    resolved_by: null,
  });
}

export async function addCoordinationComment(
  careRecipientId: string,
  conflict: CoordinationConflict,
  body: string,
) {
  const clean = body.trim();
  if (!clean) throw new Error("Write a comment first.");
  if (clean.length > 2000) {
    throw new Error("Keep coordination comments under 2,000 characters.");
  }

  const [resolution, userId] = await Promise.all([
    ensureCoordinationResolution(careRecipientId, conflict),
    currentUserId(),
  ]);

  const result = await supabase
    .from("care_coordination_comments")
    .insert({
      care_recipient_id: careRecipientId,
      resolution_id: resolution.id,
      conflict_key: conflict.id,
      author_user_id: userId,
      body: clean,
    })
    .select(
      "id, care_recipient_id, resolution_id, conflict_key, author_user_id, body, created_at",
    )
    .single();

  if (result.error) throw result.error;
  return mapComment(result.data);
}
