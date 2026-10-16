"use client";

import { Badge, EmptyState } from "@/components/ui";
import { useContentStudio } from "./content-provider";
import { DraftCard } from "./draft-card";
import { GeneratedExamples } from "./generated-examples";
import { GenerationForm } from "./generation-form";
import { WeeklyCalendar } from "./weekly-calendar";

export function ContentStudio() {
  const { providerInfo, drafts, error, message, busy } = useContentStudio();
  return <>
    <div className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
      <Badge>{providerInfo.label} · V0</Badge>
      <h2 className="mt-3 font-semibold">{providerInfo.mode === "template" ? "Templates, not real AI." : "Review generated copy before approving it."}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{providerInfo.mode === "template" ? "Create sample marketing copy without a cloud model. No external AI calls are made. " : "Copy is generated through the configured provider. "}No photos, uploads or automatic publishing. Use fictional descriptions only; do not include children’s names or other personal information.</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">Drafts and calendar plans are saved in memory across navigation. Reload or “Reset demo data” clears them. This is not secure or durable storage.</p>
    </div>
    <nav aria-label="Content Studio sections" className="mb-6 flex flex-wrap gap-4 text-sm font-semibold text-cyan-800"><a href="#generator">Generate examples</a><a href="#drafts">Saved drafts ({drafts.length})</a><a href="#calendar">Weekly calendar</a></nav>
    <div aria-busy={busy}>{error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}{message && <p role="status" className="mb-3 rounded-xl border border-cyan-200 bg-white p-4 text-sm text-cyan-800">{message}</p>}</div>
    {busy && <p role="status" className="mb-4 rounded-xl bg-cyan-50 p-4 text-sm text-cyan-900">Preparing your demo content…</p>}
    <GenerationForm />
    <GeneratedExamples />
    <section id="drafts" aria-labelledby="drafts-heading" className="mt-10">
      <h2 id="drafts-heading" className="mb-4 text-xl font-semibold">3. Edit, review and save</h2>
      {drafts.length ? <div className={`grid items-start gap-5 ${drafts.length > 1 ? "xl:grid-cols-2" : ""}`}>{drafts.map(draft => <DraftCard key={draft.id} draft={draft} />)}</div> : <EmptyState title="No saved drafts yet" description="Generate three examples and select Save as draft to start your collection. Saved copy can be edited, copied and approved here." />}
    </section>
    <WeeklyCalendar />
  </>;
}
