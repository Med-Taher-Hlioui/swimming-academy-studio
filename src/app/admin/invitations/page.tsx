import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeading } from "../../../components/ui";
import { adminPage } from "../../../features/academy/admin/access";
import { AdminShell, Panel } from "../../../features/academy/admin/ui";
import { ParentInvitationForm } from "../../../features/academy/admin/parent-invitation-form";

async function Invitations() {
  await connection();
  const repo=await adminPage();
  const swimmers=(await repo.listSwimmers({limit:100})).filter(s=>!s.archived_at).map(s=>({id:s.id,name:s.display_name}));
  return <AdminShell section="invitations"><PageHeading title="Parent invitations" description="Issue access only after verifying the guardian relationship. A contact record never grants access."/>
    <Panel title="New verified invitation"><ParentInvitationForm swimmers={swimmers}/></Panel>
  </AdminShell>;
}
export default function Page() {
  return <Suspense fallback={<p className="p-8">Loading invitations…</p>}><Invitations/></Suspense>;
}

