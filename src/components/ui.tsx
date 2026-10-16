import type { ReactNode } from "react";

export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex min-w-0 flex-wrap items-end justify-between gap-4">
    <div className="min-w-0"><p className="eyebrow">ACADEMY WORKSPACE</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl xl:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p></div>{action}
  </div>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 ${className}`}>{children}</section>;
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium leading-5 text-cyan-900">{children}</span>;
}
export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <Card className="py-10 text-center"><div aria-hidden="true" className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-cyan-50 text-2xl text-cyan-700">≈</div><h2 className="text-xl font-semibold">{title}</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">{description}</p>{children && <div className="mt-6">{children}</div>}</Card>;
}
export function DataTable({ headings, children }: { headings: string[]; children: ReactNode }) {
  return <div>
    <p className="mb-2 text-xs text-slate-600 sm:hidden">Swipe or scroll horizontally to see all columns.</p>
    <div role="region" aria-label={`Scrollable table: ${headings.join(", ")}`} tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{headings.map(heading => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-4 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table>
    </div>
  </div>;
}
