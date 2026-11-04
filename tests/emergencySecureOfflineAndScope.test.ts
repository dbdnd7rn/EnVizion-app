import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMERGENCY_CHUNK_BYTES,
  clearSecureEmergencySnapshotsForUser,
  emergencySecureKey,
  readSecureEmergencySnapshot,
  splitEmergencyUtf8,
  writeSecureEmergencySnapshot,
  type EmergencySecureStore,
} from "../src/emergencySecureCache.ts";
import {
  emergencyAccessWasDenied,
  emergencyScope,
  emergencySnapshotStaleness,
  isCurrentEmergencyRequest,
} from "../src/emergencyAccessSafety.ts";

const recipientA = "a1234567-b890-4abc-9def-123456789abc";
const recipientB = "b1234567-b890-4abc-9def-123456789abc";
const userA = "c1234567-b890-4abc-9def-123456789abc";
const userB = "d1234567-b890-4abc-9def-123456789abc";

class FakeSecureStore implements EmergencySecureStore {
  readonly values = new Map<string,string>();
  failOnce: string | null = null;

  async getItemAsync(key: string) {
    assert.match(key,/^[a-zA-Z0-9._-]+$/,"SecureStore key must use native-safe characters");
    return this.values.get(key) ?? null;
  }
  async setItemAsync(key: string, value: string) {
    assert.match(key,/^[a-zA-Z0-9._-]+$/);
    assert.ok(Buffer.byteLength(value,"utf8") <= 1600, "Individual Keychain values must stay below safe limit");
    if(this.failOnce && key.includes(this.failOnce)) {
      this.failOnce=null;
      throw Error("simulated native write failure");
    }
    this.values.set(key,value);
  }
  async deleteItemAsync(key: string) {
    this.values.delete(key);
  }
}

test("SecureStore keys are valid and different users cannot read each other's cached patient record",async()=>{
  const storage=new FakeSecureStore();
  assert.match(emergencySecureKey(userA,recipientA),/^envizion\.emergency\.v2\./);
  assert.throws(()=>emergencySecureKey("unauthorized/user",recipientA));
  await writeSecureEmergencySnapshot(storage,userA,recipientA,JSON.stringify({patient:"PRIVATE-A"}));
  assert.equal(await readSecureEmergencySnapshot(storage,userA,recipientA),'{"patient":"PRIVATE-A"}');
  assert.equal(await readSecureEmergencySnapshot(storage,userB,recipientA),null);
  assert.equal(await readSecureEmergencySnapshot(storage,userA,recipientB),null);
});

test("large unicode-heavy emergency care summaries round-trip in small encrypted chunks",async()=>{
  const storage=new FakeSecureStore();
  const payload=JSON.stringify({
    allergies:"Peanut, bee venom, penicillin and latex; ".repeat(45),
    conditions:"Hypertension, chronic illness, severe respiratory disease. ".repeat(35),
    medications:Array.from({length:18},(_,i)=>({name:"Medication "+i,instructions:"Take with meals. ".repeat(19)})),
    notes:"Emergency info 🩺❤️ 薬 • ß: ".repeat(55),
  });
  assert.ok(Buffer.byteLength(payload)>7000);
  const chunks=splitEmergencyUtf8(payload);
  assert.ok(chunks.length>4);
  for(const chunk of chunks)assert.ok(Buffer.byteLength(chunk,"utf8")<=EMERGENCY_CHUNK_BYTES);
  assert.equal(chunks.join(""),payload);
  await writeSecureEmergencySnapshot(storage,userA,recipientA,payload);
  assert.equal(await readSecureEmergencySnapshot(storage,userA,recipientA),payload);
});

test("an interrupted native write leaves the previous complete offline emergency summary readable",async()=>{
  const storage=new FakeSecureStore();
  const original=JSON.stringify({allergies:"Old but complete",medications:["a","b"]});
  await writeSecureEmergencySnapshot(storage,userA,recipientA,original);
  const base=emergencySecureKey(userA,recipientA);
  const before=await storage.getItemAsync(base);
  assert.match(before??"",/"slot":"a"/);
  storage.failOnce=".b.1";
  await assert.rejects(
    writeSecureEmergencySnapshot(storage,userA,recipientA,"x".repeat(EMERGENCY_CHUNK_BYTES+500)),
    /encrypted offline snapshot could not be saved/,
  );
  assert.equal(await readSecureEmergencySnapshot(storage,userA,recipientA),original);
  assert.equal(await storage.getItemAsync(base),before);
});

test("successful replacement changes manifest only after all new pieces and deletes prior pieces",async()=>{
  const storage=new FakeSecureStore();
  await writeSecureEmergencySnapshot(storage,userA,recipientA,"old snapshot");
  const base=emergencySecureKey(userA,recipientA);
  await writeSecureEmergencySnapshot(storage,userA,recipientA,"updated snapshot");
  assert.match((await storage.getItemAsync(base))??"",/"slot":"b"/);
  assert.equal(await readSecureEmergencySnapshot(storage,userA,recipientA),"updated snapshot");
  assert.equal(await storage.getItemAsync(base+".a.0"),null);
});

test("explicit sign out clears only that account's encrypted care-recipient snapshots",async()=>{
  const storage=new FakeSecureStore();
  await writeSecureEmergencySnapshot(storage,userA,recipientA,"PRIVATE A1");
  await writeSecureEmergencySnapshot(storage,userA,recipientB,"PRIVATE A2");
  await writeSecureEmergencySnapshot(storage,userB,recipientA,"PRIVATE B1");
  await clearSecureEmergencySnapshotsForUser(storage,userA);
  assert.equal(await readSecureEmergencySnapshot(storage,userA,recipientA),null);
  assert.equal(await readSecureEmergencySnapshot(storage,userA,recipientB),null);
  assert.equal(await readSecureEmergencySnapshot(storage,userB,recipientA),"PRIVATE B1");
  assert.ok(![...storage.values.keys()].some(key=>key.includes(userA)));
});

test("late responses cannot cross care profiles, user sessions or newer refresh requests",()=>{
  const scopeA=emergencyScope(userA,recipientA);
  const scopeB=emergencyScope(userA,recipientB);
  const accountB=emergencyScope(userB,recipientA);
  assert.equal(isCurrentEmergencyRequest(scopeA,scopeA,3,3),true);
  assert.equal(isCurrentEmergencyRequest(scopeA,scopeB,3,3),false);
  assert.equal(isCurrentEmergencyRequest(scopeA,accountB,3,3),false);
  assert.equal(isCurrentEmergencyRequest(scopeA,scopeA,2,3),false);
  assert.equal(isCurrentEmergencyRequest(null,null,2,2),false);
});

test("expired or forbidden permissions must never fall through to old cached medical records",()=>{
  for(const error of [{status:401},{status:403},{status:406},{code:"42501"},{code:"PGRST301"},{code:"PGRST116"}]){
    assert.equal(emergencyAccessWasDenied(error),true);
  }
  assert.equal(emergencyAccessWasDenied({status:503}),false);
  assert.equal(emergencyAccessWasDenied(new Error("Network error")),false);
  assert.equal(emergencySnapshotStaleness("2026-10-01T00:00:00Z",new Date("2026-11-04")), 
    "This offline emergency snapshot is over 7 days old. Confirm medications, allergies, directives, and contacts before relying on it.");
  assert.equal(emergencySnapshotStaleness("2026-11-03T00:00:00Z",new Date("2026-11-04")),null);
});

test("web never persists emergency PHI in AsyncStorage; native cache is scoped to the signed-in account",()=>{
  const offline=readFileSync(new URL("../src/emergencyOffline.ts",import.meta.url),"utf8");
  const screen=readFileSync(new URL("../src/screens/EmergencyCenterScreen.tsx",import.meta.url),"utf8");
  const auth=readFileSync(new URL("../src/auth.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(offline,/AsyncStorage\.setItem\(/);
  assert.doesNotMatch(offline,/AsyncStorage\.getItem\(/);
  assert.match(offline,/AsyncStorage\.removeItem\(oldWebCacheKey\(careRecipientId\)\)/);
  assert.match(offline,/if \(Platform\.OS === "web"\) return summary/);
  assert.match(offline,/if \(Platform\.OS === "web" \|\| !userId\) return null/);
  assert.match(offline,/writeSecureEmergencySnapshot\(\s*nativeStorage, userId, careRecipientId/);
  assert.match(offline,/readSecureEmergencySnapshot\(nativeStorage, userId, careRecipientId\)/);
  assert.match(auth,/await clearEmergencyOfflineSnapshotsForUser\(session\.user\.id\)/);
  assert.match(screen,/setLoadedScope\(null\)/);
  assert.match(screen,/isCurrentEmergencyRequest\(/);
  assert.match(screen,/setCreatedShare\(null\)/);
  assert.match(screen,/currentScopeRef\.current !== requestedScope/);
  assert.match(screen,/createdShare\.careRecipientId === careRecipientId/);
  assert.match(screen,/emergencyAccessWasDenied\(error\)/);
  assert.match(screen,/loadedScope === activeScope/);
  assert.match(screen,/For privacy, browser emergency snapshots are not saved offline/);
  assert.match(screen,/Encrypted offline snapshot saved/);
});

test("PDF/QR shares retain their existing manual and time-limited flow, not unprotected permanent URLs",()=>{
  const view=readFileSync(new URL("../src/screens/EmergencyCenterScreen.tsx",import.meta.url),"utf8");
  const share=readFileSync(new URL("../supabase/functions/emergency-share/index.ts",import.meta.url),"utf8");
  assert.match(view,/buildEmergencyOnePageHtml\(criticalSummary\)/);
  assert.match(view,/<QRCode/);
  assert.match(view,/await revokeEmergencyShareLink\(shareId\)/);
  assert.match(share,/crypto\.getRandomValues\(random\)/);
  assert.match(share,/token_hash: tokenHash/);
  assert.match(share,/\.gt\("expires_at", now\)/);
  assert.match(share,/\.is\("revoked_at", null\)/);
});
