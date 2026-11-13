import Link from "next/link";
import { Badge, PageHeading } from "../../../components/ui";
import { parentWorkspace } from "./access";
import { isCurrentTerm, statusLabel } from "./rules";
import { ParentShell, Quiet, Section } from "./ui";

function day(value:string) {
  return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(value+"T12:00:00Z"));
}
function time(value:string, zone:string) {
  return new Intl.DateTimeFormat("en-GB",{timeStyle:"short",timeZone:zone}).format(new Date(value));
}
function period(year:number,month:number) {
  return new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)));
}
export async function ParentDashboard({academyId,swimmer}:{academyId:string;swimmer:string}) {
  const {academy,academies,children,child,activity,details}=await parentWorkspace(academyId,swimmer);
  const term=activity&&details?.subscriptions.find(s=>isCurrentTerm(s,activity.today));
  const monthly=details?.monthlyStatuses.toSorted((a,b)=>b.billing_year-a.billing_year||b.billing_month-a.billing_month)??[];
  return <ParentShell><PageHeading title="Welcome to your Parent workspace" description={academy.name+" · Your linked children and information shared by the academy."}/>
    {academies.length>1&&<nav aria-label="Your academies" className="mb-5 flex flex-wrap gap-2">{academies.map(a=><Link key={a.id} prefetch={false} aria-current={a.id===academy.id?"page":undefined} href={"/parent?academy="+a.id} className={a.id===academy.id?"button":"secondary-button"}>{a.name}</Link>)}</nav>}
    <div className="mb-5"><Section title="My children">{children.length?<nav aria-label="Linked children" className="flex flex-wrap gap-2">
      {children.map(c=><Link key={c.id} prefetch={false} aria-current={c.id===child?.id?"page":undefined} className={c.id===child?.id?"button":"secondary-button"} href={"/parent/children/"+c.id+"?academy="+academy.id}>{c.display_name}</Link>)}
    </nav>:<Quiet>No verified children are linked in this academy. If the academy gave you an invitation, use “Accept invitation” above.</Quiet>}</Section></div>
    {child&&activity&&details&&<>
      <div className="mb-5"><Section title={child.display_name}><Badge>{child.level}</Badge><ul className="mt-3 space-y-1 text-sm">
        {activity.groups.map((g,i)=><li key={g.name+i}>{g.name}{g.schedule_label&&" · "+g.schedule_label}</li>)}
      </ul>{!activity.groups.length&&<Quiet>No current group has been recorded.</Quiet>}</Section></div>
      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Upcoming swimming sessions">{activity.sessions.length?<ul className="divide-y divide-slate-100">{activity.sessions.map(s=><li key={s.id} className="py-2 text-sm">
          <p className="font-semibold">{day(s.session_date)} · {s.group_name_snapshot}</p><Quiet>{s.starts_at?time(s.starts_at,activity.timezone)+(s.ends_at?"–"+time(s.ends_at,activity.timezone):""):"Time not recorded"}</Quiet>
        </li>)}</ul>:<Quiet>No upcoming sessions are shared for this child.</Quiet>}</Section>
        <Section title="Recent attendance">{activity.attendance.length?<ul className="divide-y divide-slate-100">{activity.attendance.map(a=><li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{day(a.session_date)} · {a.group_name_snapshot}</span><Badge>{a.status}</Badge></li>)}</ul>:<Quiet>No attendance is available within your authorized history.</Quiet>}</Section>
        <Section title="Current subscription">{term?<dl className="grid gap-2 text-sm"><div><dt>Monthly price</dt><dd className="text-xl font-semibold">{term.monthly_price_tnd} TND</dd></div><div><dt>Subscription start</dt><dd>{term.starts_on?day(term.starts_on):"Unknown"}</dd></div></dl>:<Quiet>No current subscription has been published for this child.</Quiet>}</Section>
        <Section title="Published monthly payment statuses">{monthly.length?<ul className="divide-y divide-slate-100">{monthly.map(m=><li key={m.subscription_id+":"+m.billing_year+":"+m.billing_month} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{period(m.billing_year,m.billing_month)}</span><Badge>{statusLabel(m.normalized_status)}</Badge></li>)}</ul>:<Quiet>No monthly statuses have been published.</Quiet>}<p className="mt-3 text-xs text-slate-600">These statuses do not show collections, payment dates, or balances.</p></Section>
        <Section title="Registration documents">{details.documents.some(d=>["certificate","extract"].includes(d.document_type))?<dl className="space-y-2 text-sm">{(["certificate","extract"] as const).map(type=>{
          const record=details.documents.find(d=>d.document_type===type);
          return record&&<div key={type} className="flex justify-between gap-3"><dt>{type==="certificate"?"Certificat":"Extrait"}</dt><dd><Badge>{record.status==="received"?"Received":"Unknown"}</Badge></dd></div>;
        })}</dl>:<Quiet>No document statuses have been published.</Quiet>}</Section>
        <Section title="Published progress notes">{activity.notes.length?<ul className="divide-y divide-slate-100">{activity.notes.map(n=><li key={n.id} className="py-3"><p className="mb-1 text-xs text-slate-600">{new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeZone:activity.timezone}).format(new Date(n.published_at))}</p><p className="whitespace-pre-wrap break-words text-sm">{n.body}</p></li>)}</ul>:<Quiet>No progress notes are available within your authorized history.</Quiet>}</Section>
      </div>
    </>}
  </ParentShell>;
}

