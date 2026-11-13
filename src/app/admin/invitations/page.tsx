import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeading } from "../../../components/ui";
import { adminPage } from "../../../features/academy/admin/access";
import { allRecords } from "../../../features/academy/admin/management-rules";
import { mutate } from "../../../features/academy/admin/actions";
import { AdminShell, Panel, Hidden, Notice, Save } from "../../../features/academy/admin/ui";
import { ParentInvitationForm } from "../../../features/academy/admin/parent-invitation-form";

async function Invitations({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  await connection();
  const repo=await adminPage();
  const [records,invitations,query]=await Promise.all([allRecords(repo.listSwimmers),repo.listInvitations(),searchParams]);
  const swimmers=records.filter(s=>!s.archived_at).map(s=>({id:s.id,name:s.display_name}));
  return <AdminShell section="invitations"><Notice code={query.notice??""}/><PageHeading title="Parent invitations" description="Issue access only after verifying the guardian relationship. A contact record never grants access."/>
    <Panel title="New verified invitation"><ParentInvitationForm swimmers={swimmers}/></Panel>
    <div className="mt-5"><Panel title="Invitation history">{invitations.length?<ul className="grid gap-4">{invitations.map(i=><li key={i.id} className="border-b pb-3"><p>{i.recipient} · {i.role} · {i.status}</p><p className="text-sm">Expires: {i.expires_at}</p>{i.status==="pending"&&<form action={mutate.bind(null,"revokeInvitation")}><Hidden name="id" value={i.id}/><Save>Revoke invitation</Save></form>}</li>)}</ul>:<p>No invitations issued.</p>}</Panel></div>
  </AdminShell>;
}
export default function Page(props:{searchParams:Promise<Record<string,string|undefined>>}) {
  return <Suspense fallback={<p className="p-8">Loading invitations…</p>}><Invitations {...props}/></Suspense>;
}

