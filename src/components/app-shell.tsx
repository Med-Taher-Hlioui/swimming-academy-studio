"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { academyConfig } from "@/config/academy";
import { DemoFeedback } from "@/features/academy/demo-provider";
import { DemoBanner } from "@/features/demo/demo-banner";
import { DemoGuide } from "@/features/demo/demo-guide";

const navigation = [
  ["/dashboard", "Overview", "◫"], ["/swimmers", "Swimmers", "○"], ["/groups", "Groups", "▦"],
  ["/attendance", "Attendance", "✓"], ["/registrations", "Registrations", "▤"], ["/shark-ai", "SHARK AI", "✧"], ["/settings", "Settings", "⚙"],
];
function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  return <div className="lg:hidden" onKeyDown={event => {
    if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
  }}>
    <button type="button" ref={trigger} className="secondary-button flex items-center gap-2" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(current => !current)}><span aria-hidden="true">{open ? "×" : "☰"}</span><span>Menu</span></button>
    <nav id="mobile-navigation" aria-label="Mobile navigation" hidden={!open} className="absolute inset-x-0 top-full z-30 grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-4 shadow-lg">
      {navigation.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={pathname === href ? "page" : undefined} className={`flex min-h-12 items-center rounded-lg px-3 text-sm ${pathname === href ? "bg-cyan-50 font-semibold text-cyan-800" : "text-slate-700 hover:bg-slate-50"}`}>{label}</Link>)}
    </nav>
  </div>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar hidden lg:flex">
      <Link href="/dashboard" className="flex items-center gap-3"><span aria-hidden="true" className="brand-mark">≈</span><span className="text-sm font-semibold leading-5">{academyConfig.name}</span></Link>
      <p className="mt-10 mb-4 text-xs font-semibold tracking-widest text-slate-400">MANAGE YOUR ACADEMY</p>
      <nav aria-label="Main navigation" className="space-y-2">{navigation.map(([href, label, icon]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`nav-link ${pathname === href ? "active" : ""}`}><span aria-hidden="true" className="w-6 text-lg">{icon}</span>{label}{label === "SHARK AI" && <span className="ml-auto text-xs text-cyan-300">V0</span>}</Link>)}</nav>
      <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4"><span className="text-sm font-medium text-cyan-300">Owner demonstration</span><p className="mt-2 text-xs leading-5 text-slate-300">Fictional academy records. SHARK AI uses templates, not real AI. No live services connected.</p></div>
    </aside>
    <div className="min-w-0 lg:ml-64">
      <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-8">
        <div className="min-w-0"><p className="text-xs text-slate-500 lg:hidden">{academyConfig.name}</p><div className="mt-1 flex flex-wrap items-center gap-2"><p className="font-semibold"><span className="hidden font-normal text-slate-500 sm:inline">Workspace / </span>{navigation.find(([href]) => href === pathname)?.[1] ?? "Page"}</p><span className="rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-950 lg:hidden">Demo Mode</span></div></div>
        <MobileNavigation key={pathname} />
        <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 lg:block">DEMO MODE</span>
      </header>
      <DemoBanner />
      <div className="mx-auto max-w-7xl px-4 pt-3 text-right text-sm sm:px-8"><Link className="font-semibold text-cyan-800 hover:underline" href="/admin" prefetch={false}>Admin sign-in ↗</Link><Link className="ml-4 font-semibold text-cyan-800 hover:underline" href="/parent/login" prefetch={false}>Parent sign-in ↗</Link></div>
      <main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        <DemoGuide />
        <DemoFeedback />
        {children}
        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500">Swimming Academy Studio V0 · Fictional records · Local demo memory · No live services connected</footer>
      </main>
    </div>
  </div>;
}
