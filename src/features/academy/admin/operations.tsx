import { randomUUID } from "node:crypto";
import Link from "next/link";
import { DataTable, PageHeading } from "../../../components/ui";
import type { GroupRow } from "../backend/contracts";
import { AssignCoach, EndAssignment } from "./management";
import { academyDay, allRecords, assignedOn } from "./management-rules";
import { mutate } from "./actions";
import { PreviewPanel } from "./preview-panel";
import { Check, Hidden, Input, levelOptions, Panel, Save, Select } from "./ui";
import { buttons, cell, formClass, queryId, type Query, type Repo } from "./view-helpers";

function GroupForm({group}:{group?:GroupRow}) {
  return <form action={mutate.bind(null,"group")} className={formClass}>
    <Hidden name="id" value={group?.id}/><Hidden name="version" value={group?.row_version}/>
    <Input label="Group name" name="name" value={group?.name} required maxLength={60}/>
    <Select label="Group level" name="level" options={levelOptions} value={group?.level}/>
    <Input label="Capacity" name="capacity" type="number" value={group?.capacity??12} required/>
    <Input label="Schedule label" name="schedule" value={group?.schedule_label} maxLength={100}/>
    {group&&<Check label="Archive group" name="archive" checked={!!group.archived_at}/>}<Save>{group?"Save group":"Create group"}</Save>
  </form>;
}

export async function Groups({repo,query}:{repo:Repo;query:Query}) {
  const selected=queryId(query,"group"), swimmer=queryId(query,"swimmer");
  const [groups,details,coaches,assignments,allocations,swimmers]=await Promise.all([allRecords(repo.listGroups),swimmer?repo.swimmerDetails(swimmer):null,allRecords(repo.listCoaches),allRecords(repo.listCoachAssignments),allRecords(repo.listSwimmerAssignments),allRecords(repo.listSwimmers)]);
  const day=academyDay();
  const roster=allocations.filter(a=>a.group_id===selected&&assignedOn(a,day));
  const group=groups.find(g=>g.id===selected);
  return <><PageHeading title="Groups" description="Manage training groups, capacity and dated swimmer assignments."/>
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Training groups">{groups.length?<DataTable headings={["Group","Level","Capacity"]}>{groups.map(g=><tr key={g.id}><td className={cell}><Link className={buttons} href={"/admin/groups?group="+g.id+(swimmer?"&swimmer="+swimmer:"")}>{g.name}</Link>{g.archived_at?" (archived)":""}</td><td className={cell}>{g.level}</td><td className={cell}>{g.capacity}</td></tr>)}</DataTable>:<p>No groups recorded.</p>}</Panel>
      <Panel title={group?"Edit group":"Create training group"}><GroupForm key={group?.id??"new"} group={group}/>{group&&<Link href="/admin/groups" className={"mt-3 inline-block "+buttons}>Create another group</Link>}</Panel>
      <Panel title="Assign or transfer a swimmer"><form action={mutate.bind(null,"transfer")} className={formClass}>
        <Select label="Swimmer to assign" name="swimmer" value={swimmer} required options={[["","Choose swimmer"],...swimmers.filter(w=>!w.archived_at).map(w=>[w.id,w.display_name] as const)]}/>
        <Select label="Destination group" name="group" value={selected} required options={[["","Select group"],...groups.filter(g=>!g.archived_at&&(!details||g.level===details.swimmer.level)).map(g=>[g.id,g.name] as const)]}/>
        <Input label="Assignment starts" name="from" type="date" required/><Input label="Assignment ends before" name="until" type="date"/><Save>Assign swimmer</Save>
      </form><p className="mt-2 text-xs text-slate-600">The database checks level and capacity before accepting a transfer.</p></Panel>
      <Panel title="Coach assignments"><AssignCoach coaches={coaches} groups={groups} group={selected} back="groups"/>{group&&<ul className="mt-4 grid gap-4">{assignments.filter(a=>a.group_id===group.id).map(a=><li key={a.id} className="border-t pt-3"><Link className={buttons} href={"/admin/coaches?coach="+a.coach_id}>{coaches.find(c=>c.id===a.coach_id)?.display_name??"Coach"}</Link><p className="text-sm">{a.valid_from} → {a.valid_until??"Open-ended"} · {a.is_primary?"Primary":"Supporting"}{a.cancelled_at?" · Cancelled":""}</p>{!a.cancelled_at&&(!a.valid_until||a.valid_until>day)&&<EndAssignment row={a} kind="coach" group={group.id}/>}</li>)}</ul>}</Panel>
      {group&&<Panel title={"Group roster · "+day}><p className="mb-3 text-sm">{roster.length} / {group.capacity} places occupied today. Capacity is enforced for overlapping dated assignments.</p>{roster.length?<ul className="grid gap-3">{roster.map(a=><li key={a.id}><Link className={buttons} href={"/admin/swimmers?swimmer="+a.swimmer_id}>{swimmers.find(w=>w.id===a.swimmer_id)?.display_name??"Swimmer"}</Link><EndAssignment row={a} kind="swimmer" group={group.id}/></li>)}</ul>:<p>No swimmers assigned for today.</p>}</Panel>}
    </div></>;
}

export async function Attendance({repo,query}:{repo:Repo;query:Query}) {
  const groups=await allRecords(repo.listGroups);
  const selected=queryId(query,"session");
  const selectedSession=selected?(await repo.sessionById(selected))[0]:undefined;
  const group=groups.find(g=>g.id===(queryId(query,"group")||selectedSession?.group_id));
  const sessions=group?await allRecords(p=>repo.listSessions(group.id,p)):[];
  const session=sessions.find(s=>s.id===selected);
  const roster=session?await repo.roster(session.id):[];
  const history=session?await allRecords(p=>repo.sessionHistory(session.id,p)):[];
  const transitions=session?.status==="scheduled"?[["open","Open session"],["cancelled","Cancel session"]]:session?.status==="open"?[["closed","Close session"],["cancelled","Cancel session"]]:[];
  return <><PageHeading title="Attendance" description="Create dated sessions, manage their status and review immutable attendance corrections."/>
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Choose a training group"><form className={formClass}><Select label="Training group" name="group" value={group?.id??""} required options={[["","Choose group"],...groups.map(g=>[g.id,g.name] as const)]}/><button className="secondary-button justify-self-start">Show sessions</button></form>
        <ul className="mt-4 grid gap-2">{sessions.map(s=><li key={s.id}><Link className={buttons} href={"/admin/attendance?group="+s.group_id+"&session="+s.id}>{s.session_date}</Link> · {s.status}</li>)}</ul>{group&&!sessions.length&&<p className="mt-3 text-sm">No sessions recorded.</p>}</Panel>
      {group&&!group.archived_at&&<Panel title="Schedule a session"><form action={mutate.bind(null,"session")} className={formClass}><Hidden name="group" value={group.id}/><Input label="Session date" name="day" type="date" required/><Save>Create session</Save></form></Panel>}
    </div>
    {session&&group&&<div className="mt-5"><Panel title={"Session roster · "+session.session_date}>
      <p className="mb-3 text-sm">Session status: {session.status}</p>
      {transitions.length>0&&<form action={mutate.bind(null,"sessionStatus")} className="mb-5 flex flex-wrap items-end gap-3"><Hidden name="session" value={session.id}/><Hidden name="group" value={group.id}/><Hidden name="version" value={session.row_version}/>
        <Select label="Session action" name="status" options={transitions.map(([key,label])=>[key,label])}/><Save>Update session</Save></form>}
      {roster.length?<div className="grid gap-3">{roster.map(row=>{
        const attendance=Array.isArray(row.attendance)?row.attendance[0]:row.attendance;
        return <div key={row.swimmer_id} className="rounded-xl border border-slate-200 p-3"><p className="font-medium">{row.swimmer_name_snapshot}</p>
          {session.status==="open"?<form action={mutate.bind(null,"attendance")} className="mt-2 flex flex-wrap items-end gap-3">
            <Hidden name="swimmer" value={row.swimmer_id}/><Hidden name="session" value={session.id}/><Hidden name="group" value={group.id}/><Hidden name="request" value={randomUUID()}/><Hidden name="version" value={row.attendance_version}/>
            <Select label="Attendance status" name="status" value={attendance?.status??"blank"} options={[["blank","Not marked"],["present","Present"],["absent","Absent"],["excused","Excused"]]}/>
            <Input label="Reason (for corrections)" name="reason" maxLength={160}/><Save>Save attendance</Save>
          </form>:<p className="text-sm">{attendance?.status??"Not marked"}</p>}
        </div>;})}</div>:<p>No swimmers in this session roster.</p>}
      <h3 className="mt-6 font-semibold">Attendance corrections</h3>{history.length?<ul className="mt-3 grid gap-2">{history.map(h=><li key={h.id} className="text-sm">{roster.find(r=>r.swimmer_id===h.swimmer_id)?.swimmer_name_snapshot??"Swimmer"} · {h.created_at} · {h.previous_status??"Not marked"} → {h.new_status??"Not marked"}{h.reason?" · "+h.reason:""}</li>)}</ul>:<p className="mt-2 text-sm">No attendance changes yet.</p>}
    </Panel></div>}
  </>;
}

export async function ImportReview({repo,query}:{repo:Repo;query:Query}) {
  const batches=await repo.listImportBatches({limit:50}), selected=queryId(query,"batch");
  const batch=batches.find(b=>b.id===selected), exceptions=batch?await repo.listImportExceptions(batch.id,{limit:100}):[];
  return <><PageHeading title="Import review" description="Inspect redacted dry-run reports and track review exceptions. Workbook application is unavailable."/>
    <div className="grid gap-5 xl:grid-cols-2"><Panel title="Preview a redacted report"><PreviewPanel/></Panel>
      <Panel title="Academy review batches">{batches.length?<ul>{batches.map((b,i)=><li key={b.id} className="border-b py-2"><Link href={"/admin/registrations?batch="+b.id} className={buttons}>{"Review batch "+(i+1)}</Link> · {b.billing_year??"Year unspecified"} · {b.state}</li>)}</ul>:<p>No review batches recorded for this academy.</p>}</Panel>
    </div>{batch&&<div className="mt-5"><Panel title="Review exceptions">
      <p className="mb-3 text-sm">Batch status: {batch.state}</p>{exceptions.length?<ul className="grid gap-3">{exceptions.map(issue=><li key={issue.id} className="rounded-xl border border-slate-200 p-3"><p>{issue.reason_code.replaceAll("_"," ")} · {issue.resolution}</p>
      {issue.resolution==="open"&&batch.state==="review"&&<form action={mutate.bind(null,"resolve")} className="mt-2 flex flex-wrap items-end gap-3"><Hidden name="id" value={issue.id}/><Hidden name="version" value={issue.row_version}/><Hidden name="batch" value={batch.id}/>
        <Select label="Review decision" name="resolution" options={[["excluded","Exclude row"],["resolved","Mark reviewed and resolved"]]}/><Save>Save review decision</Save></form>}</li>)}</ul>:<p>No review exceptions.</p>}
    </Panel></div>}
  </>;
}

