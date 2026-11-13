import assert from "node:assert/strict";
import { test } from "node:test";
import { academyDay, allRecords, assignedOn } from "../src/features/academy/admin/management-rules";
const assignment={id:"example",row_version:1,group_id:"group",valid_from:"2026-06-01",valid_until:"2026-07-01",cancelled_at:null};
test("dated rosters include the start and exclude the end, future and cancelled assignments",()=>{
 assert.equal(assignedOn(assignment,"2026-05-31"),false);assert.equal(assignedOn(assignment,"2026-06-01"),true);
 assert.equal(assignedOn(assignment,"2026-07-01"),false);assert.equal(assignedOn({...assignment,cancelled_at:"2026-06-10"},"2026-06-15"),false);
 assert.equal(assignedOn({...assignment,valid_until:null},"2027-01-01"),true);
 assert.equal(academyDay(new Date("2026-06-01T23:30:00Z")),"2026-06-02");
});
test("operational rosters fetch beyond 100 and propagate failure rather than returning a partial roster",async()=>{
 const source=Array.from({length:205},(_,id)=>id); const offsets:number[]=[];
 assert.deepEqual(await allRecords(async({offset,limit})=>{offsets.push(offset);return source.slice(offset,offset+limit);}),source);
 assert.deepEqual(offsets,[0,100,200]);
 await assert.rejects(allRecords(async({offset})=>{if(offset)throw Error("unavailable");return source.slice(0,100);}),/unavailable/);
});
