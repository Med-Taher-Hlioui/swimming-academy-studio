"use client";

import { useRef, useState } from "react";
import { useAcademy } from "@/features/academy/demo-provider";
import { useContentStudio } from "@/features/content-studio/content-provider";

export function DemoBanner() {
  const { busy: academyBusy, reset } = useAcademy();
  const { busy: contentBusy } = useContentStudio();
  const [confirm, setConfirm] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const busy = academyBusy || contentBusy;
  return <section aria-label="Demo mode and reset" className="border-b border-amber-200 bg-amber-50 px-4 py-4 sm:px-8">
    <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div className="w-full min-w-0 sm:flex-1">
        <p className="font-semibold text-amber-950">DEMO MODE <span className="font-normal">· Fictional data only</span></p>
        <p className="mt-1 text-xs leading-5 text-amber-950">Local memory is not secure or suitable for real personal information. Changes reset on reload. Never enter real children’s information.</p>
      </div>
      <button type="button" id="reset-demo-data" ref={button} disabled={busy} className="secondary-button w-full bg-white sm:w-auto" aria-expanded={confirm} aria-controls="reset-confirmation" onClick={() => setConfirm(current => !current)}>Reset demo data</button>
    </div>
    <div id="reset-confirmation" hidden={!confirm} className="mx-auto mt-3 max-w-7xl rounded-xl border border-amber-300 bg-white p-4">
      <p className="text-sm font-semibold">Restore the original fictional demo?</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">This clears academy edits, saved content drafts, calendar entries and walkthrough progress in this tab. It cannot be undone.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className="secondary-button" onClick={() => { setConfirm(false); button.current?.focus(); }}>Keep my changes</button>
        <button type="button" disabled={busy} className="button" onClick={() => { reset(); setConfirm(false); requestAnimationFrame(() => document.getElementById("reset-demo-data")?.focus()); }}>Reset everything</button>
      </div>
    </div>
  </section>;
}
