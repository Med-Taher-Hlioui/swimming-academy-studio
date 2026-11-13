import Link from "next/link";
import type { ReactNode } from "react";
import { academyConfig } from "../../../config/academy";
import { Card } from "../../../components/ui";
import { signOut } from "./actions";

export const links = [
  ["dashboard","Overview"],["swimmers","Swimmers"],["subscriptions","Subscriptions"],
  ["groups","Groups"],["attendance","Attendance"],["registrations","Import review"],
] as const;
export const months = ["June","July","August","September","October","November"];
export const levelOptions = [["beginner","Beginner"],["developing","Developing"],["advanced","Advanced"]] as const;
export const paymentOptions = [["paid","Paid"],["pending","Pending"],["unpaid","Unpaid"],["unknown","Unknown (dash)"],["blank","Blank (NULL)"]] as const;
export const documentOptions = [["unknown","Unknown"],["received","Received"],["missing","Missing"],["rejected","Rejected"]] as const;
const notices: Record<string,string> = {
  saved:"Changes saved.",invalid_input:"Check the form values and try again.",
  level_review_required:"Select a reviewed skill level before saving this swimmer.",
  conflict:"This record changed or conflicts with existing data. Review the latest values and try again.",
  unavailable:"The Admin service is unavailable.",
  session:"Sign in to access the Admin workspace.",forbidden:"This account has no Admin access to the configured academy.",
  credentials:"Sign-in failed. Check your credentials and try again.",
};
export function Notice({code}:{code:string}) {
  const message=Object.hasOwn(notices,code) ? notices[code] : null;
  return message && <p role={code==="saved"?"status":"alert"} className="mb-5 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">{message}</p>;
}
export function AdminShell({section,children}:{section:string;children:ReactNode}) {
  return <div className="min-h-screen bg-slate-50"><a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar hidden lg:flex">
      <Link href="/admin/dashboard" className="flex items-center gap-3"><span className="brand-mark" aria-hidden="true">≈</span>{academyConfig.name}</Link>
      <p className="mt-9 mb-4 text-xs font-semibold tracking-widest text-cyan-200">ADMIN WORKSPACE</p>
      <nav aria-label="Admin navigation">{links.map(([path,label])=><Link className={"nav-link "+(section===path?"active":"")} aria-current={section===path?"page":undefined} key={path} href={"/admin/"+path} prefetch={false}>{label}</Link>)}<Link className={"nav-link "+(section==="invitations"?"active":"")} aria-current={section==="invitations"?"page":undefined} href="/admin/invitations" prefetch={false}>Parent invitations</Link></nav>
      <Link href="/dashboard" className="mt-auto text-sm text-cyan-200">Fictional demo ↗</Link>
    </aside>
    <div className="lg:ml-64"><header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">Shark Aquatics <span className="ml-2 text-sm font-normal text-slate-500">Admin workspace</span></p><form action={signOut}><button className="secondary-button">Sign out</button></form></div>
      <nav aria-label="Mobile Admin navigation" className="mt-3 flex flex-wrap gap-2 lg:hidden">{links.map(([path,label])=><Link key={path} href={"/admin/"+path} prefetch={false} aria-current={section===path?"page":undefined} className={"rounded-lg px-3 py-2 text-sm "+(section===path?"bg-cyan-100 font-semibold":"bg-slate-100")}>{label}</Link>)}<Link href="/admin/invitations" className="rounded-lg px-3 py-2 text-sm bg-slate-100" prefetch={false}>Parent invitations</Link><Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm">Fictional demo</Link></nav>
    </header><main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</main></div>
  </div>;
}
export function Panel({title,children}:{title:string;children:ReactNode}) {
  return <Card><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</Card>;
}
export function Input({label,name,value,type="text",required=false,maxLength}:{label:string;name:string;value?:string|number|null;type?:string;required?:boolean;maxLength?:number}) {
  return <label className="grid gap-1 text-sm font-medium">{label}<input name={name} type={type} defaultValue={value??undefined} required={required} maxLength={maxLength} className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>;
}
export function Select({label,name,options,value,required=false}:{label:string;name:string;options:readonly (readonly [string,string])[];value?:string;required?:boolean}) {
  return <label className="grid gap-1 text-sm font-medium">{label}<select name={name} defaultValue={value} required={required} className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">{options.map(([key,title])=><option key={key} value={key}>{title}</option>)}</select></label>;
}
export function Hidden({name,value}:{name:string;value?:string|number|null}) {
  return value===null||value===undefined ? null : <input type="hidden" name={name} value={value}/>;
}
export function Check({label,name,checked=false}:{label:string;name:string;checked?:boolean}) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={checked}/>{label}</label>;
}
export function Save({children="Save"}:{children?:ReactNode}) {return <button className="button justify-self-start">{children}</button>;}
export function MonthFilter({month,swimmer}:{month:number;swimmer?:string}) {
  return <form className="mb-5 flex flex-wrap items-end gap-3">
    <Hidden name="swimmer" value={swimmer}/><Select label="Billing period" name="month" value={String(month)} options={months.map((m,i)=>[String(i+6),m+" 2026"])}/><button className="secondary-button">Show period</button>
  </form>;
}

