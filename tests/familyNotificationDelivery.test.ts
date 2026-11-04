import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {notificationDestination} from "../src/notificationPresentation.ts";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const migration=read("../supabase/migrations/20261104151000_family_sharing_notifications.sql");
const family=read("../src/screens/FamilyExperience.tsx");
const app=read("../App.tsx");
const notifications=read("../src/screens/NotificationsScreen.tsx");

function item(entityType:string,kind:string="care_family_update"){
  return {audience:"caregiver" as const,entityType,kind,
    entityId:"00000000-0000-4000-8000-000000000001",readAt:null};
}

test("family notices open only family-safe destinations",()=>{
  assert.deepEqual(notificationDestination(item("family_care_report"),"viewer"),
    {route:"Main",params:{screen:"FamilyUpdates"}});
  assert.deepEqual(notificationDestination(item("care_family_update"),"viewer"),
    {route:"Main",params:{screen:"FamilyUpdates"}});
  assert.deepEqual(notificationDestination(item("family_shared_appointment"),"viewer"),
    {route:"FamilyAppointments"});
  assert.deepEqual(notificationDestination(item("family_help_offer"),"viewer"),
    {route:"Main",params:{screen:"FamilyHelp"}});
  assert.deepEqual(notificationDestination(item("care_chat"),"viewer"),
    {route:"CareTeamChat",params:{conversationId:item("care_chat").entityId}});
  for(const entityType of ["care_documents","care_task","care_shift","care_reminder","care_recipient","care_weekly_coverage_slot"]){
    assert.equal(notificationDestination(item(entityType),"viewer"),null);
  }
});
test("other roles keep existing caregiver routes without exposing them to patients",()=>{
  assert.deepEqual(notificationDestination(item("family_care_report"),"owner"),
    {route:"FamilyCommunication"});
  assert.deepEqual(notificationDestination(item("family_help_offer"),"caregiver"),
    {route:"FamilyCommunication"});
  assert.deepEqual(notificationDestination(item("family_shared_appointment"),"owner"),
    {route:"CareCalendar"});
  assert.equal(notificationDestination(item("care_task"),"patient"),null);
});
test("Family Member UI exposes notifications without adding a clinical route",()=>{
  assert.match(family,/NotificationBell onPress=\{\(\)=>n\.navigate\("Notifications"\)\}/);
  assert.match(app, /name="Notifications" component=\{themedScreen\(NotificationsScreen\)\}/);
  assert.match(notifications,/notificationDestination\(item, state\.accessRole\)/);
  assert.match(notifications,/careRole=\{state\.accessRole\}/);
});
test("report notification only on initial publication; unsharing removes older notices",()=>{
  assert.match(migration,/notify_approved_family_report/);
  assert.match(migration,/new\.published and not old\.published/);
  assert.match(migration,/old\.published and not new\.published/);
  assert.match(migration,/m\.status='active' and m\.role='viewer'/);
  assert.match(migration,/delete from public\.notifications/);
  assert.match(migration,/entity_type='family_care_report'/);
  assert.doesNotMatch(migration,/new\.summary_note/);
});
test("appointment notices require explicit sharing, and sensitive visit content is excluded",()=>{
  assert.match(migration,/new\.shared_with_family and not old\.shared_with_family/);
  assert.match(migration,/old\.shared_with_family and not new\.shared_with_family/);
  assert.match(migration,/entity_type='family_shared_appointment'/);
  assert.doesNotMatch(migration,/new\.notes|new\.location|new\.title/);
});
test("practical help offers notify caregivers, responses notify only active author",()=>{
  assert.match(migration,/new\.status='offered'/);
  assert.match(migration,/old\.status='offered'/);
  assert.match(migration,/new\.status in \('accepted','declined'\)/);
  assert.match(migration,/new\.created_by and m\.role='viewer' and m\.status='active'/);
  assert.doesNotMatch(migration,/new\.note/);
});
test("previous family and chat notices lose visibility when a membership is revoked",()=>{
  assert.match(migration,/as restrictive for select to authenticated/);
  for(const type of ["care_family_update","family_care_report","family_shared_appointment","family_help_offer","care_chat"]){
    assert.match(migration,new RegExp("when '"+type+"' then"));
  }
  assert.match(migration,/private\.is_active_family_viewer\(u\.care_recipient_id\)/);
  assert.match(migration,/private\.is_active_family_viewer\(r\.care_recipient_id\)/);
  assert.match(migration,/private\.is_active_family_viewer\(a\.care_recipient_id\)/);
  assert.match(migration,/private\.is_active_family_viewer\(h\.care_recipient_id\)/);
});
