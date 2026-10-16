"use client";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeading } from "@/components/ui";
import { useAcademy } from "@/features/academy/demo-provider";
import { academyConfig } from "@/config/academy";

export function OverviewDashboard() {
  const { data } = useAcademy();
  const metrics = [
    { label: "Swimmers", value: data.swimmers.length, caption: `${data.swimmers.filter(swimmer => !swimmer.groupId).length} currently unassigned`, href: "/swimmers" },
    { label: "Active groups", value: data.groups.length, caption: `${new Set(data.groups.map(group => group.level)).size} swimming levels`, href: "/groups" },
    { label: "Attendance", value: data.attendanceRate === null ? "—" : `${data.attendanceRate}%`, caption: `Across ${data.attendance.length} sample records`, href: "/attendance" },
    { label: "Pending registrations", value: data.pendingRegistrations, caption: "Ready for a review", href: "/registrations" },
    { label: "Available places", value: data.availablePlaces, caption: "Across current group rosters", href: "/groups" },
    { label: "Training sessions", value: data.sessions.length, caption: "Saved in this demo workspace", href: "/attendance" },
  ];
  return <>
    <PageHeading title="Every great swim starts here." description={academyConfig.tagline} action={<Link className="button" href="/swimmers">View swimmers ↗</Link>} />
    <section className="relative mb-7 overflow-hidden rounded-2xl bg-[#0b304b] p-7 text-white sm:p-9"><div aria-hidden="true" className="absolute -right-6 -bottom-24 size-80 rounded-full border-[35px] border-cyan-300/10" /><div className="relative max-w-xl"><span className="text-[10px] font-semibold tracking-[.2em] text-cyan-300">YOUR ACADEMY, IN SYNC</span><h2 className="mt-3 text-2xl font-semibold">Less admin. More time by the pool.</h2><p className="mt-3 text-sm leading-6 text-slate-300">Explore your swimmers, organize your groups and keep a clear view of progress. Your demo workspace is ready.</p><p className="mt-5 text-xs text-cyan-200">Interactive demo · Fictional records · Resets on reload</p></div></section>
    <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(metric => <Link key={metric.label} href={metric.href} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-cyan-500"><p className="text-xs font-medium text-slate-500">{metric.label}</p><p className="mt-4 text-3xl font-semibold">{metric.value}</p><p className="mt-2 text-xs text-slate-500">{metric.caption}</p></Link>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]"><Card><div className="mb-6 flex items-center justify-between gap-4"><div><h2 className="font-semibold">Your groups at a glance</h2><p className="mt-1 text-xs text-slate-500">A little structure for every level.</p></div><Link href="/groups" className="shrink-0 text-xs font-semibold text-cyan-700">View all →</Link></div>{data.groups.length ? <div className="space-y-5">{data.groups.map(group => { const count = data.swimmers.filter(s => s.groupId === group.id).length; return <div key={group.id} className="flex items-center gap-4"><div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-xl text-cyan-700">≈</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{group.name}</p><span className="text-xs text-slate-500">{count} / {group.capacity} swimmers</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${count / group.capacity * 100}%` }} /></div><p className="mt-2 text-xs text-slate-500">{group.schedule}</p></div></div>; })}</div> : <p>No demo groups available.</p>}</Card>
    <Card className="flex flex-col"><div><Badge>SHARK AI · Demo Generator</Badge></div><h2 className="mt-5 text-xl font-semibold">Your next swimming story starts here.</h2><p className="mt-3 text-sm leading-6 text-slate-500">Create template-based social posts, edit drafts and plan a week of content. Demo Generator, not real AI.</p><Link href="/shark-ai" className="mt-auto pt-6 text-sm font-semibold text-cyan-800">Open Content Studio →</Link></Card></div>
    <div className="mt-6"><EmptyState title="Your activity feed starts here" description="There is no activity log in this demo. Attendance, groups and enquiry statistics update from your shared in-memory data." /></div>
  </>;
}
