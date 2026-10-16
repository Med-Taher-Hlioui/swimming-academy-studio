"use client";

import { useState } from "react";
import { Badge, DataTable, EmptyState } from "@/components/ui";
import { useAcademy } from "@/features/academy/demo-provider";
import { levels } from "@/features/academy/models";

export function SwimmerDirectory() {
  const { data: { swimmers, groups } } = useAcademy();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const filtered = swimmers.filter(swimmer => swimmer.name.toLowerCase().includes(query.trim().toLowerCase()) && (!level || swimmer.level === level));
  return <>
    <div className="mb-5 grid items-end gap-4 sm:grid-cols-[1fr_auto]">
      <label className="field">Search swimmers<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search demo swimmers…" /></label>
      <label className="field">Swimming level<select value={level} onChange={event => setLevel(event.target.value)}><option value="">All levels</option>{levels.map(item => <option key={item}>{item}</option>)}</select></label>
    </div>
    <p aria-live="polite" className="mb-3 text-sm text-slate-600">{filtered.length} fictional swimmers</p>
    {filtered.length ? <DataTable headings={["Swimmer", "Level", "Group", "Status"]}>{filtered.map(swimmer => <tr key={swimmer.id}>
      <td className="font-medium">{swimmer.name}</td><td>{swimmer.level}</td><td>{groups.find(group => group.id === swimmer.groupId)?.name ?? "Unassigned"}</td><td><Badge>{swimmer.status}</Badge></td>
    </tr>)}</DataTable> : <EmptyState title="No swimmers found" description="Try another name or clear the level filter to see all fictional swimmers."><button className="button" onClick={() => { setQuery(""); setLevel(""); }}>Clear filters</button></EmptyState>}
  </>;
}
