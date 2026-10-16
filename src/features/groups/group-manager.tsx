"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { useAcademy } from "@/features/academy/demo-provider";
import { levels } from "@/features/academy/models";
import type { Group, Level } from "@/features/academy/models";
import { useDemoGuide } from "@/features/demo/guide-provider";

export function GroupManager() {
  const { data, busy, run } = useAcademy();
  const { recordGroupOpened } = useDemoGuide();
  const [editing, setEditing] = useState<Group | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [level, setLevel] = useState<Level>("Beginner");
  const [selected, setSelected] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (showForm) document.getElementById("group-editor")?.focus();
  }, [showForm, formKey]);

  function openForm(group: Group | null) {
    if (group) recordGroupOpened();
    setEditing(group);
    setLevel(group?.level ?? "Beginner");
    setSelected(group ? data.swimmers.filter(s => s.groupId === group.id).map(s => s.id) : []);
    setFormKey(key => key + 1);
    setShowForm(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const saved = await run(service => service.saveGroup({
      name: String(fields.get("name") ?? ""),
      level,
      coachId: String(fields.get("coachId") ?? ""),
      schedule: String(fields.get("schedule") ?? ""),
      capacity: Number(fields.get("capacity")),
      swimmerIds: selected,
    }, editing?.id), editing ? "Demo group updated." : "Demo group created.");
    if (saved) setShowForm(false);
  }

  return <>
    <div className="mb-5 flex justify-end"><button type="button" className="button" disabled={busy} onClick={() => openForm(null)}>Create training group</button></div>
    {showForm && <Card className="mb-6">
      <h2 id="group-editor" tabIndex={-1} className="text-lg font-semibold">{editing ? "Edit training group" : "New training group"}</h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">Use fictional group names only. Moving swimmers updates their current group; existing session rosters stay unchanged.</p>
      <form key={formKey} aria-busy={busy} onSubmit={save} className="mt-5">
        <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
          <label className="field">Group name<input name="name" required maxLength={60} defaultValue={editing?.name} placeholder="Demo group name" /></label>
          <label className="field">Level<select value={level} onChange={e => { setLevel(e.target.value as Level); setSelected([]); }}>{levels.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="field">Coach<select name="coachId" required defaultValue={editing?.coachId ?? ""}><option value="" disabled>Choose a demo coach</option>{data.coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.name}</option>)}</select></label>
          <label className="field">Capacity (1–50)<input type="number" name="capacity" required min={1} max={50} step={1} defaultValue={editing?.capacity ?? 8} /></label>
          <label className="field md:col-span-2">Sample schedule · Tunisia time<input name="schedule" required maxLength={100} defaultValue={editing?.schedule} placeholder="Mon & Wed · 16:00" /></label>
          <fieldset className="rounded-xl border border-slate-200 p-4 md:col-span-2">
            <legend className="px-2 text-sm font-semibold">Allocate swimmers · {selected.length} selected</legend>
            <p className="mb-3 text-xs leading-5 text-slate-500">Only matching levels are shown. Selecting an allocated swimmer transfers them into this group.</p>
            <div className="grid gap-3 sm:grid-cols-2">{data.swimmers.filter(swimmer => swimmer.level === level).map(swimmer => <label key={swimmer.id} className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={selected.includes(swimmer.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, swimmer.id] : ids.filter(id => id !== swimmer.id))} />
              <span>{swimmer.name}<span className="block text-xs text-slate-500">{data.groups.find(group => group.id === swimmer.groupId)?.name ?? "Unassigned"}</span></span>
            </label>)}</div>
          </fieldset>
          <div className="flex gap-3 md:col-span-2"><button type="submit" className="button">Save demo group</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button></div>
        </fieldset>
      </form>
    </Card>}
    {data.groups.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.groups.map(group => {
      const count = data.swimmers.filter(swimmer => swimmer.groupId === group.id).length;
      return <Card key={group.id}>
        <Badge>{group.level}</Badge><h2 className="mt-5 text-xl font-semibold">{group.name}</h2>
        <p className="mt-2 text-sm text-slate-500">{data.coaches.find(coach => coach.id === group.coachId)?.name ?? "Unassigned coach"}</p>
        <dl className="mt-6 space-y-4 text-sm"><div><dt className="text-xs text-slate-500">Sample schedule · Tunisia time</dt><dd className="mt-1">{group.schedule}</dd></div>
          <div><dt className="text-xs text-slate-500">Group capacity</dt><dd className="mt-1">{count} of {group.capacity} places filled · {group.capacity - count} available</dd></div></dl>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${count / group.capacity * 100}%` }} /></div>
        <button type="button" className="mt-6 font-semibold text-cyan-800 underline underline-offset-4 text-sm" disabled={busy} onClick={() => openForm(group)} aria-label={`Open ${group.name}`}>Open / edit group</button>
      </Card>;
    })}</div> : <EmptyState title="No groups yet" description="Create a fictional training group, choose a demo coach and allocate swimmers to get started." />}
  </>;
}
