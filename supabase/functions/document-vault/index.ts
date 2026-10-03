import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
function jwtSessionId(token: string) {
  try {
    const payload = token.split(".")[1] ?? "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded));
    return String(decoded?.session_id ?? "");
  } catch {
    return "";
  }
}


const BUCKET = "care-documents";
const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const CATEGORIES = new Set([
  "discharge",
  "insurance",
  "care_plan",
  "medical_record",
  "identification",
  "advance_directive",
  "medication_list",
  "lab_result",
  "other",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function cleanName(value: string) {
  const trimmed = value.trim().slice(0, 180);
  const safe = trimmed
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return safe || "document";
}

async function accessFor(admin: any, userId: string, careRecipientId: string) {
  const { data: recipient, error: recipientError } = await admin
    .from("care_recipients")
    .select("id, owner_id, display_name, care_group_id")
    .eq("id", careRecipientId)
    .maybeSingle();

  if (recipientError) throw recipientError;
  if (!recipient) return null;

  if (recipient.owner_id === userId) {
    return { role: "owner" as const, recipient };
  }

  const { data: member, error: memberError } = await admin
    .from("care_recipient_members")
    .select("role, status")
    .eq("care_recipient_id", careRecipientId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (memberError) throw memberError;
  if (member) {
    const role = String(member.role ?? "");
    if (role === "owner" || role === "caregiver" || role === "patient" || role === "viewer") {
      return {
        role: role as "owner" | "caregiver" | "patient" | "viewer",
        recipient,
      };
    }
    return { role: "viewer" as const, recipient };
  }

  if (recipient.care_group_id) {
    const { data: groupMember, error: groupMemberError } = await admin
      .from("care_group_members")
      .select("role, status")
      .eq("care_group_id", recipient.care_group_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (groupMemberError) throw groupMemberError;
    if (groupMember) {
      const role = String(groupMember.role ?? "");
      if (role === "primary_advocate") {
        return { role: "owner" as const, recipient };
      }
      if (role === "co_caregiver") {
        return { role: "caregiver" as const, recipient };
      }
      if (role === "patient" || role === "care_recipient") {
        return { role: "patient" as const, recipient };
      }
      return { role: "viewer" as const, recipient };
    }
  }

  return null;
}

async function getDocument(admin: any, documentId: string) {
  const { data, error } = await admin
    .from("care_documents")
    .select(
      "id, care_recipient_id, uploaded_by, storage_path, original_name, display_name, category, mime_type, size_bytes, notes, source_name, document_date, review_due_on, is_key_document, requires_biometric, archived_at, status, created_at, updated_at",
    )
    .eq("id", documentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function audit(
  admin: any,
  input: {
    careRecipientId: string;
    actorUserId: string;
    action: string;
    documentId: string;
    summary: string;
  },
) {
  const { error } = await admin.from("care_audit_events").insert({
    care_recipient_id: input.careRecipientId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: "care_documents",
    entity_id: input.documentId,
    summary: input.summary,
  });
  if (error) throw error;
}

async function notifyCareTeam(
  admin: any,
  careRecipientId: string,
  actorUserId: string,
  documentId: string,
  displayName: string,
  careRecipientName: string,
) {
  const [{ data: recipient }, { data: members }] = await Promise.all([
    admin
      .from("care_recipients")
      .select("owner_id")
      .eq("id", careRecipientId)
      .maybeSingle(),
    admin
      .from("care_recipient_members")
      .select("user_id")
      .eq("care_recipient_id", careRecipientId)
      .eq("status", "active"),
  ]);

  const recipients = new Set<string>();
  if (recipient?.owner_id) recipients.add(recipient.owner_id);
  for (const member of members ?? []) recipients.add(member.user_id);
  recipients.delete(actorUserId);

  if (!recipients.size) return;

  const rows = [...recipients].map((userId) => ({
    user_id: userId,
    audience: "caregiver",
    kind: "care_document_added",
    title: "New care document added",
    body: `${displayName} was added to ${careRecipientName}.`,
    entity_type: "care_document",
    entity_id: documentId,
  }));

  const { error } = await admin.from("notifications").insert(rows);
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Server configuration unavailable" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const sessionId = jwtSessionId(token);
    if (!sessionId) {
      return json({ error: "Session is no longer active" }, 401);
    }

    const { data: sessionActive, error: sessionError } = await admin.rpc(
      "service_session_is_active",
      {
        target_user_id: user.id,
        target_session_id: sessionId,
      },
    );
    if (sessionError || sessionActive !== true) {
      return json({ error: "Session is no longer active" }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? "");

    if (action === "create_upload") {
      const careRecipientId = String(payload.careRecipientId ?? "");
      const originalName = String(payload.originalName ?? "").trim();
      const displayName = String(payload.displayName ?? originalName).trim();
      const category = String(payload.category ?? "other");
      const mimeType = String(payload.mimeType ?? "").toLowerCase();
      const sizeBytes = Number(payload.sizeBytes ?? 0);
      const notes = String(payload.notes ?? "").trim();
      const sourceName = String(payload.sourceName ?? "").trim();
      const documentDate = String(payload.documentDate ?? "").trim();
      const reviewDueOn = String(payload.reviewDueOn ?? "").trim();
      const isKeyDocument = Boolean(payload.isKeyDocument);
      const requiresBiometric =
        category === "advance_directive"
          ? payload.requiresBiometric !== false
          : Boolean(payload.requiresBiometric);

      const validDate = (value: string) =>
        !value || /^\d{4}-\d{2}-\d{2}$/.test(value);

      if (!validDate(documentDate) || !validDate(reviewDueOn)) {
        return json({ error: "Use YYYY-MM-DD for document dates." }, 400);
      }

      if (!careRecipientId || !originalName || !displayName) {
        return json({ error: "Care profile and file name are required." }, 400);
      }
      if (!CATEGORIES.has(category)) {
        return json({ error: "Unsupported document category." }, 400);
      }
      if (!ALLOWED_MIME.has(mimeType)) {
        return json({ error: "This file type is not allowed in the care vault." }, 400);
      }
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
        return json({ error: "Files must be between 1 byte and 20 MB." }, 400);
      }

      const access = await accessFor(admin, user.id, careRecipientId);
      if (!access || access.role === "viewer" || access.role === "patient") {
        return json({ error: "Owner or Caregiver access is required to upload documents." }, 403);
      }

      const documentId = crypto.randomUUID();
      const storagePath = `${careRecipientId}/${documentId}/${cleanName(originalName)}`;

      const { error: insertError } = await admin.from("care_documents").insert({
        id: documentId,
        care_recipient_id: careRecipientId,
        uploaded_by: user.id,
        storage_path: storagePath,
        original_name: originalName,
        display_name: displayName,
        category,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        notes: notes || null,
        source_name: sourceName.slice(0, 300) || null,
        document_date: documentDate || null,
        review_due_on: reviewDueOn || null,
        is_key_document: isKeyDocument,
        requires_biometric: requiresBiometric,
        status: "pending",
      });
      if (insertError) throw insertError;

      const { data: signed, error: signedError } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);

      if (signedError || !signed?.token) {
        await admin.from("care_documents").delete().eq("id", documentId);
        throw signedError ?? new Error("Could not create a secure upload token.");
      }

      return json({ documentId, path: storagePath, token: signed.token });
    }

    if (action === "finalize_upload") {
      const documentId = String(payload.documentId ?? "");
      const document = await getDocument(admin, documentId);

      if (!document || document.status !== "pending") {
        return json({ error: "Pending document not found." }, 404);
      }

      const access = await accessFor(admin, user.id, document.care_recipient_id);
      if (!access || access.role === "viewer" || access.role === "patient" || document.uploaded_by !== user.id) {
        return json({ error: "You cannot finalize this upload." }, 403);
      }

      const slash = document.storage_path.lastIndexOf("/");
      const folder = document.storage_path.slice(0, slash);
      const name = document.storage_path.slice(slash + 1);

      const { data: objects, error: listError } = await admin.storage
        .from(BUCKET)
        .list(folder, { limit: 10, search: name });

      if (listError) throw listError;

      const object = (objects ?? []).find((item) => item.name === name);
      if (!object) {
        return json({ error: "The uploaded file could not be verified." }, 409);
      }

      const actualSize = Number((object as any)?.metadata?.size ?? document.size_bytes);
      if (!Number.isFinite(actualSize) || actualSize <= 0 || actualSize > MAX_BYTES) {
        await admin.storage.from(BUCKET).remove([document.storage_path]);
        await admin.from("care_documents").delete().eq("id", document.id);
        return json({ error: "Uploaded file size is invalid." }, 400);
      }

      const { data: ready, error: updateError } = await admin
        .from("care_documents")
        .update({ status: "ready", size_bytes: actualSize })
        .eq("id", document.id)
        .select(
          "id, care_recipient_id, uploaded_by, original_name, display_name, category, mime_type, size_bytes, notes, source_name, document_date, review_due_on, is_key_document, requires_biometric, archived_at, created_at, updated_at",
        )
        .single();

      if (updateError) throw updateError;

      await audit(admin, {
        careRecipientId: document.care_recipient_id,
        actorUserId: user.id,
        action: "upload",
        documentId: document.id,
        summary: `Care document uploaded: ${document.display_name}`,
      });

      await notifyCareTeam(
        admin,
        document.care_recipient_id,
        user.id,
        document.id,
        document.display_name,
        access.recipient.display_name,
      );

      return json({ document: ready });
    }

    if (action === "cancel_upload") {
      const documentId = String(payload.documentId ?? "");
      const document = await getDocument(admin, documentId);
      if (!document || document.status !== "pending") return json({ ok: true });

      if (document.uploaded_by !== user.id) {
        return json({ error: "You cannot cancel this upload." }, 403);
      }

      await admin.storage.from(BUCKET).remove([document.storage_path]);
      await admin.from("care_documents").delete().eq("id", document.id);
      return json({ ok: true });
    }

    if (action === "open") {
      const documentId = String(payload.documentId ?? "");
      const mode = String(payload.mode ?? "preview") === "download" ? "download" : "preview";
      const document = await getDocument(admin, documentId);

      if (!document || document.status !== "ready") {
        return json({ error: "Document not found." }, 404);
      }

      const access = await accessFor(admin, user.id, document.care_recipient_id);
      if (!access) return json({ error: "Document access denied." }, 403);

      const { data: signed, error: signedError } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(
          document.storage_path,
          90,
          mode === "download" ? { download: true } : undefined,
        );

      if (signedError || !signed?.signedUrl) {
        throw signedError ?? new Error("Could not create a secure file link.");
      }

      await audit(admin, {
        careRecipientId: document.care_recipient_id,
        actorUserId: user.id,
        action: mode,
        documentId: document.id,
        summary:
          mode === "download"
            ? `Care document downloaded: ${document.display_name}`
            : `Care document opened: ${document.display_name}`,
      });

      return json({
        url: signed.signedUrl,
        expiresIn: 90,
        mimeType: document.mime_type,
        name: document.original_name,
      });
    }

    if (action === "update_metadata") {
      const documentId = String(payload.documentId ?? "");
      const displayName = String(payload.displayName ?? "").trim();
      const category = String(payload.category ?? "");
      const notes = String(payload.notes ?? "").trim();
      const sourceName = String(payload.sourceName ?? "").trim();
      const documentDate = String(payload.documentDate ?? "").trim();
      const reviewDueOn = String(payload.reviewDueOn ?? "").trim();
      const isKeyDocument = Boolean(payload.isKeyDocument);
      const requiresBiometric =
        category === "advance_directive"
          ? payload.requiresBiometric !== false
          : Boolean(payload.requiresBiometric);

      const validDate = (value: string) =>
        !value || /^\d{4}-\d{2}-\d{2}$/.test(value);

      if (!validDate(documentDate) || !validDate(reviewDueOn)) {
        return json({ error: "Use YYYY-MM-DD for document dates." }, 400);
      }

      if (!displayName || !CATEGORIES.has(category)) {
        return json({ error: "Valid document name and category are required." }, 400);
      }

      const document = await getDocument(admin, documentId);
      if (!document || document.status !== "ready") {
        return json({ error: "Document not found." }, 404);
      }

      const access = await accessFor(admin, user.id, document.care_recipient_id);
      const canManage =
        access?.role === "owner" ||
        (access?.role === "caregiver" && document.uploaded_by === user.id);

      if (!canManage) {
        return json({ error: "You can only manage documents you are allowed to edit." }, 403);
      }

      const { data: updated, error } = await admin
        .from("care_documents")
        .update({
          display_name: displayName,
          category,
          notes: notes || null,
          source_name: sourceName.slice(0, 300) || null,
          document_date: documentDate || null,
          review_due_on: reviewDueOn || null,
          is_key_document: isKeyDocument,
          requires_biometric: requiresBiometric,
        })
        .eq("id", document.id)
        .select(
          "id, care_recipient_id, uploaded_by, original_name, display_name, category, mime_type, size_bytes, notes, source_name, document_date, review_due_on, is_key_document, requires_biometric, archived_at, created_at, updated_at",
        )
        .single();

      if (error) throw error;

      await audit(admin, {
        careRecipientId: document.care_recipient_id,
        actorUserId: user.id,
        action: "update",
        documentId: document.id,
        summary: `Care document details updated: ${displayName}`,
      });

      return json({ document: updated });
    }

    if (action === "share") {
      const documentId = String(payload.documentId ?? "");
      const document = await getDocument(admin, documentId);

      if (!document || document.status !== "ready") {
        return json({ error: "Document not found." }, 404);
      }

      const access = await accessFor(admin, user.id, document.care_recipient_id);
      const canShare =
        access?.role === "owner" ||
        (access?.role === "caregiver" && document.uploaded_by === user.id);

      if (document.requires_biometric) {
        return json(
          {
            error:
              "This sensitive legal document is protected by device biometrics and cannot be exposed through a share link.",
          },
          403,
        );
      }

      if (!canShare) {
        return json(
          { error: "Only the Owner or uploading Caregiver can create a share link." },
          403,
        );
      }

      const { data: signed, error: signedError } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(document.storage_path, 600);

      if (signedError || !signed?.signedUrl) {
        throw signedError ?? new Error("Could not create a secure share link.");
      }

      await audit(admin, {
        careRecipientId: document.care_recipient_id,
        actorUserId: user.id,
        action: "share_link",
        documentId: document.id,
        summary: `10-minute Care Vault share link created: ${document.display_name}`,
      });

      return json({
        url: signed.signedUrl,
        expiresIn: 600,
        name: document.display_name,
      });
    }

    if (action === "archive" || action === "restore") {
      const documentId = String(payload.documentId ?? "");
      const document = await getDocument(admin, documentId);

      if (!document || document.status !== "ready") {
        return json({ error: "Document not found." }, 404);
      }

      const access = await accessFor(admin, user.id, document.care_recipient_id);
      const canManage =
        access?.role === "owner" ||
        (access?.role === "caregiver" && document.uploaded_by === user.id);

      if (!canManage) {
        return json({ error: "You cannot archive or restore this document." }, 403);
      }

      const archivedAt =
        action === "archive" ? new Date().toISOString() : null;

      const { data: updated, error } = await admin
        .from("care_documents")
        .update({ archived_at: archivedAt })
        .eq("id", document.id)
        .select(
          "id, care_recipient_id, uploaded_by, original_name, display_name, category, mime_type, size_bytes, notes, source_name, document_date, review_due_on, is_key_document, requires_biometric, archived_at, created_at, updated_at",
        )
        .single();

      if (error) throw error;

      await audit(admin, {
        careRecipientId: document.care_recipient_id,
        actorUserId: user.id,
        action: action === "archive" ? "archive" : "restore",
        documentId: document.id,
        summary:
          action === "archive"
            ? `Care document archived: ${document.display_name}`
            : `Care document restored: ${document.display_name}`,
      });

      return json({ document: updated });
    }

    if (action === "delete") {
      const documentId = String(payload.documentId ?? "");
      const document = await getDocument(admin, documentId);

      if (!document) return json({ ok: true });

      const access = await accessFor(admin, user.id, document.care_recipient_id);
      const canDelete =
        access?.role === "owner" ||
        (access?.role === "caregiver" && document.uploaded_by === user.id);

      if (!canDelete) {
        return json({ error: "You cannot delete this document." }, 403);
      }

      const { error: storageError } = await admin.storage
        .from(BUCKET)
        .remove([document.storage_path]);

      if (storageError) throw storageError;

      const { error: deleteError } = await admin
        .from("care_documents")
        .delete()
        .eq("id", document.id);

      if (deleteError) throw deleteError;

      await audit(admin, {
        careRecipientId: document.care_recipient_id,
        actorUserId: user.id,
        action: "delete",
        documentId: document.id,
        summary: `Care document deleted: ${document.display_name}`,
      });

      return json({ ok: true });
    }

    return json({ error: "Unsupported document vault action" }, 400);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected document vault error",
      },
      500,
    );
  }
});
