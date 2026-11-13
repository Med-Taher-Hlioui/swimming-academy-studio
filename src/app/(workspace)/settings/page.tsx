import type { Metadata } from "next";
import { Card, PageHeading } from "@/components/ui";
import { BrandingPreview } from "@/features/settings/branding-preview";
import { academyConfig } from "@/config/academy";
export default function SettingsPage() {
  return <><PageHeading title="Settings" description="Make the workspace feel like your academy. Explore branding in a temporary local preview." /><div className="grid items-start gap-6 xl:grid-cols-2"><BrandingPreview /><Card><h2 className="text-lg font-semibold">Workspace details</h2><dl className="mt-6 space-y-5 text-sm">{[["Environment", "Private V0 demonstration"], ["Data source", "Fictional mock repository"], ["Time zone", academyConfig.timeZone], ["Locale", academyConfig.locale], ["Connected services", "None"]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-4"><dt className="text-slate-500">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl><p className="mt-5 text-xs leading-5 text-slate-500">No authentication, billing or external integrations are enabled. This application must not hold real swimmer information.</p></Card></div></>;
}

export const metadata: Metadata = { title: "Settings" };
