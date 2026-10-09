/** Deterministic validations for private user-selected profile portraits. */
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function profilePhotoExtension(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function validateProfilePhoto(mime: string, bytes: number): string | null {
  if (!PROFILE_PHOTO_MIME_TYPES.some((type) => type === mime)) {
    return "Please choose a JPEG, PNG, or WebP photo.";
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > PROFILE_PHOTO_MAX_BYTES) {
    return "Choose a photo smaller than 5 MB.";
  }
  return null;
}

export function isOwnProfilePhoto(path: string | null, userId: string): boolean {
  return Boolean(path && path.startsWith(userId + "/") && !path.includes(".."));
}
