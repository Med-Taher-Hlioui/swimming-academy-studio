export default function Loading() {
  return <section role="status" aria-live="polite" aria-busy="true" className="rounded-2xl border border-slate-200 bg-white p-6">
    <h1 className="text-xl font-semibold">Opening your demo workspace…</h1>
    <p className="mt-2 text-sm text-slate-600">Your fictional demo data stays in this tab while you navigate.</p>
    <div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-24 rounded-xl bg-slate-100 motion-safe:animate-pulse" />)}</div>
  </section>;
}
