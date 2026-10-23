import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../App.tsx",import.meta.url),"utf8");
const family=readFileSync(new URL("../src/screens/FamilyExperience.tsx",import.meta.url),"utf8");
const help=readFileSync(new URL("../src/familyHelp.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../supabase/migrations/20261023204700_family_member_practical_help_offers.sql",import.meta.url),"utf8");
test("family members have their own navigation instead of unrestricted caregiver screens",()=>{
  assert.match(app,/state\.accessRole === "viewer"\) return <FamilyTabs/);
  assert.match(app,/state\.accessRole === "owner" \|\| state\.accessRole === "caregiver" \?/);
  for(const tab of ["FamilyHome","FamilyUpdates","FamilyChat","FamilyHelp"]){
    assert.match(app,new RegExp('name="'+tab+'"'));
  }
  assert.match(app,/name="FamilyAppointments"/);
});
test("family interface reuses caregiver art, fonts, Brand and animated glass elements",()=>{
  for(const marker of ["HomeJourneyArtwork","HomeGlassOrb","Brand","ProfileAvatar","Lora_500Medium","DMSans_700Bold","FamilyReveal","FamilyCard"]){
    assert.ok(family.includes(marker),marker);
  }
});
test("family UI exposes only four care-related features",()=>{
  for(const label of ["Care updates","Care Team Chat","Appointments","Offer practical help"])
    assert.ok(family.includes(label),label);
  for(const forbidden of ['n.navigate("Tracker"','n.navigate("Medications"','n.navigate("CarePlan"','n.navigate("CareTeam"'])
    assert.ok(!family.includes(forbidden),"unexpected privileged destination: "+forbidden);
});
test("family help data is profile-scoped and restricted by active role",()=>{
  assert.match(help,/\.eq\("care_recipient_id",careRecipientId\)/);
  assert.match(help,/reviewed_by:user\.id/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/m\.status = 'active' and m\.role = 'viewer'/);
  assert.match(migration,/private\.can_edit_care_recipient\(care_recipient_id\)/);
  assert.match(migration,/grant update \(status,reviewed_by,reviewed_at\)/);
  assert.doesNotMatch(migration,/grant delete\b/i);
});
test("caregivers can review offers without changing their primary navigation",()=>{
  const screen=readFileSync(new URL("../src/screens/FamilyCommunicationScreen.tsx",import.meta.url),"utf8");
  const review=readFileSync(new URL("../src/screens/FamilyHelpReviewSection.tsx",import.meta.url),"utf8");
  assert.match(screen,/<FamilyHelpReviewSection\s*\/>/);
  assert.match(review,/state\.accessRole!=="owner"&&state\.accessRole!=="caregiver"/);
  assert.match(review,/reviewFamilyHelpOffer/);
});
