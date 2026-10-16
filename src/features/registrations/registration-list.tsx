"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Badge, Card, DataTable, EmptyState } from "@/components/ui";
import { useAcademy } from "@/features/academy/demo-provider";
import { levels } from "@/features/academy/models";
import type { Level } from "@/features/academy/models";

export function RegistrationList() {
  const { data, busy, run } = useAcademy();
  const [formError, setFormError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const demoNumber = Number(fields.get("demoNumber"));
    const level = String(fields.get("level")) as Level;
    const fictionalOnly = fields.get("fictionalOnly") === "on";
    setFormError("");
    if (!Number.isInteger(demoNumber) || demoNumber < 1 || demoNumber > 9999 || !levels.includes(level) || !fictionalOnly) {
      setFormError("Choose an applicant number from 1–9999, a level, and confirm fictional data only.");
      return;
    }
    if (await run(service => service.submitEnquiry({ demoNumber, level, fictionalOnly }), "Fictional enquiry added. No enrollment or message was sent.")) form.reset();
  }
  return <>
    <Card className="mb-6">
      <h2 className="text-lg font-semibold">New registration enquiry</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Practice intake with a generated alias such as “Demo Applicant 03”. Do not enter names, ages, phone numbers or other real personal information.</p>
      <form aria-busy={busy} onSubmit={submit} className="mt-5">
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label className="field">Demo applicant number<input name="demoNumber" type="number" required min={1} max={9999} step={1} placeholder="3" /></label>
          <label className="field">Requested swimming level<select name="level" required defaultValue=""><option value="" disabled>Select level</option>{levels.map(level => <option key={level}>{level}</option>)}</select></label>
          <label className="flex items-start gap-3 text-sm sm:col-span-2"><input type="checkbox" name="fictionalOnly" required /><span>I confirm this enquiry is fictional and contains no real personal information.</span></label>
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">{formError}</p>
          <div><button type="submit" className="button">Submit demo enquiry</button></div>
        </fieldset>
      </form>
    </Card>
    {data.registrations.length ? <DataTable headings={["Applicant", "Level", "Received (UTC)", "Status", "Action"]}>{data.registrations.map(record => <tr key={record.id}>
      <td className="font-medium">{record.swimmerName}</td><td>{record.level}</td><td>{record.date}</td><td><Badge>{record.status}</Badge></td>
      <td>{record.status === "Pending" ? <button disabled={busy} className="font-semibold text-cyan-800 underline underline-offset-4" onClick={() => void run(service => service.reviewRegistration(record.id), `${record.swimmerName} marked as reviewed.`)}>Mark reviewed</button> : <span className="text-xs text-slate-500">Review complete</span>}</td>
    </tr>)}</DataTable> : <EmptyState title="No registration enquiries" description="Submit a fictional enquiry above to try the local intake workflow." />}
    <p className="mt-4 text-xs leading-5 text-slate-500">Reviewing an enquiry does not create a swimmer or reserve a group place. Everything resets on reload.</p>
  </>;
}
