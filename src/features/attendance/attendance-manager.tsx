"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Card, DataTable, EmptyState } from "@/components/ui";
import { useAcademy } from "@/features/academy/demo-provider";
import type { AttendanceStatus } from "@/features/academy/models";

export function AttendanceManager() {
  const { data, busy, run } = useAcademy();
  const [selectedId, setSelectedId] = useState(data.sessions[0]?.id ?? "");
  const session = data.sessions.find(item => item.id === selectedId);
  const roster = session ? data.swimmers.filter(swimmer => session.swimmerIds.includes(swimmer.id)) : [];
  const records = data.attendance.filter(item => item.sessionId === selectedId);
  const present = records.filter(item => item.status === "Present").length;

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const groupId = String(fields.get("groupId"));
    const date = String(fields.get("date"));
    await run(async service => {
      const next = await service.createSession(groupId, date);
      setSelectedId(next.sessions.find(item => item.groupId === groupId && item.date === date)!.id);
      return next;
    }, "Demo session created from the current group roster.");
  }
  return <>
    <Card className="mb-6">
      <h2 className="font-semibold">Create a demo session</h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">One session per group per date. The roster captures the group’s current swimmers.</p>
      <form aria-busy={busy} onSubmit={createSession} className="mt-4">
        <fieldset disabled={busy} className="flex flex-wrap items-end gap-4">
          <label className="field flex-1">Group<select name="groupId" required defaultValue=""><option value="" disabled>Choose group</option>{data.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          <label className="field">Date<input name="date" type="date" required /></label>
          <button type="submit" className="button">Create session</button>
        </fieldset>
      </form>
    </Card>
    <label className="field mb-5 max-w-xl">Selected session<select value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={busy}>
      {!data.sessions.length && <option value="">No sessions available</option>}
      {data.sessions.map(item => <option key={item.id} value={item.id}>{item.date} · {data.groups.find(group => group.id === item.groupId)?.name ?? "Unknown group"}</option>)}
    </select></label>
    <p className="mb-4 text-sm text-slate-500" aria-live="polite">{present} present · {records.length - present} absent · {roster.length - records.length} unmarked</p>
    {roster.length ? <DataTable headings={["Swimmer", "Level", "Attendance"]}>{roster.map(swimmer => {
      const status = records.find(item => item.swimmerId === swimmer.id)?.status ?? "";
      return <tr key={swimmer.id}><td className="font-medium">{swimmer.name}</td><td>{swimmer.level}</td><td>
        <select aria-label={`Attendance for ${swimmer.name}`} value={status} disabled={busy} onChange={e => {
          const next = e.target.value as AttendanceStatus | "";
          void run(service => service.markAttendance(selectedId, swimmer.id, next || null), `${swimmer.name}: ${next || "Unmarked"}.`);
        }}><option value="">Unmarked</option><option value="Present">Present</option><option value="Absent">Absent</option></select>
      </td></tr>;
    })}</DataTable> : <EmptyState title="No session roster" description="Create a session for a group with allocated swimmers, then mark each swimmer present or absent." />}
    <p className="mt-4 text-xs leading-5 text-slate-500">Marks save to memory immediately. Unmarked swimmers are excluded from the dashboard attendance percentage. Historical rosters remain unchanged after group transfers.</p>
  </>;
}
