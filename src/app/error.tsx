"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section role="alert" className="rounded-2xl border border-red-200 bg-white p-6">
    <h1 className="text-2xl font-semibold">This demo page could not be opened</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Try again or return to the dashboard. If the problem continues, use Reset demo data to restore fictional records. Reloading also clears all local changes.</p>
    <div className="mt-5 flex flex-wrap gap-3"><button className="button" onClick={retry}>Try again</button><Link className="secondary-button" href="/">Return to dashboard</Link></div>
  </section>;
}
