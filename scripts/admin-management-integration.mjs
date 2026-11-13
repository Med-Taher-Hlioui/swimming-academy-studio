// Local-only integration: caller provides synthetic fixture identities; never accepts a hosted URL.
import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";
const f=JSON.parse(process.env.SHARK_MANAGEMENT_FIXTURES??"{}");
assert.match(f.url??"",/^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(f.admin?.email.endsWith("@example.test")&&f.parent?.email.endsWith("@example.test"));
const make=()=>createClient(f.url,f.key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=make(),parent=make();
assert.equal((await admin.auth.signInWithPassword(f.admin)).error,null);assert.equal((await parent.auth.signInWithPassword(f.parent)).error,null);
async function rpc(name,args={}) {const r=await admin.rpc('academy_'+name,{p_academy:f.academy,...args});assert.equal(r.error,null,name);return r.data;}
const run=Date.now().toString(36), today=new Date().toISOString().slice(0,10);
const coach=await rpc('save_coach',{p_name:'Synthetic Capacity Coach '+run});
const group=await rpc('save_group',{p_name:'Synthetic Capacity Group '+run,p_level:'beginner',p_capacity:1});
const secondGroup=await rpc('save_group',{p_name:'Synthetic Second Group '+run,p_level:'beginner',p_capacity:2});
await rpc('assign_coach',{p_group:secondGroup,p_coach:coach,p_from:today,p_primary:true});
const a=await rpc('save_swimmer',{p_name:'Synthetic Capacity A '+run,p_level:'beginner'});
const b=await rpc('save_swimmer',{p_name:'Synthetic Capacity B '+run,p_level:'beginner'});
await rpc('assign_coach',{p_group:group,p_coach:coach,p_from:today,p_primary:true});
const supporting=await rpc('save_coach',{p_name:'Synthetic Supporting Coach '+run});
await rpc('assign_coach',{p_group:group,p_coach:supporting,p_from:today,p_primary:false});
await rpc('transfer_swimmer',{p_swimmer:a,p_group:group,p_from:today});
assert.ok((await admin.rpc('academy_transfer_swimmer',{p_academy:f.academy,p_swimmer:b,p_group:group,p_from:today})).error,'Capacity must reject the second swimmer');
assert.ok((await admin.rpc('academy_assign_coach',{p_academy:f.academy,p_group:group,p_coach:coach,p_from:today,p_primary:true})).error,'Overlapping coach assignment must be rejected');
assert.ok((await parent.rpc('academy_save_coach',{p_academy:f.academy,p_name:'Denied'})).error);
assert.ok((await parent.rpc('academy_assign_coach',{p_academy:f.academy,p_group:group,p_coach:coach,p_from:today})).error);
// The fixture Admin belongs to both academies. Cross-tenant references must still fail.
const foreign=await admin.rpc('academy_save_coach',{p_academy:f.otherAcademy,p_name:'Synthetic Foreign Coach '+run});assert.equal(foreign.error,null);
assert.ok((await admin.rpc('academy_assign_coach',{p_academy:f.academy,p_group:group,p_coach:foreign.data,p_from:today})).error);
assert.ok((await parent.rpc('academy_save_coach',{p_academy:f.otherAcademy,p_name:'Denied'})).error);
assert.deepEqual((await parent.from('coaches').select('id').eq('academy_id',f.otherAcademy)).data,[]);
const stale=await admin.rpc('academy_save_coach',{p_academy:f.academy,p_id:coach,p_expected:999,p_name:'Stale'});assert.ok(stale.error);
await admin.auth.signOut();await parent.auth.signOut();
console.log('PASS local database capacity, overlapping assignments, stale versions, Parent mutation denial and tenant isolation');
