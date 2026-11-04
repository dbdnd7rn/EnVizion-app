import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canReviseDoctorVisit,
  generateDoctorVisitDraftSafely,
  isDoctorVisitSummaryDirty,
  preferredDoctorVisitSummary,
  visitCaptureHasUnsavedChanges,
} from "../src/doctorVisitWorkflowHelpers.ts";
import type { DoctorVisitSummary } from "../src/doctorVisits.ts";

function mockSummary(input: Partial<DoctorVisitSummary> = {}): DoctorVisitSummary {
  return {
    id: "summary-1", visitId: "visit-1", careRecipientId: "patient-1",
    status: "draft", sourceType: "manual", summaryText: "Patient discussed symptoms.",
    newOrders: ["Follow-up blood work"], actionItems: ["Book next visit"],
    redFlags: ["Call if fever develops"], generationNotes: "", modelName: null,
    createdBy: "editor", createdAt: "2026-11-03T12:00:00Z",
    approvedBy: null, approvedAt: null, updatedAt: "2026-11-03T12:00:00Z",
    ...input,
  };
}

test("a newly revised draft is shown before an older approved recap", () => {
  const olderApproved = mockSummary({
    id: "approved-old", status: "approved", createdAt: "2026-10-30T12:00:00Z",
    summaryText: "Old recap",
  });
  const newestDraft = mockSummary({
    id: "new-draft", status: "draft", createdAt: "2026-11-04T12:00:00Z",
    summaryText: "Latest recap",
  });
  const earlierDraft = mockSummary({
    id: "previous-draft", status: "draft", createdAt: "2026-11-03T12:00:00Z",
  });
  assert.equal(preferredDoctorVisitSummary([olderApproved, earlierDraft, newestDraft])?.id, "new-draft");
  assert.equal(preferredDoctorVisitSummary([newestDraft, earlierDraft, olderApproved])?.id, "new-draft");
  assert.equal(preferredDoctorVisitSummary([olderApproved])?.id, "approved-old");
  assert.equal(preferredDoctorVisitSummary([]), null);
  assert.equal(preferredDoctorVisitSummary([mockSummary({status:"superseded"})]), null);
});

test("unsaved summary text or list edits are caught before approval or sharing", () => {
  const saved = mockSummary();
  const unchanged = {
    summaryText: "  Patient discussed symptoms. ",
    newOrders: "• Follow-up blood work",
    actionItems: "Book next visit",
    redFlags: "Call if fever develops",
  };
  assert.equal(isDoctorVisitSummaryDirty(unchanged, saved), false);
  assert.equal(isDoctorVisitSummaryDirty({...unchanged,summaryText:"Patient discussed *new* symptoms."},saved),true);
  assert.equal(isDoctorVisitSummaryDirty({...unchanged,newOrders:"Increase medication"},saved),true);
  assert.equal(isDoctorVisitSummaryDirty({...unchanged,actionItems:"No follow-up"},saved),true);
  assert.equal(isDoctorVisitSummaryDirty({...unchanged,redFlags:"No warnings"},saved),true);
  assert.equal(isDoctorVisitSummaryDirty({
    summaryText:"", newOrders:"",actionItems:"",redFlags:"",
  },null),false);
  assert.equal(isDoctorVisitSummaryDirty({
    summaryText:"New note", newOrders:"",actionItems:"",redFlags:"",
  },null),true);
});

test("notes comparison detects unsaved captures and ignores whitespace-only changes", () => {
  const visit = {rawNotes: "Clinical note", transcriptText: "Transcript"};
  assert.equal(visitCaptureHasUnsavedChanges("Clinical note","Transcript",visit),false);
  assert.equal(visitCaptureHasUnsavedChanges(" Clinical note ","Transcript ",visit),false);
  assert.equal(visitCaptureHasUnsavedChanges("New clinical note","Transcript",visit),true);
  assert.equal(visitCaptureHasUnsavedChanges("Clinical note","New transcript",visit),true);
});

test("save-before-AI is strictly sequential and failed save never invokes the AI service", async () => {
  const events: string[] = [];
  const result = await generateDoctorVisitDraftSafely({
    needsSave:true,
    save:async()=>{events.push("save-start");await Promise.resolve();events.push("save-finish");},
    generate:async()=>{events.push("generate");return "draft-success";},
  });
  assert.equal(result,"draft-success");
  assert.deepEqual(events,["save-start","save-finish","generate"]);

  let generated = false;
  await assert.rejects(generateDoctorVisitDraftSafely({
    needsSave:true,
    save:async()=>{throw new Error("Database unavailable");},
    generate:async()=>{generated=true;return "bad";},
  }),/Database unavailable/);
  assert.equal(generated,false,"AI must not see stale notes after the save fails");

  let saved = false;
  assert.equal(await generateDoctorVisitDraftSafely({
    needsSave:false,
    save:async()=>{saved=true;},
    generate:async()=> "already-saved-draft",
  }),"already-saved-draft");
  assert.equal(saved,false);
});

test("once published, a visit cannot create another summary draft that would not update the family feed",()=>{
  for(const status of ["prep","in_visit","review","approved"])assert.equal(canReviseDoctorVisit(status),true);
  assert.equal(canReviseDoctorVisit("published"),false);
  assert.equal(canReviseDoctorVisit("cancelled"),false);
});

test("Doctor Visit Companion UI invokes the safe flow and never approves or shares unsaved edits",()=>{
  const screen=readFileSync(new URL("../src/screens/DoctorVisitCompanionScreen.tsx",import.meta.url),"utf8");
  assert.match(screen,/preferredDoctorVisitSummary\(selected\.summaries\)/);
  assert.match(screen,/generateDoctorVisitDraftSafely\(\{/);
  assert.match(screen,/needsSave: unsaved/);
  assert.match(screen,/save: \(\) => updateDoctorVisitCapture\(\{/);
  assert.match(screen,/generate: \(\) => generateDoctorVisitAiSummary\(selected\.visit\.id\)/);
  assert.doesNotMatch(screen,/await saveCapture\(\);\s*\}\s*void generateAi\(\)/);
  assert.match(screen,/isDoctorVisitSummaryDirty\(summaryDraft, activeSummary\)/);
  assert.match(screen,/Unsaved summary edits/);
  assert.match(screen,/summaryHasUnsavedChanges \|\| visitIsPublished/);
  assert.match(screen,/activeSummary\?\.status !== "approved" \|\| summaryHasUnsavedChanges/);
  assert.match(screen,/setMessage\("Save your revised summary before approving/);
  assert.match(screen,/setMessage\("Save and approve your latest edits before sharing/);
  assert.match(screen,/!canReviseDoctorVisit\(selected\.visit\.status\)/);
  assert.match(screen,/status: selected\.visit\.status === "prep" \|\| selected\.visit\.status === "in_visit"/);
  assert.match(screen,/await approveDoctorVisitSummary\(\{/);
  assert.match(screen,/await publishDoctorVisitSummary\(\{/);
});

test("server-side summary approval and publishing still require approved care-scoped records",()=>{
  const backend=readFileSync(new URL("../src/doctorVisits.ts",import.meta.url),"utf8");
  assert.match(backend,/export async function approveDoctorVisitSummary/);
  assert.match(backend,/export async function publishDoctorVisitSummary/);
  assert.match(backend,/input\.summary\.status !== "approved"/);
  assert.match(backend,/\.from\("care_family_updates"\)/);
  assert.match(backend,/\.eq\("care_recipient_id", input\.visit\.careRecipientId\)/);
});
