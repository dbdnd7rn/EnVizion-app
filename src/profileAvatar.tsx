import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Image, Platform, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import {
  PROFILE_PHOTO_MIME_TYPES, isOwnProfilePhoto,
  profilePhotoExtension, validateProfilePhoto,
} from "./profileAvatarHelpers";

const BUCKET = "caregiver-avatars";
type AvatarContextValue = {
  url: string | null;
  path: string | null;
  busy: boolean;
  error: string;
  pickAndUpload: () => Promise<boolean>;
  remove: () => Promise<boolean>;
  refresh: () => Promise<void>;
};

const AvatarContext = createContext<AvatarContextValue | null>(null);

async function signedAvatarUrl(path: string): Promise<string> {
  const result = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (result.error || !result.data?.signedUrl) {
    throw result.error ?? new Error("Unable to display your profile photo.");
  }
  return result.data.signedUrl;
}

export function ProfileAvatarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [path, setPath] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!userId) {
      setPath(null);
      setUrl(null);
      setLoadedUserId(null);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
    if (queryError) throw queryError;

    const nextPath = (data?.avatar_url as string | null) || null;
    // Legacy public URLs may exist; do not try to sign them as storage keys.
    const nextUrl = nextPath
      ? /^https:\/\//.test(nextPath)
        ? nextPath
        : await signedAvatarUrl(nextPath)
      : null;
    setPath(nextPath);
    setUrl(nextUrl);
    setLoadedUserId(userId);
  }, [userId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await refresh();
        if (active) setError("");
      } catch {
        if (active) setError("Your profile photo could not be loaded.");
      }
    };
    void load();
    // Signed links expire; regenerate on return to foreground.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [refresh]);

  const pickAndUpload = useCallback(async () => {
    if (!userId || busy) return false;
    setError("");
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [...PROFILE_PHOTO_MIME_TYPES],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return false;
      const asset = picked.assets[0];
      const file = Platform.OS === "web" && asset.file
        ? asset.file
        : new ExpoFile(asset.uri);
      const mime = (asset.mimeType || file.type || "").toLowerCase();
      const validation = validateProfilePhoto(mime, file.size);
      if (validation) throw new Error(validation);
      setBusy(true);
      const data = await file.arrayBuffer();
      const dataIssue = validateProfilePhoto(mime, data.byteLength);
      if (dataIssue) throw new Error(dataIssue);
      const nextPath = `${userId}/avatar-${Date.now()}.${profilePhotoExtension(mime)}`;
      const upload = await supabase.storage.from(BUCKET).upload(nextPath, data, {
        contentType: mime,
        cacheControl: "3600",
        upsert: false,
      });
      if (upload.error) throw upload.error;
      try {
        const nextUrl = await signedAvatarUrl(nextPath);
        // The account metadata is server-authoritative; only update the avatar column.
        const saved = await supabase.from("profiles")
          .upsert({ id: userId, avatar_url: nextPath }, { onConflict: "id" });
        if (saved.error) throw saved.error;
        const previousPath = path;
        setPath(nextPath);
        setUrl(nextUrl);
        setLoadedUserId(userId);
        if (isOwnProfilePhoto(previousPath, userId)) {
          void supabase.storage.from(BUCKET).remove([previousPath]);
        }
      } catch (failure) {
        void supabase.storage.from(BUCKET).remove([nextPath]);
        throw failure;
      }
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the profile photo.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, path, userId]);

  const remove = useCallback(async () => {
    if (!userId || busy) return false;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.from("profiles")
        .update({ avatar_url: null }).eq("id", userId);
      if (result.error) throw result.error;
      const previousPath = path;
      setPath(null);
      setUrl(null);
      setLoadedUserId(userId);
      if (isOwnProfilePhoto(previousPath, userId)) {
        void supabase.storage.from(BUCKET).remove([previousPath]);
      }
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not remove the profile photo.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, path, userId]);

  const value = useMemo(() => ({
    path: loadedUserId === userId ? path : null,
    url: loadedUserId === userId ? url : null,
    busy, error, pickAndUpload, remove, refresh,
  }), [path, url, busy, error, pickAndUpload, remove, refresh, loadedUserId, userId]);

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useProfileAvatar() {
  const context = useContext(AvatarContext);
  if (!context) throw new Error("Missing ProfileAvatarProvider");
  return context;
}

export function ProfileAvatar({
  name,
  size = 60,
}: {
  name: string;
  size?: number;
}) {
  const { url } = useProfileAvatar();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      overflow: "hidden", borderWidth: 3, borderColor: "#FFFFFF",
      backgroundColor: "#F0E3F8", alignItems: "center",
      justifyContent: "center",
      shadowColor: "#672B8B", shadowOpacity: 0.12,
      shadowRadius: 10, elevation: 2,
    }}>
      {url ? (
        <Image
          source={{ uri: url }}
          accessibilityLabel={`Profile photo of ${name}`}
          style={{ width: "100%", height: "100%", borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{
          fontFamily: "DMSans_700Bold", color: "#70338F",
          fontSize: Math.max(17, Math.round(size * 0.34)),
        }}>
          {(name.trim()[0] || "C").toUpperCase()}
        </Text>
      )}
    </View>
  );
}
