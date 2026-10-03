import { supabase } from "./supabase";

export type DoctorVisitStatus =
  | "prep"
  | "in_visit"
  | "review"
  | "approved"
  | "published"
  | "cancelled";

export type DoctorVisit = {
  id: string;
  careRecipientId: string;
  appointmentId: string | null;
  physicianName: string;
  specialty: string;
  appointmentDatetime: string;
  location: string;
  status: DoctorVisitStatus;
  rawNotes: string;
  transcriptText: string;
  recordingConsentConfirmed: boolean;
  recordingConsentAt: string | null;
  recordingConsentBy: string | null;
  audioPath: string | null;
  audioMimeType: string | null;
  audioSizeBytes: number | null;
  audioDurationMs: number | null;
  audioUploadedAt: string | null;
  transcriptionStatus: "none" | "queued" | "processing" | "completed" | "failed";
  transcriptionError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DoctorVisitQuestion = {
  id: string;
  visitId: string;
  careRecipientId: string;
  questionText: string;
  category: string;
  isAnswered: boolean;
  answerNotes: string;
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DoctorVisitSummary = {
  id: string;
  visitId: string;
  careRecipientId: string;
  sourceType: "manual" | "ai";
  status: "draft" | "approved" | "superseded";
  summaryText: string;
  newOrders: string[];
  actionItems: string[];
  redFlags: string[];
  generationNotes: string;
  modelName: string | null;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  updatedAt: string;
};

export type DoctorVisitBundle = {
  visit: DoctorVisit;
  questions: DoctorVisitQuestion[];
  summaries: DoctorVisitSummary[];
};

const visitFields =
  "id, care_recipient_id, appointment_id, physician_name, specialty, appointment_datetime, location, status, raw_notes, transcript_text, recording_consent_confirmed, recording_consent_at, recording_consent_by, audio_path, audio_mime_type, audio_size_bytes, audio_duration_ms, audio_uploaded_at, transcription_status, transcription_error, created_by, created_at, updated_at";

const questionFields =
  "id, visit_id, care_recipient_id, question_text, category, is_answered, answer_notes, position, created_by, created_at, updated_at";

const summaryFields =
  "id, visit_id, care_recipient_id, source_type, status, summary_text, new_orders, action_items, red_flags, generation_notes, model_name, created_by, created_at, approved_by, approved_at, updated_at";

function mapVisit(row: any): DoctorVisit {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    appointmentId: row.appointment_id ?? null,
    physicianName: row.physician_name,
    specialty: row.specialty ?? "",
    appointmentDatetime: row.appointment_datetime,
    location: row.location ?? "",
    status: row.status as DoctorVisitStatus,
    rawNotes: row.raw_notes ?? "",
    transcriptText: row.transcript_text ?? "",
    recordingConsentConfirmed: Boolean(row.recording_consent_confirmed),
    recordingConsentAt: row.recording_consent_at ?? null,
    recordingConsentBy: row.recording_consent_by ?? null,
    audioPath: row.audio_path ?? null,
    audioMimeType: row.audio_mime_type ?? null,
    audioSizeBytes:
      row.audio_size_bytes === null || row.audio_size_bytes === undefined
        ? null
        : Number(row.audio_size_bytes),
    audioDurationMs:
      row.audio_duration_ms === null || row.audio_duration_ms === undefined
        ? null
        : Number(row.audio_duration_ms),
    audioUploadedAt: row.audio_uploaded_at ?? null,
    transcriptionStatus: (row.transcription_status ?? "none") as
      | "none"
      | "queued"
      | "processing"
      | "completed"
      | "failed",
    transcriptionError: row.transcription_error ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuestion(row: any): DoctorVisitQuestion {
  return {
    id: row.id,
    visitId: row.visit_id,
    careRecipientId: row.care_recipient_id,
    questionText: row.question_text,
    category: row.category ?? "",
    isAnswered: Boolean(row.is_answered),
    answerNotes: row.answer_notes ?? "",
    position: Number(row.position ?? 0),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSummary(row: any): DoctorVisitSummary {
  return {
    id: row.id,
    visitId: row.visit_id,
    careRecipientId: row.care_recipient_id,
    sourceType: row.source_type as "manual" | "ai",
    status: row.status as "draft" | "approved" | "superseded",
    summaryText: row.summary_text ?? "",
    newOrders: Array.isArray(row.new_orders) ? row.new_orders : [],
    actionItems: Array.isArray(row.action_items) ? row.action_items : [],
    redFlags: Array.isArray(row.red_flags) ? row.red_flags : [],
    generationNotes: row.generation_notes ?? "",
    modelName: row.model_name ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    updatedAt: row.updated_at,
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

export async function loadDoctorVisitCompanion(
  careRecipientId: string,
): Promise<DoctorVisitBundle[]> {
  const { data: visits, error: visitError } = await supabase
    .from("doctor_visits")
    .select(visitFields)
    .eq("care_recipient_id", careRecipientId)
    .order("appointment_datetime", { ascending: false });

  if (visitError) throw visitError;

  const visitRows = visits ?? [];
  if (!visitRows.length) return [];

  const visitIds = visitRows.map((row) => row.id);

  const [questionResult, summaryResult] = await Promise.all([
    supabase
      .from("doctor_visit_questions")
      .select(questionFields)
      .in("visit_id", visitIds)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("doctor_visit_summaries")
      .select(summaryFields)
      .in("visit_id", visitIds)
      .order("created_at", { ascending: false }),
  ]);

  if (questionResult.error) throw questionResult.error;
  if (summaryResult.error) throw summaryResult.error;

  const questionsByVisit = new Map<string, DoctorVisitQuestion[]>();
  for (const row of questionResult.data ?? []) {
    const mapped = mapQuestion(row);
    const list = questionsByVisit.get(mapped.visitId) ?? [];
    list.push(mapped);
    questionsByVisit.set(mapped.visitId, list);
  }

  const summariesByVisit = new Map<string, DoctorVisitSummary[]>();
  for (const row of summaryResult.data ?? []) {
    const mapped = mapSummary(row);
    const list = summariesByVisit.get(mapped.visitId) ?? [];
    list.push(mapped);
    summariesByVisit.set(mapped.visitId, list);
  }

  return visitRows.map((row) => {
    const visit = mapVisit(row);
    return {
      visit,
      questions: questionsByVisit.get(visit.id) ?? [],
      summaries: summariesByVisit.get(visit.id) ?? [],
    };
  });
}

export async function createDoctorVisit(input: {
  careRecipientId: string;
  appointmentId?: string | null;
  physicianName: string;
  specialty?: string;
  appointmentDatetime: string;
  location?: string;
}) {
  const userId = await currentUserId();
  const physicianName = input.physicianName.trim();

  if (!physicianName) throw new Error("Add the clinician or physician name.");

  const { data, error } = await supabase
    .from("doctor_visits")
    .insert({
      care_recipient_id: input.careRecipientId,
      appointment_id: input.appointmentId ?? null,
      physician_name: physicianName,
      specialty: input.specialty?.trim() || null,
      appointment_datetime: input.appointmentDatetime,
      location: input.location?.trim() || null,
      status: "prep",
      created_by: userId,
    })
    .select(visitFields)
    .single();

  if (error) throw error;
  return mapVisit(data);
}

export async function updateDoctorVisitCapture(input: {
  visitId: string;
  careRecipientId: string;
  rawNotes: string;
  transcriptText: string;
  status?: DoctorVisitStatus;
}) {
  const { data, error } = await supabase
    .from("doctor_visits")
    .update({
      raw_notes: input.rawNotes.trim() || null,
      transcript_text: input.transcriptText.trim() || null,
      status: input.status ?? "in_visit",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.visitId)
    .eq("care_recipient_id", input.careRecipientId)
    .select(visitFields)
    .single();

  if (error) throw error;
  return mapVisit(data);
}

export async function setDoctorVisitRecordingConsent(input: {
  visitId: string;
  careRecipientId: string;
  confirmed: boolean;
}) {
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("doctor_visits")
    .update({
      recording_consent_confirmed: input.confirmed,
      recording_consent_at: input.confirmed ? now : null,
      recording_consent_by: input.confirmed ? userId : null,
      updated_at: now,
    })
    .eq("id", input.visitId)
    .eq("care_recipient_id", input.careRecipientId)
    .select(visitFields)
    .single();

  if (error) throw error;
  return mapVisit(data);
}

export async function addDoctorVisitQuestion(input: {
  visitId: string;
  careRecipientId: string;
  questionText: string;
  category?: string;
  position?: number;
}) {
  const userId = await currentUserId();
  const questionText = input.questionText.trim();
  if (!questionText) throw new Error("Add the question first.");

  const { data, error } = await supabase
    .from("doctor_visit_questions")
    .insert({
      visit_id: input.visitId,
      care_recipient_id: input.careRecipientId,
      question_text: questionText,
      category: input.category?.trim() || null,
      position: input.position ?? 0,
      created_by: userId,
    })
    .select(questionFields)
    .single();

  if (error) throw error;
  return mapQuestion(data);
}

export async function updateDoctorVisitQuestion(input: {
  questionId: string;
  careRecipientId: string;
  isAnswered: boolean;
  answerNotes: string;
}) {
  const { data, error } = await supabase
    .from("doctor_visit_questions")
    .update({
      is_answered: input.isAnswered,
      answer_notes: input.answerNotes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.questionId)
    .eq("care_recipient_id", input.careRecipientId)
    .select(questionFields)
    .single();

  if (error) throw error;
  return mapQuestion(data);
}

export async function deleteDoctorVisitQuestion(
  careRecipientId: string,
  questionId: string,
) {
  const { error } = await supabase
    .from("doctor_visit_questions")
    .delete()
    .eq("id", questionId)
    .eq("care_recipient_id", careRecipientId);

  if (error) throw error;
}

function cleanLines(lines: string[]) {
  return lines.map((line) => line.trim()).filter(Boolean).slice(0, 20);
}

export async function saveManualDoctorVisitSummary(input: {
  visitId: string;
  careRecipientId: string;
  summaryText: string;
  newOrders: string[];
  actionItems: string[];
  redFlags: string[];
}) {
  const userId = await currentUserId();
  const now = new Date().toISOString();

  await supabase
    .from("doctor_visit_summaries")
    .update({ status: "superseded", updated_at: now })
    .eq("visit_id", input.visitId)
    .eq("status", "draft");

  const { data, error } = await supabase
    .from("doctor_visit_summaries")
    .insert({
      visit_id: input.visitId,
      care_recipient_id: input.careRecipientId,
      source_type: "manual",
      status: "draft",
      summary_text: input.summaryText.trim() || null,
      new_orders: cleanLines(input.newOrders),
      action_items: cleanLines(input.actionItems),
      red_flags: cleanLines(input.redFlags),
      generation_notes:
        "Manual draft entered by a care-team editor. Review before approval.",
      created_by: userId,
    })
    .select(summaryFields)
    .single();

  if (error) throw error;

  await supabase
    .from("doctor_visits")
    .update({ status: "review", updated_at: now })
    .eq("id", input.visitId)
    .eq("care_recipient_id", input.careRecipientId);

  return mapSummary(data);
}

export async function generateDoctorVisitAiSummary(visitId: string) {
  const { data, error } = await supabase.functions.invoke(
    "doctor-visit-summary",
    { body: { visitId } },
  );

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.summary) throw new Error("The AI summary was not returned.");

  return mapSummary(data.summary);
}

export async function approveDoctorVisitSummary(input: {
  visitId: string;
  careRecipientId: string;
  summaryId: string;
}) {
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { error: supersedeError } = await supabase
    .from("doctor_visit_summaries")
    .update({ status: "superseded", updated_at: now })
    .eq("visit_id", input.visitId)
    .neq("id", input.summaryId)
    .neq("status", "superseded");

  if (supersedeError) throw supersedeError;

  const { data, error } = await supabase
    .from("doctor_visit_summaries")
    .update({
      status: "approved",
      approved_by: userId,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", input.summaryId)
    .eq("visit_id", input.visitId)
    .eq("care_recipient_id", input.careRecipientId)
    .select(summaryFields)
    .single();

  if (error) throw error;

  const { error: visitError } = await supabase
    .from("doctor_visits")
    .update({ status: "approved", updated_at: now })
    .eq("id", input.visitId)
    .eq("care_recipient_id", input.careRecipientId);

  if (visitError) throw visitError;
  return mapSummary(data);
}

function visitSummaryFeedBody(summary: DoctorVisitSummary) {
  const sections: string[] = [];

  if (summary.summaryText.trim()) sections.push(summary.summaryText.trim());
  if (summary.newOrders.length) {
    sections.push(
      "New orders / changes:\n" +
        summary.newOrders.map((item) => `• ${item}`).join("\n"),
    );
  }
  if (summary.actionItems.length) {
    sections.push(
      "Action items:\n" +
        summary.actionItems.map((item) => `• ${item}`).join("\n"),
    );
  }
  if (summary.redFlags.length) {
    sections.push(
      "Clinician-stated warnings:\n" +
        summary.redFlags.map((item) => `• ${item}`).join("\n"),
    );
  }

  return sections.join("\n\n").slice(0, 4000);
}

export async function publishDoctorVisitSummary(input: {
  visit: DoctorVisit;
  summary: DoctorVisitSummary;
  customMessage?: string;
}) {
  if (input.summary.status !== "approved") {
    throw new Error("Review and approve the visit summary before sharing it.");
  }

  const userId = await currentUserId();

  const { data: existing, error: existingError } = await supabase
    .from("care_family_updates")
    .select("id")
    .eq("doctor_visit_id", input.visit.id)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) {
    return { postId: existing.id as string, alreadyPublished: true };
  }

  const intro = input.customMessage?.trim();
  const body = [intro, visitSummaryFeedBody(input.summary)]
    .filter(Boolean)
    .join("\n\n");

  const { data: post, error: postError } = await supabase
    .from("care_family_updates")
    .insert({
      care_recipient_id: input.visit.careRecipientId,
      created_by: userId,
      update_type: "appointment",
      title: `Visit recap — ${input.visit.physicianName}`.slice(0, 180),
      body: body.slice(0, 4000),
      priority: "routine",
      requires_acknowledgement: false,
      doctor_visit_id: input.visit.id,
    })
    .select("id")
    .single();

  if (postError) throw postError;

  const { error: visitError } = await supabase
    .from("doctor_visits")
    .update({
      status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.visit.id)
    .eq("care_recipient_id", input.visit.careRecipientId);

  if (visitError) throw visitError;

  return { postId: post.id as string, alreadyPublished: false };
}


function audioExtension(mimeType: string, uri: string) {
  const mime = mimeType.toLowerCase();
  if (mime.includes("webm")) return "webm";
  if (mime.includes("3gpp")) return "3gp";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("aac")) return "aac";
  if (mime.includes("m4a") || mime.includes("mp4")) return "m4a";

  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1]?.toLowerCase() || "m4a";
}

export async function uploadDoctorVisitAudio(input: {
  visit: DoctorVisit;
  uri: string;
  mimeType: string;
  durationMs: number;
}) {
  if (!input.visit.recordingConsentConfirmed) {
    throw new Error("Confirm recording consent before uploading visit audio.");
  }

  const response = await fetch(input.uri);
  if (!response.ok) {
    throw new Error("The recorded audio could not be opened.");
  }

  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("The recording is empty.");

  if (bytes.byteLength > 100 * 1024 * 1024) {
    throw new Error("This recording is too large to upload.");
  }

  const extension = audioExtension(input.mimeType, input.uri);
  const path =
    `${input.visit.careRecipientId}/${input.visit.id}/${Date.now()}-visit.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("doctor-visit-audio")
    .upload(path, bytes, {
      contentType: input.mimeType || "audio/mp4",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("doctor_visits")
    .update({
      audio_path: path,
      audio_mime_type: input.mimeType || "audio/mp4",
      audio_size_bytes: bytes.byteLength,
      audio_duration_ms: Math.max(0, Math.round(input.durationMs)),
      audio_uploaded_at: now,
      transcription_status: "none",
      transcription_error: null,
      updated_at: now,
    })
    .eq("id", input.visit.id)
    .eq("care_recipient_id", input.visit.careRecipientId)
    .select(visitFields)
    .single();

  if (error) {
    await supabase.storage.from("doctor-visit-audio").remove([path]);
    throw error;
  }

  if (input.visit.audioPath && input.visit.audioPath !== path) {
    await supabase.storage
      .from("doctor-visit-audio")
      .remove([input.visit.audioPath])
      .catch(() => undefined);
  }

  return mapVisit(data);
}

export async function getDoctorVisitAudioUrl(visit: DoctorVisit) {
  if (!visit.audioPath) return null;

  const { data, error } = await supabase.storage
    .from("doctor-visit-audio")
    .createSignedUrl(visit.audioPath, 30 * 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDoctorVisitAudio(visit: DoctorVisit) {
  if (!visit.audioPath) return;

  const { error: storageError } = await supabase.storage
    .from("doctor-visit-audio")
    .remove([visit.audioPath]);

  if (storageError) throw storageError;

  const { error } = await supabase
    .from("doctor_visits")
    .update({
      audio_path: null,
      audio_mime_type: null,
      audio_size_bytes: null,
      audio_duration_ms: null,
      audio_uploaded_at: null,
      transcription_status: "none",
      transcription_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", visit.id)
    .eq("care_recipient_id", visit.careRecipientId);

  if (error) throw error;
}

export async function transcribeDoctorVisitAudio(visitId: string) {
  const { data, error } = await supabase.functions.invoke(
    "doctor-visit-transcribe",
    { body: { visitId } },
  );

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.transcriptText) {
    throw new Error("The transcription service returned no transcript.");
  }

  return String(data.transcriptText);
}
