"use client";

import { Card, EmptyState } from "@/components/ui";
import { useContentStudio } from "./content-provider";
import { shiftDate, weekDates } from "./rules";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function WeeklyCalendar() {
  const { drafts, busy, run, calendarWeek: week, showCalendarWeek } = useContentStudio();
  const days = weekDates(week);
  const planned = drafts.filter(draft => draft.status === "approved" && draft.scheduledDate);
  const visibleCount = planned.filter(draft => days.includes(draft.scheduledDate!)).length;
  return <section id="calendar" aria-labelledby="calendar-heading" className="mt-10">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div><h2 id="calendar-heading" className="text-xl font-semibold">4. Plan your week</h2><p className="mt-2 text-sm text-slate-500">{visibleCount} planned this week · {planned.length} total · Manual planning only</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <button type="button" className="secondary-button" onClick={() => showCalendarWeek(shiftDate(week, -7))} aria-label="Previous week">←</button>
        <label className="field">Week containing<input type="date" value={week} onChange={event => { if (event.target.value) showCalendarWeek(event.target.value); }} /></label>
        <button type="button" className="secondary-button" onClick={() => showCalendarWeek(shiftDate(week, 7))} aria-label="Next week">→</button>
      </div>
    </div>
    <p className="mb-4 text-xs text-slate-500">Monday {days[0]} – Sunday {days[6]}. Choose a week matching your draft’s calendar date.</p>
    {!planned.length && <div className="mb-4"><EmptyState title="Your content calendar is clear" description="Save an example, review and approve it, then choose a date on its draft card. An entry is a plan, never an automatic post." /></div>}
    {planned.length > 0 && visibleCount === 0 && <Card className="mb-4"><h3 className="font-semibold">No content planned for this week</h3><p className="mt-2 text-sm text-slate-600">Your approved plans are in another week.</p><button type="button" className="secondary-button mt-3" onClick={() => showCalendarWeek(planned[0].scheduledDate!)}>Show a planned week</button></Card>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{days.map((day, index) => {
      const entries = planned.filter(draft => draft.scheduledDate === day);
      return <section key={day} aria-label={`${dayLabels[index]} ${day}`} className="min-h-36 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold">{dayLabels[index]}<span className="mt-1 block text-xs font-normal text-slate-500">{day}</span></h3>
        {!entries.length ? <p className="mt-5 text-xs text-slate-500">No content planned</p> : <ul className="mt-4 space-y-3">{entries.map(draft => <li key={draft.id} className="rounded-lg bg-cyan-50 p-3">
          <p className="text-[10px] font-semibold text-cyan-800">{draft.brief.platform} · Approved</p>
          <p className="mt-2 break-words text-sm font-medium" lang={draft.brief.language} dir={draft.brief.language === "aeb" ? "rtl" : "ltr"}>{draft.copy.hook}</p>
          <button type="button" disabled={busy} className="mt-3 text-xs font-semibold text-cyan-800 underline" onClick={() => void run(service => service.unscheduleDraft(draft.id), "Calendar entry removed; draft kept.")}>Remove entry</button>
        </li>)}</ul>}
      </section>;
    })}</div>
  </section>;
}
