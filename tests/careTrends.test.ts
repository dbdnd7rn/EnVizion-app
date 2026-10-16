import test from "node:test";
import assert from "node:assert/strict";
import { loadTrends, type CareReadClient } from "../supabase/functions/care-ai/handler.ts";
import { validateCareTrends } from "../supabase/functions/care-ai/contracts.ts";

function clientWithRows(rows: Record<string,unknown>[], failed=false) {
  const filters: unknown[][]=[];
  const client={from(table:string) {
    const q:any={select:()=>q,order:()=>q,limit:()=>q,then:(resolve:any)=>Promise.resolve({data:rows,error:failed?"error":null}).then(resolve)};
    for(const op of ["eq","gte","lt"]) q[op]=(column:string,value:unknown)=>{filters.push([table,op,column,value]);return q;};
    return q;
  }} as unknown as CareReadClient;
  return {client,filters};
}
test("activity charts count records by local day and query exact DST-aware start",async()=>{
  const {client,filters}=clientWithRows([{occurred_at:"2026-03-08T04:30:00Z",completed_at:"2026-03-08T05:30:00Z"}]);
  const data=await loadTrends(client,"profile",new Date("2026-03-10T12:00:00Z"),"America/New_York");
  assert.ok(data); assert.equal(data.days.length,7);
  assert.equal(data.days.find(d=>d.date==="2026-03-07")?.notes,1);
  assert.equal(data.days.find(d=>d.date==="2026-03-08")?.completedReminders,1);
  assert.ok(filters.some(f=>f[1]==="gte"&&f[3]==="2026-03-04T05:00:00.000Z"));
  assert.equal(filters.filter(f=>f[1]==="eq"&&f[2]==="care_recipient_id"&&f[3]==="profile").length,2);
  assert.deepEqual(validateCareTrends(data),data);
});
test("zero activity is distinct from unavailable or truncated activity",async()=>{
  const now=new Date("2026-10-16T18:00:00Z");
  const empty=await loadTrends(clientWithRows([]).client,"profile",now,"Africa/Johannesburg");
  assert.ok(empty);assert.equal(empty.days.reduce((s,d)=>s+d.notes+d.completedReminders,0),0);
  assert.equal(await loadTrends(clientWithRows([],true).client,"profile",now,"UTC"),undefined);
  assert.equal(await loadTrends(clientWithRows(Array(1000).fill({})).client,"profile",now,"UTC"),undefined);
  assert.equal(validateCareTrends({...empty,days:Array(7).fill(null)}),undefined);
  assert.equal(validateCareTrends({...empty,days:empty.days.map(d=>({...d,notes:-1}))}),undefined);
});
