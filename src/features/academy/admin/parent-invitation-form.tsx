"use client";
import { useActionState } from "react";
import { issueParentInvitation } from "./parent-invitations";
const input="rounded-lg border border-slate-300 bg-white px-3 py-2";
export function ParentInvitationForm({swimmers}:{swimmers:{id:string;name:string}[]}) {
  const [state,action,pending]=useActionState(issueParentInvitation,{});
  return <form action={action} className="grid gap-4">
    <label className="grid gap-1 text-sm font-medium">Swimmer<select name="swimmer" className={input} required><option value="">Choose swimmer</option>{swimmers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-medium">Verified account email<input name="email" type="email" required maxLength={254} className={input}/></label>
    <label className="grid gap-1 text-sm font-medium">Relationship<select name="relationship" className={input}><option value="parent">Parent</option><option value="legal_guardian">Legal guardian</option></select></label>
    <label className="grid gap-1 text-sm font-medium">History visible from<input name="history" type="date" required className={input}/></label>
    <label className="flex gap-2 text-sm"><input name="verified" type="checkbox" required/>I independently verified this guardian relationship and approved the visibility date.</label>
    <button disabled={pending||!swimmers.length} className="button justify-self-start">{pending?"Issuing…":"Issue Parent invitation"}</button>
    {state.error&&<p role="alert" className="text-sm text-red-800">{state.error}</p>}
    {state.token&&<div role="status" className="rounded-lg bg-cyan-50 p-4"><p className="mb-2 text-sm">Share this single-use token securely with the verified recipient. It expires in 72 hours and is shown only here.</p><code className="break-all" data-parent-token>{state.token}</code></div>}
  </form>;
}

