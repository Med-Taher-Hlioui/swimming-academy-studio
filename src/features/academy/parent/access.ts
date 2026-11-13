import "server-only";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createLocalParentClient } from "../../../lib/supabase/local-admin";
import { workspaceParentConfig } from "../../../lib/supabase/local-admin-config";
import { createAcademyPort } from "../backend/server";
import { academyAccess, controlled } from "../backend/access";
import { parentRepository } from "../backend/repositories";
import { AcademyError } from "../backend/validation";
import { isUuid } from "./rules";

interface Academy { id:string; name:string }
interface Session { id:string; session_date:string; starts_at:string|null; ends_at:string|null; group_name_snapshot:string; status:string }
export interface Activity {
  today:string;
  timezone:string;
  groups:{name:string;schedule_label:string|null}[];
  sessions:Session[];
  attendance:{id:string;session_date:string;group_name_snapshot:string;status:string}[];
  notes:{id:string;body:string;published_at:string}[];
}

export async function parentSession() {
  await connection();
  if (!workspaceParentConfig()) redirect("/parent/login?notice=unavailable");
  const client=await createLocalParentClient();
  const port=createAcademyPort(client);
  const actor=await controlled(port.identity);
  if (!actor?.verified) redirect("/parent/login?notice=session");
  return {client,port,actor};
}
export async function parentWorkspace(tenant:string, swimmer:string) {
  const {port,actor}=await parentSession();
  const rows=await controlled(()=>port.rows<{academy_id:string;academies:Academy}>("academy_memberships","academy_id,academies!inner(id,name)",
    {profile_id:actor.id,role:"parent",status:"active","academies.status":"active"},["academy_id"],0,100));
  if (!rows.length) redirect("/parent/login?notice=role");
  if (tenant && !isUuid(tenant)) notFound();
  const academy=tenant ? rows.find(r=>r.academy_id===tenant.toLowerCase())?.academies : rows[0].academies;
  if (!academy) notFound();
  try { await academyAccess(port,academy.id,"parent"); }
  catch (e) {
    if (e instanceof AcademyError && e.code==="unauthenticated") redirect("/parent/login?notice=session");
    if (e instanceof AcademyError && e.code==="forbidden") notFound();
    throw e;
  }
  const repo=parentRepository(port,academy.id);
  const children=await repo.listVerifiedChildren({limit:100});
  if (swimmer && !isUuid(swimmer)) notFound();
  const child=swimmer ? children.find(c=>c.id===swimmer.toLowerCase()) : children[0];
  if (swimmer && !child) notFound();
  const selection=child ? await Promise.all([
    controlled(()=>port.rpc<Activity|null>("academy_parent_activity",{p_academy:academy.id,p_swimmer:child.id})),
    repo.publishedChildDetails(child.id),
  ]) : null;
  if (child && !selection?.[0]) notFound();
  return { academies:rows.map(r=>r.academies),academy,children,child,activity:selection?.[0],details:selection?.[1] };
}

