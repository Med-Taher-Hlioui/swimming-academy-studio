import assert from "node:assert/strict";
import { test } from "node:test";
import { localAdminConfig } from "../src/lib/supabase/local-admin-config";
import { readDryRun } from "../src/features/academy/admin/preview";

const env = {
  SHARK_LOCAL_ADMIN:"1",SHARK_LOCAL_SUPABASE_URL:"http://127.0.0.1:55721",
  SHARK_LOCAL_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic_test",
  SHARK_LOCAL_ACADEMY_ID:"aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
};
test("Admin configuration is opt-in and accepts only loopback and a publishable key",()=>{
  assert.equal(localAdminConfig(env)?.academy,env.SHARK_LOCAL_ACADEMY_ID);
  assert.equal(localAdminConfig({...env,SHARK_LOCAL_ADMIN:"0"}),null);
  assert.equal(localAdminConfig({...env,SHARK_LOCAL_SUPABASE_URL:"https://hosted.supabase.co"}),null);
  assert.equal(localAdminConfig({...env,SHARK_LOCAL_SUPABASE_URL:"http://127.0.0.1:55721@remote.example"}),null);
  assert.equal(localAdminConfig({...env,SHARK_LOCAL_SUPABASE_PUBLISHABLE_KEY:"sb_secret_test"}),null);
});

const base = {mode:"dry-run",billingYear:2026,mappingVersion:"2.0",appliedRows:0,sourceDigest:"a".repeat(64),
  previewDigest:"b".repeat(64),rows:4,quarantinedRows:3,reasons:{duplicate_swimmer_candidate:2,skill_level_required:3}};
test("only redacted counts and fixed reason codes reach the review display",()=>{
  assert.deepEqual(readDryRun(JSON.stringify(base)),{rows:4,accepted:1,quarantined:3,issues:[
    {category:"skill_level_required",count:3},{category:"duplicate_swimmer_candidate",count:2},
  ]});
});
test("dry-run review rejects invalid counts, non-zero applies, and arbitrary categories",()=>{
  for (const patch of [{billingYear:2025},{quarantinedRows:5},{appliedRows:1},{reasons:{"private text":1}},{reasons:{}},{reasons:{duplicate_swimmer_candidate:5}}]) {
    assert.throws(()=>readDryRun(JSON.stringify({...base,...patch})),{code:"invalid_input"});
  }
});

