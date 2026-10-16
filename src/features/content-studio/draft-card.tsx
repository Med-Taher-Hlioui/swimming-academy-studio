"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Badge, Card } from "@/components/ui";
import { useContentStudio } from "./content-provider";
import { CopyCaption } from "./copy-caption";
import type { ContentDraft } from "./models";
import { languageLabels, objectiveLabels } from "./models";
import { validateCopy } from "./rules";

export function DraftCard({ draft }: { draft: ContentDraft }) {
  const { busy, run, showCalendarWeek } = useContentStudio();
  const [copy, setCopy] = useState(draft.copy);
  const [date, setDate] = useState(draft.scheduledDate ?? "");
  const dirty = copy.hook !== draft.copy.hook || copy.caption !== draft.copy.caption || copy.cta !== draft.copy.cta;
  const direction = draft.brief.language === "aeb" ? "rtl" : "ltr";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await run(service => service.editDraft(draft.id, copy), "Draft saved. Changed copy must be approved again before scheduling.")) {
      setCopy(validateCopy(copy));
    }
  }
  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await run(service => service.scheduleDraft(draft.id, date), "Added to the planning calendar only. Nothing is published.")) {
      showCalendarWeek(date);
    }
  }
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs font-medium text-slate-500">{draft.brief.platform} · {objectiveLabels[draft.brief.objective]} · {languageLabels[draft.brief.language]}</p>
      <Badge>{draft.status === "approved" ? "Approved" : "Draft"}{draft.scheduledDate ? " · On calendar" : ""}</Badge>
    </div>
    <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">Original fictional brief</summary><p className="mt-2 whitespace-pre-wrap break-words">{draft.brief.description}</p></details>
    <form aria-busy={busy} onSubmit={save} className="mt-5">
      <fieldset disabled={busy} className="space-y-4">
        <label className="field">Hook<textarea required maxLength={180} rows={2} lang={draft.brief.language} dir={direction} value={copy.hook} onChange={event => setCopy(current => ({ ...current, hook: event.target.value }))} /></label>
        <label className="field">Caption<textarea required maxLength={2000} rows={6} lang={draft.brief.language} dir={direction} value={copy.caption} onChange={event => setCopy(current => ({ ...current, caption: event.target.value }))} /></label>
        <label className="field">Call to action<textarea required maxLength={200} rows={2} lang={draft.brief.language} dir={direction} value={copy.cta} onChange={event => setCopy(current => ({ ...current, cta: event.target.value }))} /></label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="button" disabled={!dirty}>Save edits</button>
          <button type="button" className="secondary-button" disabled={!dirty} onClick={() => setCopy(draft.copy)}>Discard edits</button>
          <button type="button" className="secondary-button" disabled={dirty || draft.status === "approved"} onClick={() => void run(service => service.approveDraft(draft.id), "Draft approved for manual planning. Nothing is published.")}>{draft.status === "approved" ? "Approved" : "Approve draft"}</button>
        </div>
      </fieldset>
    </form>
    <p className="mt-3 text-xs leading-5 text-slate-500">{dirty ? "Unsaved changes: save or discard before approval and scheduling." : "Approval is a manual review step. Check facts, tone and language before approving."} Editing saved approved content removes its calendar entry and requires a new approval.</p>
    <div className="mt-4"><CopyCaption copy={copy} language={draft.brief.language} /></div>
    <form aria-busy={busy} onSubmit={schedule} className="mt-5 border-t border-slate-100 pt-5">
      <fieldset disabled={busy || dirty || draft.status !== "approved"} className="flex flex-wrap items-end gap-3">
        <label className="field flex-1">Calendar date<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label>
        <button className="secondary-button" type="submit">{draft.scheduledDate ? "Move calendar entry" : "Add to calendar"}</button>
      </fieldset>
    </form>
    {draft.scheduledDate && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500"><p>Planned for {draft.scheduledDate}. No automatic posting.</p><button type="button" disabled={busy || dirty} className="font-semibold text-cyan-800 underline" onClick={() => void run(service => service.unscheduleDraft(draft.id), "Removed from calendar. The approved draft is kept.")}>Remove from calendar</button></div>}
  </Card>;
}
