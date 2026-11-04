import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requiredPilotDocumentTypes, missingPilotDocumentTypes } from "../src/pilotConsentSafety.ts";

const validation = readFileSync(new URL("../supabase/functions/launch-validation/index.ts", import.meta.url), "utf8");
const admin = readFileSync(new URL("../supabase/functions/launch-admin/index.ts", import.meta.url), "utf8");

test("client, pilot-validation and launch-signoff enforce the same three distinct required document types", () => {
  const required = ["privacy_notice", "pilot_consent", "terms_of_use"];
  assert.deepEqual(requiredPilotDocumentTypes, required);
  for (const edge of [validation, admin]) {
    assert.match(edge, /const required(?:Pilot)?DocumentTypes = \[/);
    for (const type of required) assert.match(edge, new RegExp('"' + type + '"'));
    assert.match(edge, /missing(?:Required)?DocumentTypes = required(?:Pilot)?DocumentTypes\.filter/);
  }
  assert.deepEqual(missingPilotDocumentTypes([]), required);
  assert.deepEqual(missingPilotDocumentTypes(["privacy_notice","privacy_notice","terms_of_use"]), ["pilot_consent"]);
  assert.deepEqual(missingPilotDocumentTypes(required), []);
});

test("pilot validation denies incomplete consent when no documents or a document type is missing", () => {
  assert.match(validation, /\.from\("program_documents"\)\s*\.select\("id, document_type"\)/);
  assert.match(validation, /const publishedTypes = new Set\(\(docs \?\? \[\]\)\.map/);
  assert.match(validation, /if \(missingRequiredTypes\.length \|\| !documentIds\.length\) \{/);
  assert.match(validation, /consentCurrent: false/);
  assert.doesNotMatch(validation, /if \(!documentIds\.length\) \{[\s\S]*?consentCurrent: true/);
  assert.match(validation, /documentIds\.every\(\(id: string\) => acceptedIds\.has\(id\)\)/);
  assert.match(validation, /if \(!context\.consentCurrent\) \{/);
  assert.match(validation, /return json\(\{ error: "Required pilot documents must be accepted first" \}, 403\)/);
});

test("launch admin cannot mark missing/duplicate document types as completed pilot consent", () => {
  assert.match(admin, /\.from\("program_documents"\)\s*\.select\("id, document_type"\)/);
  assert.match(admin, /if \(!userIds\.length \|\| !documentIds\.length\) return 0/);
  assert.doesNotMatch(admin, /if \(!documentIds\.length\) return userIds\.length/);
  assert.match(admin, /const missingDocumentTypes = requiredDocumentTypes\.filter\(/);
  assert.match(admin, /const consentComplete = missingDocumentTypes\.length\s*\? 0\s*: await consentCompletionCount/);
  assert.match(admin, /for \(const type of missingDocumentTypes\) \{\s*blockers\.push/);
  assert.match(admin, /if \(signoffStatus === "approved" && gate\.blockers\.length\)/);
  assert.match(admin, /error: "Launch blockers remain"/);
});

test("server-side role/session/pilot checks and acceptance proof remain mandatory",()=>{
  for(const source of [validation,admin]) {
    assert.match(source, /service_session_is_active/);
    assert.match(source, /auth\.getUser\(token\)/);
  }
  assert.match(validation, /const context = await pilotContext\(admin, user\.id\)/);
  assert.match(validation, /if \(!context\.active\) return json/);
  assert.match(validation, /const membership = await activeMembership/);
  assert.match(validation, /if \(!allTrue\(steps, roleSteps\[run\.role\] \?\? \[\]\)\)/);
  assert.match(validation, /if \(!allTrue\(deviceChecks, platformDeviceChecks\[run\.platform\] \?\? commonDeviceChecks\)\)/);
  assert.match(admin, /pilot_launch_signoffs/);
  assert.match(admin, /readiness_snapshot: snapshot/);
});
