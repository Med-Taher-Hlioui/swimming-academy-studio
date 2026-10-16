"use client";

import { useState } from "react";
import { academyConfig } from "@/config/academy";
import { Card } from "@/components/ui";

export function BrandingPreview() {
  const [name, setName] = useState(academyConfig.name);
  const [color, setColor] = useState(academyConfig.primaryColor);
  const [message, setMessage] = useState("");
  return <Card>
    <h2 className="text-lg font-semibold">Live branding preview</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Try a fictional academy name and color below. This sample updates immediately; it does not change the workspace branding or save a setting.</p>
    <div className="mt-6 space-y-5">
      <label className="field">Fictional academy name<input maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="field">Accent color<input type="color" className="h-12 w-24" value={color} onChange={event => setColor(event.target.value)} /></label>
      <div className="flex min-w-0 items-center gap-4 rounded-xl border border-slate-200 p-4"><span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl text-3xl text-white" style={{ background: color }}>≈</span><span className="min-w-0 break-words font-semibold">{name.trim() || "Your academy"}</span></div>
      <button type="button" className="secondary-button" onClick={() => { setName(academyConfig.name); setColor(academyConfig.primaryColor); setMessage("Default branding preview restored."); }}>Reset branding preview</button>
      <p role="status" className="text-sm text-cyan-800">{message}</p>
    </div>
  </Card>;
}
