import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const sql = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = "supabase/migrations/20261005093458_primary_advocate_handover.sql";
const owner = "00000000-0000-0000-0000-000000000001";
const target = "00000000-0000-0000-0000-000000000002";
const stranger = "00000000-0000-0000-0000-000000000003";
const patient = "00000000-0000-0000-0000-000000000004";
const recipient = "10000000-0000-0000-0000-000000000001";
const group = "20000000-0000-0000-0000-000000000001";
let db: PGlite;

describe("Primary Advocate handover database lifecycle", () => {
before(async () => {
  db = new PGlite();
  await db.exec(sql("tests/fixtures/handoverDatabase.sql"));
  // Exercise the real membership synchronization trigger and production SQL.
  await db.exec(sql("supabase/migrations/20261004081000_sync_care_recipient_members_to_care_groups.sql"));
  await db.exec(sql(migration));
  await db.exec(sql("supabase/migrations/20261004150500_add_atomic_care_access_recertification_signoff.sql"));
});
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("begin");
  await db.query("insert into auth.users values ($1),($2),($3),($4)", [owner,target,stranger,patient]);
  await db.query("insert into care_groups(id,created_by) values($1,$2)",[group,owner]);
  await db.query("insert into care_recipients(id,owner_id,care_group_id,display_name) values($1,$2,$3,'Synthetic test profile')",[recipient,owner,group]);
  await db.query(`insert into care_recipient_members(care_recipient_id,user_id,role,status,accepted_at)
    values($1,$2,'owner','active',now()),($1,$3,'caregiver','active',now()),($1,$4,'patient','active',now())`,[recipient,owner,target,patient]);
});
afterEach(async () => { await db.exec("rollback"); });

async function call(actor: string, action: string, options: { target?: string; id?: string; fingerprint?: string; confirm?: boolean | null } = {}) {
  const result = await db.query<{ result: any }>(
    "select public.manage_care_advocate_handover($1,$2,$3,$4,$5,$6,$7) result",
    [actor,recipient,action,options.target ?? null,options.id ?? null,options.fingerprint ?? null,options.confirm ?? false]);
  return result.rows[0].result;
}
async function request() {
  const preview = await call(owner,"preview",{target});
  return call(owner,"request",{target,fingerprint:preview.fingerprint,confirm:true});
}
async function rejects(operation: () => Promise<unknown>, pattern: RegExp) {
  await db.exec("savepoint expected_failure");
  await assert.rejects(operation,pattern);
  await db.exec("rollback to savepoint expected_failure; release savepoint expected_failure");
}
async function currentOwner() { return (await db.query<{owner_id:string}>("select owner_id from care_recipients where id=$1",[recipient])).rows[0].owner_id; }

 test("handover preview and request leave ownership unchanged",async () => {
  const preview = await call(owner,"preview",{target});
  assert.equal(preview.fromUserId,owner); assert.equal(preview.toUserId,target);
  assert.match(preview.after,/Co-Caregiver/);
  const pending=await request(); assert.equal(pending.status,"pending");
  assert.equal(await currentOwner(),owner);
  assert.equal((await db.query("select * from care_audit_events where action='advocate_handover_requested'")).rows.length,1);
});
 test("accepted handover atomically transfers every ownership source and preserves patient access",async () => {
  const pending=await request();
  assert.equal((await call(target,"accept",{id:pending.id,confirm:true})).status,"accepted");
  assert.equal(await currentOwner(),target);
  assert.equal((await db.query<{created_by:string}>("select created_by from care_groups")).rows[0].created_by,target);
  const direct=(await db.query<{user_id:string;role:string}>("select user_id,role from care_recipient_members")).rows;
  assert.equal(direct.find(m=>m.user_id===owner)?.role,"caregiver");
  assert.equal(direct.find(m=>m.user_id===target)?.role,"owner");
  assert.equal(direct.find(m=>m.user_id===patient)?.role,"patient");
  const groups=(await db.query<{user_id:string;role:string}>("select user_id,role from care_group_members")).rows;
  assert.equal(groups.find(m=>m.user_id===owner)?.role,"co_caregiver");
  assert.equal(groups.find(m=>m.user_id===target)?.role,"primary_advocate");
  const reviews=(await db.query<{subject_user_id:string;days:number}>("select subject_user_id,extract(day from due_at-now())::int days from care_access_recertifications where status='scheduled'")).rows;
  assert.deepEqual(reviews,[{subject_user_id:owner,days:90}]);
  assert.equal((await db.query("select * from care_consent_events where event_type='advocate_handover_accepted'")).rows.length,1);
  assert.equal((await db.query("select * from notifications where kind='advocate_handover_accepted'")).rows.length,2);
  await rejects(()=>call(target,"accept",{id:pending.id,confirm:true}),/already closed/);
});
 test("only actual owner may initiate, even if another member is a primary advocate",async () => {
  await db.query("update care_group_members set role='primary_advocate' where user_id=$1",[target]);
  await rejects(()=>call(target,"preview",{target:owner}),/Only the current profile owner/);
});
 test("request requires confirmation and the exact current preview",async () => {
  await rejects(()=>call(owner,"request",{target}),/confirmation/);
  await rejects(()=>call(owner,"request",{target,confirm:true}),/Access changed/);
  const preview=await call(owner,"preview",{target});
  await db.query("update care_recipient_members set updated_at=now()+interval '1 second' where user_id=$1",[target]);
  await rejects(()=>call(owner,"request",{target,confirm:true,fingerprint:preview.fingerprint}),/Access changed/);
});
 test("only designated incoming advocate can accept or decline",async () => {
  const pending=await request();
  for(const actor of [owner,stranger,patient]) {
    for(const action of ["accept","decline"]) await rejects(()=>call(actor,action,{id:pending.id,confirm:true}),/designated/);
  }
  await rejects(()=>call(target,"accept",{id:pending.id}),/confirmation/);
});
 test("only outgoing advocate may cancel",async () => {
  const pending=await request();
  await rejects(()=>call(target,"cancel",{id:pending.id,confirm:true}),/designated/);
  assert.equal((await call(owner,"cancel",{id:pending.id,confirm:true})).status,"cancelled");
  assert.equal(await currentOwner(),owner);
});
 test("decline records history and leaves permissions unchanged",async () => {
  const pending=await request();
  assert.equal((await call(target,"decline",{id:pending.id,confirm:true})).status,"declined");
  assert.equal(await currentOwner(),owner);
  assert.equal((await db.query("select * from care_consent_events where event_type='advocate_handover_declined'")).rows.length,1);
});
 test("expired requests never transfer ownership and can be replaced",async () => {
  const pending=await request();
  await db.query("update care_advocate_handovers set expires_at=now()-interval '1 second' where id=$1",[pending.id]);
  assert.equal((await call(target,"accept",{id:pending.id,confirm:true})).status,"expired");
  assert.equal(await currentOwner(),owner);
  assert.equal((await request()).status,"pending");
});
 test("only one live handover per profile",async () => {
  await request(); await rejects(()=>request(),/already pending/);
});
 test("patient cannot become an advocate even with conflicting CareGroup write access",async () => {
  await db.query("update care_recipient_members set role='patient' where user_id=$1",[target]);
  await db.query("update care_group_members set role='co_caregiver',status='active' where user_id=$1",[target]);
  await rejects(()=>call(owner,"preview",{target}),/active Co-Caregiver/);
});
 test("family, invited and revoked memberships cannot receive ownership",async () => {
  for(const [role,status] of [["viewer","active"],["caregiver","invited"],["caregiver","revoked"]]) {
    await db.query("update care_recipient_members set role=$1,status=$2 where user_id=$3",[role,status,target]);
    await rejects(()=>call(owner,"preview",{target}),/active Co-Caregiver/);
  }
});
 test("CareGroup-only caregiver receives synchronized direct ownership on acceptance",async () => {
  await db.query("delete from care_recipient_members where user_id=$1",[target]);
  const pending=await request();
  await call(target,"accept",{id:pending.id,confirm:true});
  assert.equal(await currentOwner(),target);
  assert.equal((await db.query<{role:string}>("select role from care_recipient_members where user_id=$1",[target])).rows[0].role,"owner");
});
 test("revoked or changed target permissions invalidate an existing request",async () => {
  const pending=await request();
  await db.query("update care_recipient_members set status='revoked' where user_id=$1",[target]);
  await rejects(()=>call(target,"accept",{id:pending.id,confirm:true}),/active Co-Caregiver/);
  assert.equal(await currentOwner(),owner);
  await call(owner,"cancel",{id:pending.id,confirm:true});
});
 test("role restored after a change still invalidates the old fingerprint",async () => {
  const pending=await request();
  await db.query("update care_recipient_members set updated_at=now()+interval '1 second' where user_id=$1",[target]);
  await rejects(()=>call(target,"accept",{id:pending.id,confirm:true}),/Access changed/);
});
 test("handover refuses shared groups rather than changing another profile",async () => {
  await db.query("insert into care_recipients values(gen_random_uuid(),$1,$2,'Second synthetic profile',now())",[owner,group]);
  await rejects(()=>call(owner,"preview",{target}),/multiple profiles/);
});
 test("ownership and group-owner drift prevent acceptance",async () => {
  const pending=await request();
  await db.query("update care_groups set created_by=$1",[stranger]);
  await rejects(()=>call(target,"accept",{id:pending.id,confirm:true}),/inconsistent/);
  await db.query("update care_recipients set owner_id=$1",[stranger]);
  await rejects(()=>call(target,"accept",{id:pending.id,confirm:true}),/Ownership changed/);
});
 test("browser roles cannot execute either privileged handover function",async () => {
  for(const role of ["anon","authenticated"]) {
    const grants=(await db.query<{allowed:boolean}>("select has_function_privilege($1,'public.manage_care_advocate_handover(uuid,uuid,text,uuid,uuid,text,boolean)','execute') allowed",[role])).rows[0];
    assert.equal(grants.allowed,false);
    await db.exec(`set local role ${role}`);
    await rejects(()=>call(owner,"preview",{target}),/permission denied/);
    await db.exec("reset role");
  }
});
 test("RLS exposes requests only to participants and denies client writes",async () => {
  await request();
  for(const [actor,count] of [[owner,1],[target,1],[stranger,0]] as const) {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
    await db.exec("set local role authenticated");
    assert.equal((await db.query("select * from care_advocate_handovers")).rows.length,count);
    await rejects(()=>db.query("update care_advocate_handovers set status='accepted'"),/permission denied/);
    await db.exec("reset role");
  }
});
 test("client profile edits cannot reassign authorization identities",async () => {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
  await rejects(()=>db.query("update care_groups set created_by=$1",[target]),/confirmed Primary Advocate/);
  await rejects(()=>db.query("update care_recipients set care_group_id=null"),/cannot be reassigned/);
});
 test("audit failure rolls back all ownership changes",async () => {
  const pending=await request();
  await db.exec("alter table care_audit_events add constraint simulated_audit_failure check(action <> 'advocate_handover_accepted')");
  await rejects(()=>call(target,"accept",{id:pending.id,confirm:true}),/simulated_audit_failure/);
  assert.equal(await currentOwner(),owner);
  assert.equal((await db.query<{status:string}>("select status from care_advocate_handovers")).rows[0].status,"pending");
});
 test("existing recertification signoff writes its audit event under the repaired constraint",async () => {
  const review=(await db.query<{id:string}>("insert into care_access_recertifications(care_recipient_id,subject_user_id,role_snapshot,status,due_at) values($1,$2,'caregiver','due',now()) returning id",[recipient,target])).rows[0];
  await db.query("select apply_care_access_recertification($1,$2,$3,'keep',null)",[review.id,recipient,owner]);
  assert.equal((await db.query("select * from care_consent_events where event_type='access_recertified'")).rows.length,1);
});

});
