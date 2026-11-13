import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageHeading } from "../../../components/ui";
import { workspaceParentConfig } from "../../../lib/supabase/local-admin-config";
import { createLocalParentClient } from "../../../lib/supabase/local-admin";
import { acceptInvitation } from "../../../features/academy/parent/actions";
import { ParentNotice, ParentShell, Section } from "../../../features/academy/parent/ui";

type Props={searchParams:Promise<{notice?:string}>};
async function Invite({searchParams}:Props) {
  await connection();
  if(!workspaceParentConfig())redirect("/parent/login?notice=unavailable");
  const client=await createLocalParentClient();
  const {data}=await client.auth.getUser();
  if(!data.user?.email_confirmed_at||data.user.is_anonymous)redirect("/parent/login?intent=invite&notice=session");
  const {notice}=await searchParams;
  return <ParentShell><PageHeading title="Accept a guardian invitation" description="Use the single-use token supplied by the academy. It expires 72 hours after issue and is bound to the verified email on the invitation."/>
    <ParentNotice code={notice}/><Section title="Invitation token"><form action={acceptInvitation} className="grid max-w-lg gap-4">
      <label className="grid gap-1 text-sm font-medium">Token<input className="rounded-lg border border-slate-300 px-3 py-2" name="token" type="password" maxLength={43} minLength={43} required autoComplete="off"/></label>
      <button className="button justify-self-start">Accept invitation</button>
    </form></Section></ParentShell>;
}
export default function Page(props:Props) {
  return <Suspense fallback={<p className="p-8">Loading invitation…</p>}><Invite {...props}/></Suspense>;
}

