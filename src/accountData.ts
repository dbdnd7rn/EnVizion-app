import { Platform, Share } from "react-native";
import { supabase } from "./supabase";

export type AccountExport = Record<string, unknown>;
export type CareRecipientExport = Record<string, unknown>;

async function invokeAccountData<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("account-data", {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function exportAccountData() {
  const result = await invokeAccountData<{ export: AccountExport }>({
    action: "export_account",
  });
  return result.export;
}

export async function exportCareRecipientData(careRecipientId: string) {
  const result = await invokeAccountData<{ export: CareRecipientExport }>({
    action: "export_care_recipient",
    careRecipientId,
  });
  return result.export;
}

export async function deleteCareRecipientData(input: {
  careRecipientId: string;
  confirmationName: string;
}) {
  await invokeAccountData({
    action: "delete_care_recipient",
    careRecipientId: input.careRecipientId,
    confirmationName: input.confirmationName,
  });
}

export async function deleteOwnAccount(input: {
  email: string;
  password: string;
  confirmation: string;
}) {
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (reauthError) {
    throw new Error("Password verification failed. Your account was not deleted.");
  }

  await invokeAccountData({
    action: "delete_account",
    email: input.email,
    password: input.password,
    confirmation: input.confirmation,
  });

  await supabase.auth.signOut({ scope: "local" });
}

export async function deliverJsonExport(
  filename: string,
  data: Record<string, unknown>,
) {
  const text = JSON.stringify(data, null, 2);

  if (Platform.OS === "web") {
    const documentRef = (globalThis as any).document;
    const urlRef = (globalThis as any).URL;
    const BlobCtor = (globalThis as any).Blob;

    if (documentRef && urlRef && BlobCtor) {
      const blob = new BlobCtor([text], { type: "application/json" });
      const url = urlRef.createObjectURL(blob);
      const anchor = documentRef.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      documentRef.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      urlRef.revokeObjectURL(url);
      return;
    }
  }

  await Share.share({
    title: filename,
    message: text,
  });
}
