"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAcademy } from "@/features/academy/demo-provider";
import { useContentStudio } from "@/features/content-studio/content-provider";
import { canCompleteStep, demoSteps } from "./guide-model";

interface TourState {
  index: number;
  groupOpened: boolean;
  baselineAttendance: string;
  baselineRegistrations: number;
  baselineGenerations: number;
  baselineDrafts: number;
  baselineCalendar: Record<string, string | null>;
}
interface GuideContextValue {
  tour: TourState | null;
  ready: boolean;
  finished: boolean;
  start: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  recordGroupOpened: () => void;
}
const GuideContext = createContext<GuideContextValue | null>(null);

export function DemoGuideProvider({ children }: { children: ReactNode }) {
  const { data } = useAcademy();
  const { drafts, generationCount } = useContentStudio();
  const pathname = usePathname();
  const [tour, setTour] = useState<TourState | null>(null);
  const ready = tour ? canCompleteStep(tour.index, {
    pathname,
    groupOpened: tour.groupOpened,
    attendanceChanged: JSON.stringify(data.attendance) !== tour.baselineAttendance,
    registrationAdded: data.registrations.length > tour.baselineRegistrations,
    captionGenerated: generationCount > tour.baselineGenerations && drafts.length > tour.baselineDrafts,
    calendarAdded: drafts.some(draft => draft.status === "approved" && draft.scheduledDate && draft.scheduledDate !== tour.baselineCalendar[draft.id]),
  }) : false;
  function start() {
    setTour({
      index: 0, groupOpened: false,
      baselineAttendance: JSON.stringify(data.attendance),
      baselineRegistrations: data.registrations.length,
      baselineGenerations: generationCount,
      baselineDrafts: drafts.length,
      baselineCalendar: Object.fromEntries(drafts.map(draft => [draft.id, draft.scheduledDate])),
    });
  }
  return <GuideContext.Provider value={{
    tour, ready, finished: tour?.index === demoSteps.length,
    start, stop: () => setTour(null),
    next: () => { if (ready) setTour(current => current ? { ...current, index: current.index + 1 } : null); },
    previous: () => setTour(current => current ? { ...current, index: Math.max(0, current.index - 1) } : null),
    recordGroupOpened: () => setTour(current => current ? { ...current, groupOpened: true } : null),
  }}>{children}</GuideContext.Provider>;
}
export function useDemoGuide() {
  const guide = useContext(GuideContext);
  if (!guide) throw new Error("Demo guide requires its provider.");
  return guide;
}
