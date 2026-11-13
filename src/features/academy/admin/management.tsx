import Link from "next/link";
import { PageHeading } from "../../../components/ui";
import type { CoachRow, Assignment } from "../backend/contracts";
import { mutate } from "./actions";
import { allRecords, academyDay, assignedOn } from "./management-rules";
import { Check, Hidden, Input, Panel, Save, Select } from "./ui";
import { buttons, formClass, queryId, type Query, type Repo } from "./view-helpers";

export function EndAssignment({row,kind,group,coach,back="groups"}:{row:Assignment;kind:"coach"|"swimmer";group?:string;coach?:string;back?:"groups"|"coaches"}) {
  return <form action={mutate.bind(null,"endAssignment")} className="mt-2 flex flex-wrap items-end gap-3">
    <Hidden name="id" value={row.id}/><Hidden name="version" value={row.row_version}/><Hidden name="kind" value={kind}/><Hidden name="group" value={group}/><Hidden name="coach" value={coach}/><Hidden name="return" value={back}/>
    <Input label="End assignment before" name="until" type="date" required/><Save>End assignment</Save>
  </form>;
}
export function AssignCoach({coaches,groups,coach,group,back}:{coaches:CoachRow[];groups:{id:string;name:string;archived_at:string|null}[];coach?:string;group?:string;back:"groups"|"coaches"}) {
  return <form action={mutate.bind(null,"assignCoach")} className={formClass}>
    <Hidden name="return" value={back}/>
    <Select label="Coach" name="coach" value={coach} required options={[["","Choose coach"],...coaches.filter(c=>!c.archived_at).map(c=>[c.id,c.display_name] as const)]}/>
    <Select label="Coach training group" name="group" value={group} required options={[["","Choose group"],...groups.filter(g=>!g.archived_at).map(g=>[g.id,g.name] as const)]}/>
    <Input label="Coach assignment starts" name="from" type="date" required/><Input label="Coach assignment ends before" name="until" type="date"/>
    <Check label="Primary coach" name="primary"/><p className="text-xs text-slate-600">A dated session requires exactly one primary coach. End the previous assignment before replacing it. Existing session snapshots remain unchanged.</p><Save>Assign coach</Save>
  </form>;
}
function CoachForm({coach}:{coach?:CoachRow}) {
  return <form action={mutate.bind(null,"coach")} className={formClass}>
    <Hidden name="id" value={coach?.id}/><Hidden name="version" value={coach?.row_version}/>
    <Input label="Coach name" name="name" value={coach?.display_name} required maxLength={160}/>
    {coach&&<Check label="Archive coach" name="archive" checked={!!coach.archived_at}/>}<Save>{coach?"Save coach":"Create coach"}</Save>
    <p className="text-xs text-slate-600">A coach record does not create an account or grant workspace access.</p>
  </form>;
}
export async function Coaches({repo,query}:{repo:Repo;query:Query}) {
  const [coaches,groups,assignments,allocations,swimmers]=await Promise.all([allRecords(repo.listCoaches),allRecords(repo.listGroups),allRecords(repo.listCoachAssignments),allRecords(repo.listSwimmerAssignments),allRecords(repo.listSwimmers)]);
  const selected=coaches.find(c=>c.id===queryId(query,"coach")), day=academyDay();
  const history=assignments.filter(a=>a.coach_id===selected?.id);
  const currentGroups=new Set(history.filter(a=>assignedOn(a,day)).map(a=>a.group_id));
  const roster=allocations.filter(a=>assignedOn(a,day)&&currentGroups.has(a.group_id));
  return <><PageHeading title="Coaches" description="Coach-to-group assignments, effective dates and swimmers through current group membership."/>
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Coach directory">{coaches.length?<ul className="grid gap-3">{coaches.map(c=><li key={c.id}><Link className={buttons} href={"/admin/coaches?coach="+c.id}>{c.display_name}</Link>{c.archived_at?" · archived":""}</li>)}</ul>:<p>No coaches yet. Create the first coach.</p>}</Panel>
      <Panel title={selected?"Edit coach":"Add coach"}><CoachForm key={selected?.id??"new"} coach={selected}/>{selected&&<Link className={buttons} href="/admin/coaches">Add another coach</Link>}</Panel>
      <Panel title="Assign coach to a group"><AssignCoach coaches={coaches} groups={groups} coach={selected?.id} back="coaches"/></Panel>
      {selected&&<Panel title="Coach groups and assignment history">{history.length?<ul className="grid gap-4">{history.map(a=><li key={a.id} className="border-b pb-3"><Link className={buttons} href={"/admin/groups?group="+a.group_id}>{groups.find(g=>g.id===a.group_id)?.name??"Group"}</Link><p className="text-sm">{a.valid_from} → {a.valid_until??"Open-ended"} · {a.is_primary?"Primary":"Supporting"} · {a.cancelled_at?"Cancelled":assignedOn(a,day)?"Current":"Historical / future"}</p>{!a.cancelled_at&&(!a.valid_until||a.valid_until>day)&&<EndAssignment row={a} kind="coach" coach={selected.id} back="coaches"/>}</li>)}</ul>:<p>No group assignments.</p>}</Panel>}
      {selected&&<Panel title={"Coach swimmer roster · "+day}>{roster.length?<ul className="grid gap-2">{roster.map(a=><li key={a.id}><Link className={buttons} href={"/admin/swimmers?swimmer="+a.swimmer_id}>{swimmers.find(s=>s.id===a.swimmer_id)?.display_name??"Swimmer"}</Link> · {groups.find(g=>g.id===a.group_id)?.name}</li>)}</ul>:<p>No swimmers in this coach’s current groups.</p>}</Panel>}
    </div></>;
}
export function Publish({kind,id,version,visible,swimmer,year,month}:{year?:number;month?:number;kind:"subscription"|"month"|"document";id:string;version:number;visible:boolean;swimmer:string}) {
  return <form action={mutate.bind(null,"publish")} className="mt-3 flex flex-wrap items-center gap-3"><Hidden name="year" value={year}/><Hidden name="month" value={month}/><Hidden name="kind" value={kind}/><Hidden name="id" value={id}/><Hidden name="version" value={version}/><Hidden name="swimmer" value={swimmer}/><Hidden name="visible" value={visible?"no":"yes"}/><span className="text-xs">{visible?"Published to verified Parents":"Internal only"}</span><Save>{visible?"Hide from Parents":"Publish to Parents"}</Save></form>;
}
export async function SwimmerHistory({repo,swimmer}:{repo:Repo;swimmer:string}) {
  const [history,allocations,groups,guardians,notes]=await Promise.all([allRecords(p=>repo.attendanceHistory(swimmer,p)),allRecords(repo.listSwimmerAssignments),allRecords(repo.listGroups),allRecords(p=>repo.listVerifiedGuardians(swimmer,p)),allRecords(p=>repo.listNotes(swimmer,p))]);
  return <>
    <Panel title="Group assignment history"><ul className="grid gap-2">{allocations.filter(a=>a.swimmer_id===swimmer).map(a=><li key={a.id}>{groups.find(g=>g.id===a.group_id)?.name??"Group"} · {a.valid_from} → {a.valid_until??"Open-ended"}{a.cancelled_at?" · Cancelled":""}</li>)}</ul></Panel>
    <Panel title="Attendance history">{history.length?<ul className="grid gap-2">{history.map(h=><li key={h.id} className="text-sm">{h.created_at} · revision {h.revision} · {h.previous_status??"Not marked"} → {h.new_status??"Not marked"}{h.reason?" · "+h.reason:""} <Link className={buttons} href={"/admin/attendance?session="+h.session_id}>Session details</Link></li>)}</ul>:<p>No attendance recorded.</p>}</Panel>
    <Panel title="Verified Parent relationships"><p className="mb-3 text-sm">Guardian contacts alone never grant access. Issue an invitation only after verifying the relationship.</p><Link className={buttons} href="/admin/invitations">Manage Parent invitations</Link>{guardians.map(g=><div key={g.id} className="mt-3 border-t pt-3"><p className="break-all text-sm">Parent membership: {g.parent_membership_id}</p><p className="text-sm">Verified {g.verified_at} · {g.revoked_at?"Revoked":"Active"}</p>{!g.revoked_at&&<form action={mutate.bind(null,"revokeGuardian")}><Hidden name="id" value={g.id}/><Hidden name="swimmer" value={swimmer}/><Save>Revoke Parent relationship</Save></form>}</div>)}</Panel>
    <Panel title="Swimmer notes and publication"><form action={mutate.bind(null,"note")} className={formClass}><Hidden name="swimmer" value={swimmer}/><Input label="New internal note" name="body" required maxLength={4000}/><Save>Add internal note</Save></form><div className="mt-4 grid gap-4">{notes.map(n=><div key={n.id} className="rounded-lg border p-3"><p className="text-sm">{n.visibility==="internal"?"Internal only":"Published to verified Parents"}</p><form action={mutate.bind(null,"note")} className={formClass}><Hidden name="id" value={n.id}/><Hidden name="version" value={n.row_version}/><Hidden name="swimmer" value={swimmer}/><Hidden name="noteSession" value={n.session_id}/><Input label="Note text" name="body" value={n.body} required maxLength={4000}/><Save>Save note</Save></form>{n.visibility==="internal"&&<form action={mutate.bind(null,"publishNote")} className="mt-2"><Hidden name="id" value={n.id}/><Hidden name="version" value={n.row_version}/><Hidden name="swimmer" value={swimmer}/><Save>Publish note to Parents</Save></form>}<form action={mutate.bind(null,"deleteNote")} className="mt-2"><Hidden name="id" value={n.id}/><Hidden name="version" value={n.row_version}/><Hidden name="swimmer" value={swimmer}/><Save>Withdraw note</Save></form></div>)}</div></Panel>
  </>;
}
