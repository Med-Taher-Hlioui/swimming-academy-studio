"use client";
import { useActionState } from "react";
import { reviewPreview } from "./preview-action";

export function PreviewPanel() {
  const [state,action,pending]=useActionState(reviewPreview,{});
  return <form action={action} className="grid gap-3">
    <label className="grid gap-2 text-sm font-medium">Redacted dry-run JSON<textarea name="summary" required rows={6} maxLength={12000} autoComplete="off" className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"/></label>
    <p className="text-sm text-slate-600">Paste aggregate output from the local importer. Do not paste spreadsheet rows or personal details. This preview is not stored.</p>
    <button disabled={pending} className="button justify-self-start">{pending?"Checking…":"Preview report"}</button>
    {state.error&&<p role="alert" className="text-sm text-red-800">{state.error}</p>}
    {state.preview&&<section aria-live="polite" className="rounded-lg bg-cyan-50 p-4">
      <h3 className="font-semibold">Dry-run summary · June–November 2026</h3>
      <p className="my-2 text-sm">{state.preview.rows} rows · {state.preview.accepted} accepted for review · {state.preview.quarantined} quarantined</p>
      <ul className="grid gap-1 text-sm">{state.preview.issues.map(i=><li key={i.category}>{i.category.replaceAll("_"," ")}: {i.count}</li>)}</ul>
      <p className="mt-2 text-sm">No workbook rows were applied.</p>
    </section>}
  </form>;
}

