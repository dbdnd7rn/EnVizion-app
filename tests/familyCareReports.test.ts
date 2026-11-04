import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFamilyReportPreview, weekStarting, shiftLocalDate } from "../src/familyReportPreview.ts";
const migration=readFileSync(new URL("../supabase/migrations/20261104124500_family_care_reports.sql",import.meta.url),"utf8");
const family=readFileSync(new URL("../src/screens/FamilyExperience.tsx",import.meta.url),"utf8");
const owner=readFileSync(new URL("../src/screens/FamilyCareReportPublisher.tsx",import.meta.url),"utf8");
const center=readFileSync(new URL("../src/screens/FamilyCommunicationScreen.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/familyReports.ts",import.meta.url),"utf8");

const dayItem={
  id:"meal-1",careRecipientId:"recipient-a",createdBy:"editor",
  title:"Lunch support",category:"meal",details:"SENSITIVE PRIVATE NOTE",
  localTime:"12:00",timezone:"Africa/Blantyre",daysOfWeek:[1,2,3,4,5,6,7],
  priority:"routine",assignedTo:null,active:true,createdAt:"2026-11-01T07:00:00Z",updatedAt:"2026-11-01T07:00:00Z",
};
const completion=(day:string)=>({
  id:"completion-"+day,careRecipientId:"recipient-a",itemId:"meal-1",completedBy:"caregiver-1",
  completedOn:day,note:"private observation",completedAt:day+"T12:30:00Z",
});
test("daily report is sourced from actual completion dates, not fictional counts",()=>{
  const result=buildFamilyReportPreview([dayItem] as any,[completion("2026-11-04")] as any,
    "daily","2026-11-04","2026-11-04");
  assert.equal(result.plannedCount,1);
  assert.equal(result.completedCount,1);
  assert.deepEqual(result.activities,[{
    date:"2026-11-04",title:"Lunch support",category:"meal",completed:true,
  }]);
});
test("weekly totals include elapsed scheduled days only, never future days",()=>{
  assert.equal(weekStarting("2026-11-04"),"2026-11-02");
  assert.equal(shiftLocalDate("2026-11-02",6),"2026-11-08");
  const result=buildFamilyReportPreview([dayItem] as any,
    [completion("2026-11-03"),completion("2026-11-04")] as any,
    "weekly","2026-11-04","2026-11-04");
  assert.equal(result.startOn,"2026-11-02");
  assert.equal(result.plannedCount,3);
  assert.equal(result.completedCount,2);
  assert.equal(result.activities.filter(x=>!x.completed).length,1);
});
test("no medication, monitoring, detail, observation note, or staff identity is shared by default",()=>{
  const privateItem={...dayItem,id:"private-med",title:"Secret medication title",category:"medication"};
  const monitorItem={...dayItem,id:"monitor-1",title:"Secret health monitor",category:"monitoring"};
  const result=buildFamilyReportPreview([dayItem,privateItem,monitorItem] as any,
    [completion("2026-11-04")] as any,"daily","2026-11-04","2026-11-04");
  assert.equal(result.activities.length,1);
  assert.doesNotMatch(JSON.stringify(result),/Secret|SENSITIVE|private observation|caregiver-1/);
  assert.throws(()=>buildFamilyReportPreview([dayItem] as any,[] as any,
    "daily","2026-11-05","2026-11-04"),/Future/);
});
test("family can only read published snapshots for an active accepted viewer membership",()=>{
  assert.match(migration,/enable row level security/);
  assert.match(migration,/published\s+and private\.can_view_care_recipient/);
  assert.match(migration,/m\.status = 'active' and m\.role = 'viewer'/);
  assert.match(migration,/private\.is_care_recipient_owner\(care_recipient_id\)/);
  assert.match(migration,/grant update \(planned_count, completed_count, activities, summary_note,/);
  assert.doesNotMatch(migration,/grant delete/i);
  assert.match(api,/\.eq\("published", true\)/);
  assert.match(api,/\.eq\("care_recipient_id", careRecipientId\)/);
  assert.doesNotMatch(api,/\.upsert\(/);
});
test("family UI separates Daily Care, Weekly Summary and Caregiver Updates",()=>{
  for(const tab of ["Daily Care","Weekly Summary","Caregiver Updates"])
    assert.ok(family.includes(tab),tab);
  assert.match(family,/loadApprovedFamilyReports/);
  assert.match(family,/report\.completed_count/);
  assert.match(family,/Not recorded as completed/);
  assert.match(center,/<FamilyCareReportPublisher \/>/);
  assert.match(owner,/canPublish=state\.accessRole==="owner"/);
  assert.match(owner,/Approve & share with family/);
  assert.match(owner,/Stop sharing this report/);
});
