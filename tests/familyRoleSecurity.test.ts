import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
const safe=read("../supabase/migrations/20261104143500_family_safe_read_apis.sql");
const restricted=read("../supabase/migrations/20261104144000_restrict_family_raw_data.sql");
const family=read("../src/screens/FamilyExperience.tsx");
const team=read("../src/careTeam.ts");
const appointment=read("../src/screens/CareScreens.tsx");
const onboarding=read("../src/screens/SupportScreens.tsx");
const app=read("../App.tsx");
const edge=read("../supabase/functions/care-team-admin/index.ts");
const reports=read("../src/familyReports.ts");
const help=read("../src/familyHelp.ts");

test("invitation is pending until a matching user explicitly accepts before expiry",()=>{
  assert.match(edge,/action === "pending"/);
  assert.match(edge,/\.eq\("user_id", user\.id\)/);
  assert.match(edge,/membership\.status !== "invited"/);
  assert.match(edge,/invitationExpired\(membership\.invite_expires_at\)/);
  assert.match(edge,/status: accepted \? "active" : "declined"/);
  assert.match(edge,/inviteUserByEmail\(email/);
  assert.match(edge,/existingAccount \? "sign_in" : "invitation"/);
});
test("family role is isolated to family tabs and a short allowlist of safe routes",()=>{
  assert.match(app,/state\.accessRole === "viewer"\) return <FamilyTabs/);
  for(const route of ["FamilyHome","FamilyUpdates","FamilyChat","FamilyHelp"])
    assert.match(app,new RegExp('name="'+route+'"'));
  assert.match(app,/name="FamilyAppointments"/);
  assert.doesNotMatch(family,/n\.navigate\("(?:CarePlan|Tracker|Medications|CareTasks|CareTeam)"/);
  assert.match(onboarding,/Offer practical help/);
  assert.match(onboarding,/View approved care updates/);
  assert.doesNotMatch(onboarding,/See shared appointments & tasks/);
});
test("family profile cards contain only limited fields and do not require raw patient SELECT",()=>{
  assert.match(team,/supabase\.rpc\("care_accessible_profile_cards"\)/);
  assert.match(team,/recipient\.is_owner/);
  assert.match(safe,/function private\.care_profile_cards_internal/);
  assert.match(safe,/function public\.care_accessible_profile_cards/);
  assert.match(safe,/security invoker/);
  const profileBlock=safe.split("create or replace function private.care_profile_cards_internal")[1]
    .split("create or replace function public.care_accessible_profile_cards")[0];
  assert.doesNotMatch(profileBlock,/emergency_contact|r\.notes/);
  assert.doesNotMatch(profileBlock,/r\.owner_id\s*[,)]/);
});
test("family appointment API returns only explicitly shared, safe visit fields",()=>{
  assert.match(safe,/shared_with_family boolean not null default false/);
  assert.match(safe,/a\.shared_with_family = true/);
  assert.match(safe,/private\.is_active_family_viewer\(p_recipient\)/);
  const block=safe.split("create or replace function private.family_shared_appointment_rows")[1]
    .split("create or replace function public.family_shared_appointments")[0];
  assert.doesNotMatch(block,/a\.notes|a\.user_id|appointment_questions/);
  assert.match(family,/supabase\.rpc\("family_shared_appointments"/);
  assert.doesNotMatch(family,/supabase\.from\("appointments"\)/);
  assert.match(appointment,/update\(\{shared_with_family:next\}\)/);
  assert.match(appointment,/Stop sharing this visit with family/);
  assert.match(appointment,/Preparation notes and private questions are never shared/);
});
test("all clinical reads are limited by RLS, including doctor audio and revocation",()=>{
  assert.match(restricted,/function private\.can_view_raw_care_recipient/);
  assert.match(restricted,/m\.role='patient'/);
  assert.match(restricted,/changed < 40/);
  for(const table of ["care_observations","medications","medication_records",
      "care_plan_items","care_plan_completions","care_tasks","care_task_completions",
      "doctor_visits","doctor_visit_summaries","care_documents","care_contacts",
      "care_recipients","appointments","care_audit_events"]){
    assert.ok(restricted.includes("'"+table+"'"),table);
  }
  assert.match(restricted,/alter policy doctor_visit_audio_select_shared/);
  assert.match(restricted,/alter policy care_family_updates_select_shared/);
  assert.match(restricted,/alter policy care_members_select/);
  assert.match(restricted,/alter policy family_help_offer_read/);
  assert.match(restricted,/private\.chat_is_member\(c\.care_recipient_id,\(select auth\.uid\(\)\)\)/);
  assert.match(restricted,/gm\.role in \('primary_advocate','co_caregiver'\)/);
});
test("approved summaries and practical offers remain recipient-scoped after hardening",()=>{
  assert.match(reports,/\.eq\("care_recipient_id", careRecipientId\)\.eq\("published", true\)/);
  assert.match(help,/\.eq\("care_recipient_id",careRecipientId\)/);
  assert.match(restricted,/private\.is_active_family_viewer\(care_recipient_id\)/);
});
