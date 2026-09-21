import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Linking, Platform } from "react-native";
import {
  type DocumentCategory,
  inferDocumentMime,
} from "./documentHelpers";
import { supabase } from "./supabase";

const BUCKET = "care-documents";

export type CareDocument = {
  id: string;
  careRecipientId: string;
  uploadedBy: string | null;
  originalName: string;
  displayName: string;
  category: DocumentCategory;
  mimeType: string;
  sizeBytes: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type PickedCareDocument = {
  name: string;
  uri: string;
  mimeType: string;
  sizeBytes: number;
  asset: DocumentPicker.DocumentPickerAsset;
};

function mapDocument(row: any): CareDocument {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    uploadedBy: row.uploaded_by ?? null,
    originalName: row.original_name,
    displayName: row.display_name,
    category: row.category as DocumentCategory,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function invokeVault<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("document-vault", {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function loadCareDocuments(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_documents")
    .select(
      "id, care_recipient_id, uploaded_by, original_name, display_name, category, mime_type, size_bytes, notes, created_at, updated_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapDocument);
}

export async function pickCareDocument(): Promise<PickedCareDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const file = Platform.OS === "web" && asset.file
    ? asset.file
    : new File(asset);
  const sizeBytes = Number(asset.size ?? file.size ?? 0);
  const mimeType = inferDocumentMime(asset.name, asset.mimeType || file.type);

  return {
    name: asset.name,
    uri: asset.uri,
    mimeType,
    sizeBytes,
    asset,
  };
}

export async function uploadCareDocument(input: {
  careRecipientId: string;
  picked: PickedCareDocument;
  displayName: string;
  category: DocumentCategory;
  notes: string;
}) {
  let payload: File | Blob | ArrayBuffer;
  let sizeBytes = input.picked.sizeBytes;

  if (Platform.OS === "web" && input.picked.asset.file) {
    payload = input.picked.asset.file;
    sizeBytes = input.picked.asset.file.size;
  } else {
    const file = new File(input.picked.asset);
    payload = await file.arrayBuffer();
    sizeBytes = payload.byteLength;
  }

  if (!sizeBytes || sizeBytes > 20 * 1024 * 1024) {
    throw new Error("Files must be larger than 0 bytes and no more than 20 MB.");
  }

  const upload = await invokeVault<{
    documentId: string;
    path: string;
    token: string;
  }>({
    action: "create_upload",
    careRecipientId: input.careRecipientId,
    originalName: input.picked.name,
    displayName: input.displayName.trim() || input.picked.name,
    category: input.category,
    mimeType: input.picked.mimeType,
    sizeBytes,
    notes: input.notes.trim(),
  });

  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(upload.path, upload.token, payload, {
        contentType: input.picked.mimeType,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const result = await invokeVault<{ document: any }>({
      action: "finalize_upload",
      documentId: upload.documentId,
    });

    return mapDocument(result.document);
  } catch (error) {
    try {
      await invokeVault({
        action: "cancel_upload",
        documentId: upload.documentId,
      });
    } catch {
      // Cleanup can be retried server-side without exposing the bucket.
    }
    throw error;
  }
}

export async function openCareDocument(
  documentId: string,
  mode: "preview" | "download" = "preview",
) {
  const result = await invokeVault<{
    url: string;
    expiresIn: number;
    mimeType: string;
    name: string;
  }>({
    action: "open",
    documentId,
    mode,
  });

  await Linking.openURL(result.url);
  return result;
}

export async function updateCareDocumentMetadata(input: {
  documentId: string;
  displayName: string;
  category: DocumentCategory;
  notes: string;
}) {
  const result = await invokeVault<{ document: any }>({
    action: "update_metadata",
    documentId: input.documentId,
    displayName: input.displayName,
    category: input.category,
    notes: input.notes,
  });

  return mapDocument(result.document);
}

export async function deleteCareDocument(documentId: string) {
  await invokeVault({
    action: "delete",
    documentId,
  });
}
