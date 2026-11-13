import assert from "node:assert/strict";
import {test} from "node:test";
import {localParentConfig,localParentCookies} from "../src/lib/supabase/local-admin-config";
import {authDestination,invitationToken,isCurrentTerm,statusLabel} from "../src/features/academy/parent/rules";

test("Parent config is opt-in, loopback-only and isolated from Admin cookies",()=>{
  const env={SHARK_LOCAL_PARENT:"1",SHARK_LOCAL_SUPABASE_URL:"http://127.0.0.1:55821",SHARK_LOCAL_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic"};
  assert.ok(localParentConfig(env));
  assert.equal(localParentConfig({...env,SHARK_LOCAL_PARENT:"0"}),null);
  assert.equal(localParentConfig({...env,SHARK_LOCAL_SUPABASE_URL:"https://hosted.invalid"}),null);
  assert.equal(localParentConfig({...env,SHARK_LOCAL_SUPABASE_PUBLISHABLE_KEY:"sb_secret_synthetic"}),null);
  assert.equal(localParentCookies.path,"/parent");
  assert.equal(localParentCookies.httpOnly,true);
});
test("invite tokens and callback destinations are tightly bounded",()=>{
  assert.ok(invitationToken("A_-".repeat(14)+"Z"));
  assert.equal(invitationToken("A".repeat(44)),false);
  assert.equal(invitationToken("A".repeat(42)+"/"),false);
  assert.equal(authDestination("invite"),"/parent/invite");
  assert.equal(authDestination("https://example.invalid"),"/parent");
});
test("blank, unknown, and paid stay distinct without implying transactions",()=>{
  assert.equal(statusLabel(null),"Blank — no source value");
  assert.equal(statusLabel("unknown"),"Unknown");
  assert.equal(statusLabel("paid"),"Paid");
});
test("a current published term must be confirmed and within its date bounds",()=>{
  const term={lifecycle:"confirmed",starts_on:"2026-06-01",ends_before:"2026-11-01"};
  assert.ok(isCurrentTerm(term,"2026-06-01"));
  assert.equal(isCurrentTerm(term,"2026-11-01"),false);
  assert.equal(isCurrentTerm({...term,lifecycle:"review"},"2026-06-01"),false);
});
