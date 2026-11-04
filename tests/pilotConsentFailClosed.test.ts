import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { missingPilotDocumentTypes, pilotConsentMayProceed, requiredPilotDocumentTypes } from "../src/pilotConsentSafety.ts";
import type { PilotConsentState, ProgramDocument } from "../src/pilot.ts";

const current: ProgramDocument = {
  id: "doc-current", documentType: "pilot_consent", title: "Pilot consent",
  version: 2, body: "Example test document content", status: "published",
  effectiveAt: "2026-11-04T08:00:00Z", publishedAt: "2026-11-04T07:00:00Z",
  createdAt: "2026-11-03T00:00:00Z", updatedAt: "2026-11-04T07:00:00Z",
};

function state(overrides: Partial<PilotConsentState> = {}): PilotConsentState {
  return { enrolled: true, status: "active", outstanding: [], missingRequiredTypes: [], ...overrides };
}

test("only 3 distinct required types satisfy pilot participation prerequisite", () => {
  assert.deepEqual(requiredPilotDocumentTypes, ["privacy_notice", "pilot_consent", "terms_of_use"]);
  assert.deepEqual(missingPilotDocumentTypes([]), requiredPilotDocumentTypes);
  assert.deepEqual(missingPilotDocumentTypes(["privacy_notice", "privacy_notice", "terms_of_use"]), ["pilot_consent"]);
  assert.deepEqual(missingPilotDocumentTypes(["pilot_consent"]), ["privacy_notice","terms_of_use"]);
  assert.deepEqual(missingPilotDocumentTypes(["privacy_notice", "pilot_consent", "terms_of_use"]), []);
});

test("active or invited pilot account without all published forms stays blocked", () => {
  assert.equal(pilotConsentMayProceed(state({missingRequiredTypes:["privacy_notice","pilot_consent","terms_of_use"]})),false);
  assert.equal(pilotConsentMayProceed(state({status:"invited",missingRequiredTypes:["terms_of_use"]})),false);
  assert.equal(pilotConsentMayProceed(state({outstanding:[current]})),false);
  assert.equal(pilotConsentMayProceed(state({missingRequiredTypes:["privacy_notice"],outstanding:[current]})),false);
  assert.equal(pilotConsentMayProceed(state()),true);
  assert.equal(pilotConsentMayProceed(state({status:"invited"})),true);
});

test("non-pilot accounts and exited/paused accounts retain normal account access", () => {
  assert.equal(pilotConsentMayProceed(state({enrolled:false,status:null})),true);
  assert.equal(pilotConsentMayProceed(state({status:"exited"})),true);
  assert.equal(pilotConsentMayProceed(state({status:"paused"})),true);
});

test("pilot loader never confuses a Supabase authentication failure with no enrollment", () => {
  const source = readFileSync(new URL("../src/pilot.ts",import.meta.url),"utf8");
  assert.match(source, /if \(userError \|\| !user\) \{\s*throw userError \?\? new Error/);
  assert.doesNotMatch(source,/if \(userError \|\| !user\) \{\s*return \{ enrolled: false/);
  assert.match(source, /missingRequiredTypes: missingPilotDocumentTypes\(/);
  assert.match(source, /\.eq\("status", "published"\)/);
  assert.match(source, /\.or\(\x60effective_at\.is\.null,effective_at\.lte\.\$\{now\}\x60\)/);
  assert.match(source, /acceptedIds\.has\(row\.id\)/);
});

test("consent gate does not silently open an enrolled pilot without documents and rechecks on foreground", () => {
  const source = readFileSync(new URL("../src/PilotConsentGate.tsx",import.meta.url),"utf8");
  assert.match(source, /if \(pilotConsentMayProceed\(state\)\) return <>\{children\}<\/>;/);
  assert.match(source, /if \(!document && state\.missingRequiredTypes\.length > 0\)/);
  assert.match(source, /Your pilot documents are not ready yet/);
  assert.match(source, /No consent has been assumed/);
  assert.match(source, /state\.missingRequiredTypes\.map/);
  assert.match(source, /AppState\.addEventListener\("change"/);
  assert.match(source, /if \(next === "active"\) void refresh\(\)/);
  assert.match(source, /const document = state\.outstanding\[0\]/);
  assert.match(source, /await acceptProgramDocument\(document\.id\)/);
});

test("pilot administrator checks each currently effective document type rather than raw count", () => {
  const source = readFileSync(new URL("../src/screens/PilotAdminScreen.tsx",import.meta.url),"utf8");
  assert.match(source,/item\.status === "published" &&/);
  assert.match(source,/Date\.parse\(item\.effectiveAt\) <= Date\.now\(\)/);
  assert.match(source,/publishedRequiredDocumentTypes: currentDocuments\.map\(\(item\) => item\.documentType\)/);
  assert.match(source,/Invited or active pilot/);
});
