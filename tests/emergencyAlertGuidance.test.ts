import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emergencyProfileCompleteness } from "../src/emergencyCenterHelpers.ts";
import {
  emergencyPreparednessItems,
  emergencyWarningSigns,
  safeEmergencyDialNumber,
  strokeBEFAST,
} from "../src/emergencyGuidanceHelpers.ts";

const screen = readFileSync(new URL("../src/screens/EmergencyCenterScreen.tsx", import.meta.url), "utf8");
const guide = readFileSync(new URL("../src/screens/EmergencyGuidanceModal.tsx", import.meta.url), "utf8");

function emptyCare() {
  return {
    profile: null,
    recipient: { displayName: "Test profile", emergencyContactName: "", emergencyContactPhone: "" },
    contacts: [], keyDocuments: [], medications: [], latestReconciliation: null,
    transitionPlan: null, transitionFollowUps: [],
  } as any;
}

test("emergency preparedness reflects the same six truthful real-data checks as the visible 0/6 indicator", () => {
  const empty = emptyCare();
  const checks = emergencyPreparednessItems(empty);
  assert.equal(checks.length,6);
  assert.deepEqual(checks.map(x=>x.key),[
    "emergency_number","primary_contact","allergies",
    "conditions","medication_review","key_documents",
  ]);
  assert.ok(checks.every(x=>!x.complete));
  assert.deepEqual(emergencyProfileCompleteness(empty),{completed:0,total:6});
  empty.profile = {
    localEmergencyNumber:"123", allergies:"Penicillin",
    importantConditions:"Hypertension",
  };
  empty.recipient = {
    displayName:"Test profile",emergencyContactName:"Test relative",emergencyContactPhone:"123456",
  };
  empty.latestReconciliation = { id:"review1" };
  empty.keyDocuments = [{ id:"document1" }];
  assert.ok(emergencyPreparednessItems(empty).every(x=>x.complete));
  assert.deepEqual(emergencyProfileCompleteness(empty),{completed:6,total:6});
  empty.profile.allergies="   ";
  assert.equal(emergencyProfileCompleteness(empty).completed,5);
});

test("saved phone numbers are displayed only if dialable; unknown country/service codes are never invented", () => {
  assert.equal(safeEmergencyDialNumber(" 911 "),"911");
  assert.equal(safeEmergencyDialNumber("+265 123 456 789"),"+265123456789");
  assert.equal(safeEmergencyDialNumber("(123) 456-7890"),"1234567890");
  assert.equal(safeEmergencyDialNumber(""),null);
  assert.equal(safeEmergencyDialNumber("emergency"),null);
  assert.equal(safeEmergencyDialNumber("12"),null);
  assert.equal(safeEmergencyDialNumber("*123#"),null);
  assert.equal(safeEmergencyDialNumber("123;456"),null);
});

test("urgent guidance has recognized warning signs and the complete B.E.F.A.S.T. reference",()=>{
  assert.ok(emergencyWarningSigns.some(x=>/breath/i.test(x.title)));
  assert.ok(emergencyWarningSigns.some(x=>/chest/i.test(x.title)));
  assert.ok(emergencyWarningSigns.some(x=>/unresponsive/i.test(x.title)));
  assert.deepEqual(strokeBEFAST.map(x=>x.letter),["B","E","F","A","S","T"]);
  assert.match(strokeBEFAST.find(x=>x.letter==="T")?.detail??"",/emergency services/);
});

test("Emergency alert always opens guidance and never invokes phone calls/editing implicitly",()=>{
  assert.match(screen,/accessibilityLabel="Emergency alert"/);
  assert.match(screen,/onPress=\{\(\) => setEmergencyGuideOpen\(true\)\}/);
  assert.match(screen,/<EmergencyGuidanceModal/);
  assert.match(screen,/visible=\{emergencyGuideOpen\}/);
  assert.match(screen,/canEdit=\{!readOnly\}/);
  assert.match(screen,/onViewContacts=\{\(\) => \{/);
  assert.doesNotMatch(screen,/callNumber\(emergencyNumber\)/);
  assert.match(guide,/<Modal[\s\S]*?visible=\{visible\}/);
  assert.match(guide,/onRequestClose=\{onClose\}/);
  assert.match(guide,/accessibilityLabel="Close emergency guidance"/);
  assert.match(guide,/if \(!dialNumber\) return/);
  assert.match(guide,/await Linking\.openURL\("tel:" \+ dialNumber\)/);
  assert.match(guide,/onPress=\{\(\) => void openPhoneDialer\(\)\}/);
  assert.match(guide,/No valid emergency service number is saved/);
  assert.match(guide,/\{canEdit && \(/);
  assert.match(guide,/EnVizion does not automatically alert or dispatch emergency responders/);
});

test("read-only family and patient users can open safety guidance with no saved emergency number",()=>{
  assert.match(screen,/state\.accessRole === "viewer" \|\| state\.accessRole === "patient"/);
  assert.match(screen,/onPress=\{\(\) => setEmergencyGuideOpen\(true\)\}/);
  assert.match(guide,/visible: boolean/);
  assert.match(guide,/canEdit: boolean/);
  assert.match(guide,/onViewContacts: \(\) => void/);
  assert.match(guide,/Contact local emergency services directly now/);
  assert.match(guide,/Use the emergency number for your location from a trusted source/);
});

test("previously decorative preparedness/review status cards now open real record explanations",()=>{
  assert.match(screen,/function SmallStatusCard\(\{/);
  assert.match(screen,/accessibilityRole="button"[\s\S]*?accessibilityLabel=\{eyebrow \+ ": " \+ value\}/);
  assert.match(screen,/onPress=\{\(\) => setReadinessPanel\(/);
  assert.match(screen,/readinessPanel === "checklist"/);
  assert.match(screen,/readinessPanel === "review"/);
  assert.match(screen,/emergencyPreparednessItems\(data\)/);
  assert.match(screen,/item\.complete \? "checkmark-circle-outline" : "ellipse-outline"/);
  for (const route of ["hospital","allergies","conditions","CareContacts","Medications","CareDocuments"]) {
    assert.ok(screen.includes(route), "readiness route "+route);
  }
  assert.match(screen,/Review the saved emergency profile/);
  assert.match(screen,/A review is not clinical certification/);
  assert.match(screen,/backgroundColor: themeBackground\(background\)/);
  assert.match(screen,/color: themeForeground\("#241B53"\)/);
  assert.match(screen,/shownProgress/);
});

test("the existing Emergency Vault, authorization, offline safety, QR and review remain unchanged",()=>{
  assert.match(screen,/loadEmergencyCenterData\(recipientId\)/);
  assert.match(screen,/saveEmergencyProfile\(\{/);
  assert.match(screen,/emergencyScope\(userId, careRecipientId\)/);
  assert.match(screen,/isCurrentEmergencyRequest\(/);
  assert.match(screen,/emergencyAccessWasDenied\(error\)/);
  assert.match(screen,/cacheEmergencyOfflineSummary\(recipientId, next, accountId\)/);
  assert.match(screen,/buildEmergencyOnePageHtml\(criticalSummary\)/);
  assert.match(screen,/await revokeEmergencyShareLink\(shareId\)/);
  assert.match(screen,/title=\{busy \? "Saving review…" : "Confirm information reviewed"\}/);
});
