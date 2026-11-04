/**
 * Native SecureStore supports small values, not a single large emergency record.
 * This adapter only accepts valid SecureStore keys and stores a multi-part snapshot.
 * A new slot is written completely before switching the manifest, so an
 * interrupted update cannot replace the last complete snapshot.
 */
export interface EmergencySecureStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const EMERGENCY_CHUNK_BYTES = 1400;
export const EMERGENCY_MAX_CHUNKS = 32;
const MAX_CACHED_RECIPIENTS = 20;

type Slot = "a" | "b";
type Manifest = { version: 2; slot: Slot; count: number };
const validId = /^[a-zA-Z0-9_-]{1,80}$/;
function ensureId(value: string): string {
  if (!validId.test(value)) throw new Error("Emergency cache requires a valid signed-in account and care profile.");
  return value;
}

export function emergencySecureKey(userId: string, careRecipientId: string): string {
  return "envizion.emergency.v2." + ensureId(userId) + "." + ensureId(careRecipientId);
}

function indexKey(userId: string) {
  return "envizion.emergency.index." + ensureId(userId);
}
function partKey(base: string, slot: Slot, index: number) {
  return base + "." + slot + "." + index;
}
function parseManifest(raw: string | null): Manifest | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const item = value as Record<string, unknown>;
      if (item.version === 2 && (item.slot === "a" || item.slot === "b") &&
        Number.isInteger(item.count) && Number(item.count) >= 1 &&
        Number(item.count) <= EMERGENCY_MAX_CHUNKS) {
        return { version: 2, slot: item.slot, count: Number(item.count) };
      }
    }
  } catch { /* Never display invalid cache entries */ }
  return null;
}

function byteWidth(character: string) {
  const cp = character.codePointAt(0) ?? 0;
  return cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
}

/** Splits at Unicode code-point boundaries; every chunk is below the iOS limit. */
export function splitEmergencyUtf8(value: string, limit = EMERGENCY_CHUNK_BYTES): string[] {
  if (!Number.isInteger(limit) || limit < 4) throw new Error("Invalid secure chunk size.");
  const chunks: string[] = [];
  let current = "";
  let size = 0;
  for (const character of value) {
    const width = byteWidth(character);
    if (size + width > limit) {
      chunks.push(current);
      current = "";
      size = 0;
    }
    current += character;
    size += width;
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function writeSecureEmergencySnapshot(
  storage: EmergencySecureStore,
  userId: string,
  recipientId: string,
  encoded: string,
): Promise<void> {
  const base = emergencySecureKey(userId, recipientId);
  const chunks = splitEmergencyUtf8(encoded);
  if (!chunks.length || chunks.length > EMERGENCY_MAX_CHUNKS) {
    throw new Error("The emergency summary is too large for secure offline storage. Reduce lengthy notes and retry.");
  }
  const previous = parseManifest(await storage.getItemAsync(base));
  // Register cleanup BEFORE writing sensitive chunks. A failed index write
  // must not create an untracked persistent emergency snapshot.
  const ids = await listEmergencyCachedRecipients(storage, userId);
  const nextIds = [recipientId, ...ids.filter(id => id !== recipientId)]
    .slice(0, MAX_CACHED_RECIPIENTS);
  await storage.setItemAsync(indexKey(userId), JSON.stringify(nextIds));
  const nextSlot: Slot = previous?.slot === "a" ? "b" : "a";
  try {
    for (let i = 0; i < chunks.length; i++) {
      await storage.setItemAsync(partKey(base, nextSlot, i), chunks[i]);
    }
    // Commit point: no partially written snapshot can become visible.
    await storage.setItemAsync(base, JSON.stringify({
      version: 2, slot: nextSlot, count: chunks.length,
    } satisfies Manifest));
  } catch {
    // Do not touch the previous committed slot on failure.
    await Promise.allSettled(chunks.map((_, i) =>
      storage.deleteItemAsync(partKey(base, nextSlot, i))));
    throw new Error("The encrypted offline snapshot could not be saved on this device.");
  }
  // Old data can be removed only after the new manifest is committed.
  if (previous) {
    await Promise.allSettled(Array.from({ length: previous.count }, (_, i) =>
      storage.deleteItemAsync(partKey(base, previous.slot, i))));
  }
  // Indexed before the commit so explicit sign-out can wipe this snapshot.
}

export async function readSecureEmergencySnapshot(
  storage: EmergencySecureStore,
  userId: string,
  recipientId: string,
): Promise<string | null> {
  const base = emergencySecureKey(userId, recipientId);
  const manifest = parseManifest(await storage.getItemAsync(base));
  if (!manifest) return null;
  const values: string[] = [];
  for (let i = 0; i < manifest.count; i++) {
    const value = await storage.getItemAsync(partKey(base, manifest.slot, i));
    if (value === null) return null;
    values.push(value);
  }
  return values.join("");
}

export async function listEmergencyCachedRecipients(
  storage: EmergencySecureStore,
  userId: string,
): Promise<string[]> {
  try {
    const raw = await storage.getItemAsync(indexKey(userId));
    const parsed: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string =>
        typeof value === "string" && validId.test(value))
        .slice(0, MAX_CACHED_RECIPIENTS)
      : [];
  } catch { return []; }
}

export async function deleteSecureEmergencySnapshot(
  storage: EmergencySecureStore,
  userId: string,
  recipientId: string,
): Promise<void> {
  const base = emergencySecureKey(userId, recipientId);
  // Remove the manifest first so no content can be read during erasure.
  await storage.deleteItemAsync(base);
  await Promise.allSettled(
    (["a", "b"] as const).flatMap(slot =>
      Array.from({ length: EMERGENCY_MAX_CHUNKS }, (_, i) =>
        storage.deleteItemAsync(partKey(base, slot, i)))),
  );
}

export async function clearSecureEmergencySnapshotsForUser(
  storage: EmergencySecureStore,
  userId: string,
): Promise<void> {
  for (const recipientId of await listEmergencyCachedRecipients(storage, userId)) {
    await deleteSecureEmergencySnapshot(storage, userId, recipientId);
  }
  await storage.deleteItemAsync(indexKey(userId));
}
