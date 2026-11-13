"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDemoGuide } from "./guide-provider";
import { demoSteps } from "./guide-model";

export function DemoGuide() {
  const { tour, ready, finished, start, stop, next, previous } = useDemoGuide();
  const router = useRouter();
  function begin() { start(); router.push("/dashboard"); }
  if (!tour) return <section className="guide-panel mb-7 flex flex-wrap items-center justify-between gap-4" aria-label="Owner demonstration">
    <div><p className="eyebrow">OWNER WALKTHROUGH · 6 STEPS</p><h2 className="mt-2 font-semibold">From your first dashboard to your next social post.</h2><p className="mt-1 text-sm text-slate-600">A guided tour using fictional data. Start here or explore freely.</p></div>
    <button type="button" className="button" onClick={begin}>Start guided demo</button>
  </section>;
  if (finished) return <section className="guide-panel mb-7" aria-label="Walkthrough complete">
    <h2 className="text-lg font-semibold">All six demonstration steps completed</h2>
    <p role="status" className="mt-2 text-sm leading-6 text-slate-600">You explored groups, attendance, enquiries and content planning. Changes are in demo memory only. Nothing was published.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button className="button" onClick={begin}>Restart walkthrough</button><button className="secondary-button" onClick={stop}>Close guide</button></div>
  </section>;
  const step = demoSteps[tour.index];
  return <section className="guide-panel mb-7" aria-labelledby="guide-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="eyebrow">GUIDED OWNER DEMO · STEP {tour.index + 1} OF 6</p>
      <button type="button" className="text-button" onClick={stop}>Exit guide</button>
    </div>
    <h2 id="guide-title" className="mt-2 text-lg font-semibold">{step.title}</h2>
    <progress className="my-3 h-2 w-full accent-cyan-700" value={tour.index} max={6} aria-label="Completed demonstration steps" />
    <p className="text-sm leading-6 text-slate-700">{step.instruction}</p>
    <p role="status" className="mt-2 text-sm font-medium text-cyan-800">{ready ? "Step ready. Continue when you have finished reviewing." : "Complete the action on the page below to continue."}</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <Link href={step.href} className="secondary-button">Go to this step</Link>
      {tour.index > 0 && <button type="button" className="secondary-button" onClick={() => { previous(); router.push(demoSteps[tour.index - 1].href); }}>Previous step</button>}
      <button type="button" disabled={!ready} className="button" onClick={() => {
        next();
        if (tour.index + 1 < demoSteps.length) router.push(demoSteps[tour.index + 1].href);
      }}>{tour.index === demoSteps.length - 1 ? "Finish walkthrough" : "Continue to next step"}</button>
    </div>
    <details className="mt-4 text-sm"><summary className="text-button w-fit cursor-pointer">View all six steps</summary><ol className="mt-3 grid list-inside list-decimal gap-2 text-slate-600 sm:grid-cols-2">{demoSteps.map((item, index) => <li key={item.title} aria-current={index === tour.index ? "step" : undefined}>{item.title}{index < tour.index ? " · Completed" : ""}</li>)}</ol></details>
  </section>;
}
