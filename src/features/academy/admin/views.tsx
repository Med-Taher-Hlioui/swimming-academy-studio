import Link from "next/link";
import { Badge, Card, DataTable, PageHeading } from "../../../components/ui";
import type { Contact, Plan, SwimmerRow } from "../backend/contracts";
import { mutate } from "./actions";
import type { openAdmin } from "./access";
import { Check, documentOptions, Hidden, Input, levelOptions, MonthFilter, months, Panel, paymentOptions, Save, Select } from "./ui";

export type Repo = Awaited<ReturnType<typeof openAdmin>>;
export type Query = Record<string,string|string[]|undefined>;
export const queryValue=(q:Query,key:string)=>typeof q[key]==="string" ? q[key] : "";
export const queryId=(q:Query,key:string)=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(queryValue(q,key))?queryValue(q,key).toLowerCase():"";
export const queryMonth=(q:Query)=>/^[6-9]$|^1[01]$/.test(queryValue(q,"month"))?Number(queryValue(q,"month")):6;
export const cell="px-4 py-3";
export const formClass="grid gap-3";
export const buttons="font-semibold text-cyan-800 underline-offset-4 hover:underline";

export async function Overview({repo,query}:{repo:Repo;query:Query}) {
  const month=queryMonth(query);
  const [counts,summary]=await Promise.all([repo.dashboard(2026,month),repo.summaries()]);
  return <><PageHeading title="Academy overview" description="Live records for the configured academy." action={<Link href="/admin/swimmers" className="button">View swimmers</Link>}/>
    <MonthFilter month={month}/>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {([["Total swimmers",counts.swimmers],["Active subscriptions",summary.total],["Active groups",counts.groups],["Open import issues",counts.openImportExceptions]] as const).map(([label,value])=><Card key={label}><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></Card>)}
    </div><div className="grid gap-5 xl:grid-cols-2">
      <Panel title={"Payment statuses · "+months[month-6]+" 2026"}><dl className="grid gap-2">{paymentOptions.map(([key,label])=><div key={key} className="flex justify-between"><dt>{label}</dt><dd>{counts.recordedMonthlyStatuses[key]}</dd></div>)}</dl><p className="mt-3 text-sm text-slate-600">These are recorded statuses. They do not measure money collected or outstanding balances.</p></Panel>
      <Panel title="Active subscriptions by plan">{summary.plans.length ? <dl>{summary.plans.map(p=><div key={p.id} className="flex justify-between border-b py-2"><dt>{p.label}</dt><dd>{p.count}</dd></div>)}</dl>:<p>No plans recorded.</p>}</Panel>
      <Panel title="Document receipts">{summary.documents.map(({type,statuses})=><div key={type} className="mb-3"><h3 className="font-semibold">{type==="certificate"?"Certificat":"Extrait"}</h3><p className="text-sm">{statuses[0]} received · {statuses[1]} unknown · {statuses[2]} missing · {statuses[3]} rejected</p></div>)}<p className="text-sm text-slate-600">Counts include only recorded document statuses.</p></Panel>
      <Panel title="Group summary">{summary.groups.length ? <ul>{summary.groups.map(g=><li key={g.id} className="border-b py-2">{g.name} · {g.level} · capacity {g.capacity}</li>)}</ul>:<p>No active groups.</p>}</Panel>
    </div></>;
}

function SwimmerForm({record}:{record?:SwimmerRow}) {
  return <form action={mutate.bind(null,"swimmer")} className={formClass}>
    <Hidden name="id" value={record?.id}/><Hidden name="version" value={record?.row_version}/>
    <Input label="Swimmer name" name="name" value={record?.display_name} required maxLength={160}/>
    <Select label="Skill level" name="level" value={record?.level??""} options={[["","Unresolved — review required"],...levelOptions]}/>
    <Select label="Swimmer status" name="status" value={record?.status??"trial"} options={[["trial","Trial"],["active","Active"]]}/>
    <p className="text-xs text-slate-600">A reviewed level is required to create or update a swimmer. An unresolved level is never guessed.</p>
    {record && <Check label="Archive swimmer" name="archive" checked={!!record.archived_at}/>}<Save>{record?"Save swimmer":"Create swimmer"}</Save>
  </form>;
}
function ContactForm({swimmer,contact}:{swimmer:string;contact?:Contact}) {
  return <form action={mutate.bind(null,"contact")} className={formClass}>
    <Hidden name="swimmer" value={swimmer}/><Hidden name="id" value={contact?.id}/><Hidden name="version" value={contact?.row_version}/>
    <Input label="Contact name" name="name" value={contact?.display_name} required maxLength={160}/>
    <Input label="Contact phone" name="phone" type="tel" value={contact?.phone} maxLength={40}/>
    <Check label="Unqualified phone number is Tunisian" name="country" checked={false}/>
    <Input label="Contact email" name="email" type="email" value={contact?.email} maxLength={254}/>
    {contact && <Check label="Archive contact" name="archive" checked={!!contact.archived_at}/>}<Save>{contact?"Save contact":"Create contact"}</Save>
  </form>;
}
export async function Swimmers({repo,query}:{repo:Repo;query:Query}) {
  const search=queryValue(query,"q").trim().slice(0,80), level=queryValue(query,"level"), status=queryValue(query,"status");
  const rawPage=queryValue(query,"page"), page=/^\d{1,4}$/.test(rawPage)?Number(rawPage):0;
  const selected=queryId(query,"swimmer"), contactId=queryId(query,"contact");
  const [rows,details]=await Promise.all([repo.searchSwimmers(search,levelOptions.some(([key])=>key===level)?level:"",status,page*25),selected?repo.swimmerDetails(selected):null]);
  const params=new URLSearchParams({q:search,level,status,page:String(page)});
  const url=(next:Record<string,string>)=>"/admin/swimmers?"+new URLSearchParams({...Object.fromEntries(params),...next}).toString();
  const [contacts,links,documents]=details?await Promise.all([repo.listContacts({limit:100}),repo.listContactLinks(selected,{limit:100}),repo.listDocuments(selected,{limit:100})]):[[],[],[]];
  const contact=contacts.find(c=>c.id===contactId);
  return <><PageHeading title="Swimmers" description="Search, register and manage swimmers, guardian contacts and restricted records."/>
    <div className="mb-5 grid gap-5 xl:grid-cols-[2fr_1fr]"><Panel title="Swimmer directory"><form className="mb-4 flex flex-wrap items-end gap-3">
      <Input label="Search name" name="q" value={search} maxLength={80}/><Select label="Level filter" name="level" value={level} options={[["","All levels"],...levelOptions]}/>
      <Select label="Status filter" name="status" value={status} options={[["","Current records"],["active","Active"],["trial","Trial"],["archived","Archived"]]}/>
      <button className="secondary-button">Filter swimmers</button>
    </form>{rows.length?<DataTable headings={["Swimmer","Level","Status"]}>{rows.map(row=><tr key={row.id}><td className={cell}><Link className={buttons} href={url({swimmer:row.id})}>{row.display_name}</Link></td><td className={cell}>{row.level}</td><td className={cell}><Badge>{row.archived_at?"archived":row.status}</Badge></td></tr>)}</DataTable>:<p>No matching swimmers.</p>}
    <nav aria-label="Swimmer pages" className="mt-4 flex gap-5">{page>0&&<Link className={buttons} href={url({page:String(page-1)})}>Previous page</Link>}{rows.length===25&&<Link className={buttons} href={url({page:String(page+1)})}>Next page</Link>}</nav></Panel>
    <Panel title={details?"Edit swimmer":"Register swimmer"}><SwimmerForm key={details?.swimmer.id??"new"} record={details?.swimmer}/>{details&&<Link className={"mt-4 inline-block "+buttons} href="/admin/swimmers">Register another swimmer</Link>}</Panel></div>
    {selected&&!details&&<p role="status">Swimmer unavailable.</p>}
    {details&&<div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Restricted swimmer details"><form action={mutate.bind(null,"birth")} className={formClass}><Hidden name="swimmer" value={selected}/><Hidden name="version" value={details.privateDetails?.row_version}/>
        <Input label="Birth date" name="birth" type="date" value={details.privateDetails?.birth_date}/><Save>Save birth date</Save></form>
        <Link className={"mt-4 inline-block "+buttons} href={"/admin/subscriptions?swimmer="+selected}>Manage swimmer subscriptions</Link> <Link className={"mt-4 ml-3 inline-block "+buttons} href={"/admin/groups?swimmer="+selected}>Manage group assignment</Link>
      </Panel>
      <Panel title="Document receipt tracking"><div className="grid gap-4">{(["certificate","extract"] as const).map(type=>{
        const doc=documents.find(d=>d.document_type===type), label=type==="certificate"?"Certificat":"Extrait";
        return <form key={type} action={mutate.bind(null,"document")} className={formClass}><Hidden name="swimmer" value={selected}/><Hidden name="type" value={type}/><Hidden name="version" value={doc?.row_version}/>
          <Select label={label+" status"} name="status" options={documentOptions} value={doc?.status??"unknown"}/><p className="text-xs text-slate-600">{doc?"Recorded receipt status.":"No receipt status recorded."}</p><Save>{"Save "+label}</Save></form>;
      })}</div></Panel>
      <Panel title="Guardian contact associations"><p className="mb-3 text-sm text-slate-600">Contact candidates do not grant Parent access.</p>
        {links.map(link=>{const c=contacts.find(entry=>entry.id===link.contact_id);return <div key={link.contact_id} className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2"><Link className={buttons} href={url({swimmer:selected,contact:link.contact_id})}>{c?.display_name??"Linked contact"}</Link><form action={mutate.bind(null,"link")}><Hidden name="swimmer" value={selected}/><Hidden name="contact" value={link.contact_id}/><Hidden name="linked" value="no"/><button className="secondary-button">Unlink contact</button></form></div>;})}
        <form action={mutate.bind(null,"link")} className={formClass}><Hidden name="swimmer" value={selected}/><Hidden name="linked" value="yes"/><Select label="Existing contact" name="contact" required options={[["","Select contact"],...contacts.filter(c=>!c.archived_at&&!links.some(l=>l.contact_id===c.id)).map(c=>[c.id,c.display_name] as const)]}/><Save>Link guardian contact</Save></form>
      </Panel>
      <Panel title={contact?"Edit guardian contact":"Create guardian contact"}><ContactForm key={contact?.id??"new"} swimmer={selected} contact={contact}/></Panel>
    </div>}
  </>;
}

function PlanForm({plan,swimmer}:{plan?:Plan;swimmer:string}) {
  return <form action={mutate.bind(null,"plan")} className={formClass}>
    <Hidden name="swimmer" value={swimmer||undefined}/><Hidden name="id" value={plan?.id}/><Hidden name="version" value={plan?.row_version}/>
    <Input label="Plan code" name="code" value={plan?.code} required maxLength={32}/><Input label="Plan name" name="label" value={plan?.label} required maxLength={120}/>
    <Input label="Monthly price (TND)" name="price" value={plan?.monthly_price_tnd} required maxLength={13}/>
    <Check label="Active plan" name="active" checked={plan?.active??true}/><Save>{plan?"Save plan":"Create plan"}</Save>
  </form>;
}

export async function Subscriptions({repo,query}:{repo:Repo;query:Query}) {
  const swimmer=queryId(query,"swimmer"), planId=queryId(query,"plan"), month=queryMonth(query);
  const [plans,details,subscriptions]=await Promise.all([repo.listPlans({limit:100}),swimmer?repo.swimmerDetails(swimmer):null,swimmer?repo.listSubscriptions(swimmer,{limit:50}):[]]);
  const plan=plans.find(p=>p.id===planId);
  const monthly=await Promise.all(subscriptions.map(s=>repo.monthForPeriod(s.id,2026,month)));
  return <><PageHeading title="Subscriptions" description="Manage plans and monthly observations. A price change never rewrites a historical subscription price."/>
    <div className="mb-5 grid gap-5 xl:grid-cols-2"><Panel title="Plan catalog">{plans.length?<DataTable headings={["Plan","Monthly price","Availability"]}>{plans.map(p=><tr key={p.id}><td className={cell}><Link className={buttons} href={"/admin/subscriptions?"+new URLSearchParams({plan:p.id,...(swimmer?{swimmer}:{}),month:String(month)})}>{p.code} · {p.label}</Link></td><td className={cell}>{p.monthly_price_tnd} TND</td><td className={cell}>{p.active?"Active":"Inactive"}</td></tr>)}</DataTable>:<p>No subscription plans yet.</p>}</Panel>
    <Panel title={plan?"Edit plan":"Create a plan"}><PlanForm key={plan?.id??"new"} plan={plan} swimmer={swimmer}/>{plan&&<Link className={"mt-4 inline-block "+buttons} href={"/admin/subscriptions"+(swimmer?"?swimmer="+swimmer:"")}>Create another plan</Link>}</Panel></div>
    {!details?<Panel title="Select a swimmer"><p className="mb-3 text-sm">Open a swimmer’s record to manage their subscription.</p><Link href="/admin/swimmers" className={buttons}>Find a swimmer</Link></Panel>:<>
      <div className="mb-5"><Panel title={"Assign a subscription · "+details.swimmer.display_name}><form action={mutate.bind(null,"subscription")} className={formClass}>
        <Hidden name="swimmer" value={swimmer}/><Select label="Subscription plan" name="plan" required options={[["","Select a plan"],...plans.filter(p=>p.active).map(p=>[p.id,p.label+" · "+p.monthly_price_tnd+" TND"] as const)]}/>
        <Input label="Subscription start date" name="start" type="date"/><Input label="End before (optional)" name="end" type="date"/><Save>Assign subscription</Save>
      </form></Panel></div>
      <MonthFilter month={month} swimmer={swimmer}/>
      <div className="grid gap-4 xl:grid-cols-2">{subscriptions.map((s,i)=>{
        const existing=monthly[i];
        const start=s.starts_on?.slice(0,7), billing="2026-"+String(month).padStart(2,"0");
        const inPeriod=s.lifecycle!=="review"&&(!start||start<=billing)&&(!s.ends_before||s.ends_before>billing+"-01");
        return <Panel key={s.id} title={plans.find(p=>p.id===s.plan_id)?.label??"Subscription"}>
          <p className="mb-2 text-sm">{s.monthly_price_tnd} TND at assignment · {s.lifecycle}</p><p className="mb-3 text-sm">Start: {s.starts_on??"Unknown"} · End before: {s.ends_before??"Open"}</p>
          <p className="mb-3 text-sm">{existing?existing.source_batch_id?existing.source_code===null?"Source: blank cell":"Original source marker: "+existing.source_code:"Source: manual entry":"No observation recorded for this period."}</p>
          {(existing||inPeriod)?<form action={mutate.bind(null,"month")} className={formClass}>
            <Hidden name="swimmer" value={swimmer}/><Hidden name="subscription" value={s.id}/><Hidden name="id" value={existing?.id}/><Hidden name="version" value={existing?.row_version}/><Hidden name="month" value={month}/>
            <Select label="Monthly payment status" name="status" value={existing?existing.normalized_status??"blank":""} required options={[["","Select status"],...paymentOptions]}/><Save>Save monthly status</Save>
          </form>:<p className="text-sm">This period is outside the confirmed subscription term.</p>}
        </Panel>;
      })}</div>{!subscriptions.length&&<p>No subscriptions assigned.</p>}
    </>}
  </>;
}

