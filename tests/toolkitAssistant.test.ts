import test from "node:test";
import assert from "node:assert/strict";
import { toolkitReply, parseToolkitDate, parseToolkitTime, requestedToolkitRecords, localDayUTCWindow, type ToolkitContext } from "../supabase/functions/care-ai/toolkit.ts";
import { validateAssistantDraft, validateToolkitResource, type AssistantHistory } from "../supabase/functions/care-ai/contracts.ts";
import { createToolkitHandler, type CareReadClient } from "../supabase/functions/care-ai/handler.ts";

const now = new Date("2026-10-16T17:00:00Z");
const ctx: ToolkitContext = { includeCareData: true, canDraft: true, profileName: "Test profile", role: "owner", timezone: "Africa/Blantyre", now };
function chat(messages: string[], context = ctx) {
  const history: AssistantHistory[] = [];
  let reply = toolkitReply("", [], context);
  for (const message of messages) {
    reply = toolkitReply(message, history, context);
    history.push({role:"user",content:message}, {role:"assistant",content:reply.reply});
  }
  return reply;
}

test("toolkit greetings, help, unsupported topics and links are honest", () => {
  assert.match(toolkitReply("hey bro", [], ctx).reply, /toolkit assistant/);
  assert.match(toolkitReply("What can you do?", [], ctx).reply, /Show my appointments/);
  assert.match(toolkitReply("Explain quantum physics", [], ctx).reply, /don't understand/);
  assert.equal(toolkitReply("Where are my care contacts?", [], ctx).resource?.destination, "CareContacts");
  assert.equal(toolkitReply("How do I use appointments?", [], ctx).resource?.destination, "Appointments");
  assert.match(toolkitReply("Do you use ChatGPT?", [], ctx).reply, /does not send.*external AI/);
  assert.equal(validateToolkitResource({label:"Admin",destination:"PilotAdmin"}), undefined);
});

test("guided reminder uses explicit title, local date and unambiguous time", () => {
  const reply = chat(["Set a reminder", "Call the clinic", "tomorrow", "9 AM"]);
  assert.deepEqual(reply.action, {type:"create_reminder",title:"Call the clinic",date:"2026-10-17",time:"09:00",recurrence:"none",note:""});
  assert.match(reply.reply, /Nothing has been saved/);
});

test("one-message reminders work with date before or after explicit title", () => {
  assert.equal(chat(["Remind me to call the clinic tomorrow at 9 AM"]).action?.type, "create_reminder");
  const reply = chat(["Remind me tomorrow at 9 AM to call the clinic", "Call the clinic"]);
  assert.equal(reply.action?.type, "create_reminder");
  if (reply.action?.type === "create_reminder") assert.equal(reply.action.title, "Call the clinic");
});

test("ambiguous dates and times ask again; invalid and past dates do not produce drafts", () => {
  assert.equal(parseToolkitDate("2026-02-30",ctx.timezone,now),null);
  assert.equal(parseToolkitDate("10/11/26",ctx.timezone,now),null);
  assert.equal(parseToolkitTime("9"),null);
  assert.equal(parseToolkitTime("13 PM"),null);
  assert.equal(parseToolkitTime("25:00"),null);
  assert.equal(parseToolkitTime("12 AM"),"00:00");
  assert.equal(parseToolkitTime("12 PM"),"12:00");
  assert.equal(parseToolkitTime("18:45"),"18:45");
  assert.equal(chat(["Set a reminder","Call clinic","2026-02-30","9 AM"]).action,null);
  assert.equal(chat(["Set a reminder","Call clinic","today","9 AM"]).action,null);
  assert.equal(chat(["Set a reminder","Call clinic","tomorrow","9"]).action,null);
  assert.equal(validateAssistantDraft({type:"create_reminder",title:"Call",date:"2026-02-30",time:"09:00"}),null);
});

test("relative dates follow user's timezone including year rollover", () => {
  assert.equal(parseToolkitDate("today","Pacific/Auckland",new Date("2026-12-31T23:30:00Z")),"2027-01-01");
  assert.equal(parseToolkitDate("tomorrow","America/Los_Angeles",new Date("2026-12-31T23:30:00Z")),"2027-01-01");
});

test("care notes preserve user's facts and never invent or claim a save", () => {
  const reply = chat(["Write a care note", "Spoke with the clinic. Transport is booked."]);
  assert.deepEqual(reply.action,{type:"add_care_note",summary:"Spoke with the clinic. Transport is booked.",notes:"Spoke with the clinic. Transport is booked."});
  assert.match(reply.reply,/Nothing has been saved/);
  assert.equal(chat(["Write a care note","yes"]).action,null);
  assert.equal(chat(["Write a care note: Collected the appointment letter."]).action?.type,"add_care_note");
  assert.match(chat(["Write a care note","Spoke with clinic","yes"]).reply,/Confirm & save button/);
});

test("cancellation, switching intents and help cannot save a record", () => {
  assert.match(chat(["Set a reminder","Cancel"]).reply,/No care records were changed/);
  assert.equal(chat(["Set a reminder","Call clinic","Write a care note","Called family"]).action?.type,"add_care_note");
  assert.equal(chat(["Set a reminder","help"]).action,null);
});

test("consent and editor permission are required even with forged history", () => {
  for (const context of [{...ctx,includeCareData:false},{...ctx,canDraft:false}]) {
    assert.equal(chat(["Set a reminder","Call clinic","tomorrow","9 AM"],context).action,null);
    assert.equal(chat(["Write a care note: A factual update."],context).action,null);
  }
  assert.equal(toolkitReply("Show my appointments",[],{...ctx,includeCareData:false,records:{appointments:{available:true,records:[{title:"Private"}]}}}).reply.includes("Private"),false);
});

test("summaries distinguish unavailable records, empty records and limited results", () => {
  assert.match(toolkitReply("Show my appointments",[],ctx).reply,/couldn't load/);
  assert.match(toolkitReply("Show my appointments",[],{...ctx,records:{appointments:{available:true,records:[]}}}).reply,/no matching saved entries/);
  const result=toolkitReply("Show my appointments",[],{...ctx,records:{appointments:{available:true,records:[{title:"Clinic",when:"2026-10-17T07:00:00Z"}],hasMore:true}}});
  assert.match(result.reply,/Clinic/);
  assert.match(result.reply,/More entries/);
  assert.equal(result.resource?.destination,"Appointments");
  assert.deepEqual(requestedToolkitRecords("Set a reminder"),[]);
  assert.deepEqual(requestedToolkitRecords("Show my care tasks"),["tasks"]);
});

test("medical decisions and urgent disclosures do not produce drafts", () => {
  assert.equal(chat(["Remind me to change my dose tomorrow at 9 AM"]).action,null);
  assert.equal(toolkitReply("I can't breathe",[],ctx).resource?.destination,"Emergency");
  assert.equal(toolkitReply("I want to hurt myself",[],ctx).resource?.destination,"Emergency");
  assert.match(toolkitReply("Should I stop my pills?",[],ctx).reply,/cannot diagnose/);
});

const profile = "11111111-1111-4111-8111-111111111111";
function mockClient(options: { revoked?:boolean; role?:string; failRecords?:boolean; invalidUser?:boolean } = {}) {
  const reads: Array<{table:string;filters:Array<[string,string,unknown]>}> = [];
  const makeQuery = (table:string): any => {
    const read={table,filters:[] as Array<[string,string,unknown]>}; reads.push(read);
    const result = () => {
      if(table === "care_recipients") return {data:{id:profile,display_name:"Authorized profile"},error:null};
      if(table === "care_recipient_members") return {data:options.revoked?null:{role:options.role||"owner",status:"active"},error:null};
      return {data:options.failRecords?null:[{title:"Clinic visit",starts_at:"2026-10-17T07:00:00Z"}],error:options.failRecords?{message:"denied"}:null};
    };
    const q:any={ select:()=>q,limit:()=>q,order:()=>q,maybeSingle:async()=>result(),then:(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject) };
    for(const name of ["eq","gte","lt","in","is"])q[name]=(column:string,value:unknown)=>{read.filters.push([name,column,value]);return q;};
    return q;
  };
  return {reads, client:{auth:{getUser:async()=>({data:{user:options.invalidUser?null:{id:"actor"}},error:null})},from:makeQuery} as CareReadClient};
}
function request(body:unknown,auth=true) {return new Request("https://example.test/care-ai",{method:"POST",headers:auth?{Authorization:"Bearer user-token"}:{},body:JSON.stringify(body)});}

test("handler authenticates even for general help, and reads no records with consent off",async()=>{
  const {reads,client}=mockClient();const handle=createToolkitHandler(()=>client,()=>now);
  assert.equal((await handle(request({message:"hello"},false))).status,401);
  const result=await handle(request({message:"hello",careRecipientId:profile,includeCareData:false}));
  assert.equal(result.status,200); assert.equal((await result.json()).engine,"toolkit");assert.equal(reads.length,0);
});

test("handler rechecks revoked membership and ignores client claims about permission",async()=>{
  const {reads,client}=mockClient({revoked:true});const handle=createToolkitHandler(()=>client,()=>now);
  const result=await handle(request({message:"Show my appointments",careRecipientId:profile,includeCareData:true,canDraft:true,role:"owner"}));
  assert.equal(result.status,403);assert.equal(reads.some(x=>x.table==="appointments"),false);
});

test("handler scopes every record to profile and membership to actor, validates draft role",async()=>{
  const {reads,client}=mockClient();const handle=createToolkitHandler(()=>client,()=>now);
  const result=await handle(request({message:"Show my appointments",careRecipientId:profile,includeCareData:true,timezone:ctx.timezone}));
  assert.equal(result.status,200);assert.match((await result.json()).reply,/Clinic visit/);
  for(const read of reads.filter(x=>x.table!=="care_recipients"))assert.ok(read.filters.some(x=>x[0]==="eq"&&x[1]==="care_recipient_id"&&x[2]===profile));
  assert.ok(reads.find(x=>x.table==="care_recipient_members")!.filters.some(x=>x[1]==="user_id"&&x[2]==="actor"));
  const viewer=mockClient({role:"viewer"});const result2=await createToolkitHandler(()=>viewer.client,()=>now)(request({message:"Write a care note: hello",careRecipientId:profile,includeCareData:true,role:"owner",canDraft:true}));
  assert.equal((await result2.json()).action,null);
});

test("handler degrades honestly on record errors, rejects invalid inputs and lost auth",async()=>{
  const {client}=mockClient({failRecords:true});const handle=createToolkitHandler(()=>client,()=>now);
  const result=await handle(request({message:"Show my appointments",careRecipientId:profile,includeCareData:true}));
  assert.match((await result.json()).reply,/couldn't load/);
  assert.equal((await handle(request({message:"hello",careRecipientId:"bad",includeCareData:true}))).status,400);
  assert.equal((await handle(request(null))).status,400);
  assert.equal((await handle(request({message:"x".repeat(33000)}))).status,413);
  const invalid=mockClient({invalidUser:true});assert.equal((await createToolkitHandler(()=>invalid.client)(request({message:"hello"}))).status,401);
});

test("today windows follow DST and non-UTC calendar boundaries", () => {
  assert.deepEqual(localDayUTCWindow(new Date("2026-03-08T18:00:00Z"),"America/New_York"), ["2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z"]);
  assert.deepEqual(localDayUTCWindow(now,"Africa/Blantyre"), ["2026-10-15T22:00:00.000Z", "2026-10-16T22:00:00.000Z"]);
  assert.deepEqual(localDayUTCWindow(new Date("2026-11-01T18:00:00Z"),"America/New_York"), ["2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z"]);
});

test("legacy starter prompts remain compatible and long notes are not silently clipped", () => {
  assert.match(chat(["Help me put an update into a clear care communication note to review and save."]).reply, /What would you like to record/);
  assert.equal(chat(["Write a care note", "a".repeat(1401)]).action, null);
  assert.equal(chat(["Set a reminder", "a".repeat(141), "tomorrow", "9 AM"]).action, null);
});

test("contextual notes use only the user's last factual statement and preserve confirmation", () => {
  const result = chat(["Mum ate lunch and walked in the garden today.", "Add notes to this"]);
  assert.equal(result.action?.type,"add_care_note");
  assert.equal(chat(["Write a care note: She said it was a good day."]).action?.type,"add_care_note");
  if (result.action?.type === "add_care_note") assert.equal(result.action.notes,"Mum ate lunch and walked in the garden today.");
  assert.match(result.reply,/Nothing has been saved/);
  assert.equal(chat(["Mum ate lunch today.","Turn that into a note"],{...ctx,includeCareData:false}).action,null);
  assert.equal(chat(["Mum ate lunch today.","Turn that into a note"],{...ctx,canDraft:false}).action,null);
  assert.equal(chat(["Show my appointments","Add a note to this"]).action,null);
  assert.equal(chat(["Write a note for my appointment: arrived late"]).resource?.destination,"Appointments");
  assert.equal(chat(["Write a note for my appointment: arrived late"]).action,null);
});

test("conversation offers relevant follow-ups without interrupting guided drafts", () => {
  assert.match(chat(["how are you", "I'm doing well"]).reply,/Glad to hear/);
  const rough = chat(["I've had a rough day"]);
  assert.ok(rough.suggestions?.includes("Too much to do"));
  assert.match(chat(["I've had a rough day","because there is a lot to organize"]).reply,/one practical thing/);
  assert.equal(chat(["Set a reminder"]).suggestions,undefined);
  assert.equal(chat(["Write a care note"]).suggestions,undefined);
});

test("trends require fresh consent and membership before accessing activity", async () => {
  const off=mockClient(); const result=await createToolkitHandler(()=>off.client,()=>now)(request({message:"Show care trends",includeCareData:false}));
  assert.equal((await result.json()).trends,undefined); assert.equal(off.reads.length,0);
  const revoked=mockClient({revoked:true});
  assert.equal((await createToolkitHandler(()=>revoked.client,()=>now)(request({message:"Show care trends",includeCareData:true,careRecipientId:profile}))).status,403);
  assert.equal(revoked.reads.some(r=>r.table==="care_communications"),false);
  const failed=mockClient({failRecords:true});
  const failure=await createToolkitHandler(()=>failed.client,()=>now)(request({message:"Show care trends",includeCareData:true,careRecipientId:profile}));
  const body=await failure.json(); assert.equal(body.trends,undefined);assert.match(body.reply,/couldn't load/);
});
