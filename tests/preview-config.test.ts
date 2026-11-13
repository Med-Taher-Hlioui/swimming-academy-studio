import assert from "node:assert/strict";
import {test} from "node:test";
import {previewBranch,workspaceAdminConfig,workspaceCookies,workspaceParentConfig} from "../src/lib/supabase/local-admin-config";
const preview={VERCEL:"1",VERCEL_ENV:"preview",VERCEL_TARGET_ENV:"preview",VERCEL_GIT_COMMIT_REF:previewBranch,
  SHARK_PREVIEW_ENABLED:"1",SHARK_PREVIEW_SUPABASE_URL:"https://dzepxtynubzhwmcezvvp.supabase.co",
  SHARK_PREVIEW_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",SHARK_PREVIEW_ACADEMY_ID:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"};
test("only the designated standard Vercel Preview branch gets the development backend",()=>{
  assert.equal(workspaceAdminConfig(preview)?.academy,preview.SHARK_PREVIEW_ACADEMY_ID);
  assert.ok(workspaceParentConfig(preview));
  for (const patch of [{VERCEL:""},{VERCEL_ENV:"production"},{VERCEL_GIT_COMMIT_REF:"main"},{VERCEL_TARGET_ENV:"other"},
    {SHARK_PREVIEW_ENABLED:"0"},{SHARK_PREVIEW_SUPABASE_URL:"https://unrelated.supabase.co"},
    {SHARK_PREVIEW_SUPABASE_PUBLISHABLE_KEY:"sb_secret_fixture"},{SHARK_PREVIEW_SUPABASE_PUBLISHABLE_KEY:""}]) {
    assert.equal(workspaceAdminConfig({...preview,...patch}),null);
    assert.equal(workspaceParentConfig({...preview,...patch}),null);
  }
  assert.equal(workspaceAdminConfig({...preview,SHARK_PREVIEW_ACADEMY_ID:"invalid"}),null);
});
test("cloud runtimes never fall back to loopback and Preview cookies are Secure and role-scoped",()=>{
  const local={SHARK_LOCAL_ADMIN:"1",SHARK_LOCAL_PARENT:"1",SHARK_LOCAL_SUPABASE_URL:"http://127.0.0.1:54321",
    SHARK_LOCAL_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",SHARK_LOCAL_ACADEMY_ID:preview.SHARK_PREVIEW_ACADEMY_ID};
  assert.ok(workspaceAdminConfig(local));
  assert.ok(workspaceParentConfig(local));
  assert.equal(workspaceParentConfig({...local,VERCEL:"1"}),null);
  assert.equal(workspaceAdminConfig({...local,VERCEL_ENV:"production"}),null);
  assert.deepEqual(workspaceCookies("parent",preview),{path:"/parent",name:"shark-preview-parent",sameSite:"lax",httpOnly:true,secure:true});
  assert.equal(workspaceCookies("admin",preview).path,"/admin");
  assert.equal(workspaceCookies("admin",local).secure,false);
});
