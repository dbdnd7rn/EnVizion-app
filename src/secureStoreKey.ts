/**
 * Expo SecureStore only accepts non-empty storage keys containing
 * ASCII letters, digits, ".", "-", and "_".
 *
 * Supabase (or future auth packages) may generate URL-like names containing
 * characters that SecureStore refuses. Keep valid historical names unchanged
 * so existing sessions continue to load. Encode other names losslessly and
 * consistently across read, write and delete.
 *
 * This transforms keys only, never the session's private value.
 */
const SAFE_SECURE_STORE_KEY = /^[A-Za-z0-9._-]+$/;
const ENCODED_PREFIX = "envizion_secure_key_";

export function secureStoreKey(key: string): string {
  if (
    key.length > 0 &&
    SAFE_SECURE_STORE_KEY.test(key) &&
    !key.startsWith(ENCODED_PREFIX)
  ) {
    return key;
  }

  // Fixed-width UTF-16 units preserve every original character (including
  // emoji and surrogate pairs) without using unavailable native hashing APIs.
  const encoded = Array.from({ length: key.length }, (_unused, index) =>
    key.charCodeAt(index).toString(16).padStart(4, "0")
  ).join("");

  return ENCODED_PREFIX + (encoded || "empty");
}
