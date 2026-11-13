import Link from "next/link";
import type { ReactNode } from "react";
import { Card, PageHeading } from "../../../components/ui";
import { parentSignOut } from "./actions";

export function ParentShell({children}:{children:ReactNode}) {
  return <div className="min-h-screen bg-slate-50">
    <a href="#parent-main" className="skip-link">Skip to content</a>
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
      <Link href="/parent" className="flex items-center gap-3 font-semibold"><span className="brand-mark" aria-hidden="true">≈</span><span>Shark Aquatics <span className="block text-xs font-normal text-slate-600">Parent workspace</span></span></Link>
      <div className="flex flex-wrap items-center gap-3"><Link href="/parent/invite" className="text-sm font-semibold text-cyan-800">Accept invitation</Link><form action={parentSignOut}><button className="secondary-button">Sign out</button></form></div>
    </div></header>
    <main id="parent-main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
  </div>;
}
export function Section({title,children}:{title:string;children:ReactNode}) {
  return <Card><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</Card>;
}
export function Quiet({children}:{children:ReactNode}) {return <p className="text-sm leading-6 text-slate-600">{children}</p>;}
const messages:Record<string,string>={
  credentials:"Sign-in failed. Use your verified account and try again.",
  session:"Sign in to continue to the Parent workspace.",
  role:"This account has no active Parent membership. If you have an invitation, sign in to accept it.",
  unavailable:"The Parent portal is unavailable.",
  callback:"The sign-in link could not be verified. Sign in again.",
  invite:"The invitation could not be accepted. Check the token and use the verified email address specified by the academy.",
  signedout:"You have signed out.",
};
export function ParentNotice({code}:{code:unknown}) {
  return typeof code==="string"&&Object.hasOwn(messages,code)
    ? <p role={code==="signedout"?"status":"alert"} className="mb-5 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">{messages[code]}</p>:null;
}
export function SignInFrame({children}:{children:ReactNode}) {
  return <main className="mx-auto max-w-xl px-4 py-10"><PageHeading title="Parent sign-in" description="Use your verified account to access records the academy has shared with you."/>{children}</main>;
}

