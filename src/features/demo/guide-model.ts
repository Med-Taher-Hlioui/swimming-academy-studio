export const demoSteps = [
  { title: "View dashboard", href: "/dashboard", path: "/dashboard", instruction: "Review the six live demo statistics and group occupancy. They all come from the shared fictional data." },
  { title: "Open a training group", href: "/groups", path: "/groups", instruction: "Select Open / edit group on Little Waves. Review the demo coach, two allocated swimmers and capacity of eight. You can save an edit or cancel." },
  { title: "Record attendance", href: "/attendance", path: "/attendance", instruction: "Select the 12 October Little Waves session. Change Demo Swimmer 02 from Absent to Present. Attendance updates immediately." },
  { title: "Simulate a registration", href: "/registrations", path: "/registrations", instruction: "Choose an unused demo applicant number, a swimming level and the fictional-data confirmation. Submit the enquiry. No real enrollment occurs." },
  { title: "Generate a social media caption", href: "/shark-ai#generator", path: "/shark-ai", instruction: "Choose a platform, objective and language. Use the fictional example or enter a fictional description, then generate three examples. Save one as a draft." },
  { title: "Add the draft to the content calendar", href: "/shark-ai#drafts", path: "/shark-ai", instruction: "Save an example if needed. Review its draft, approve it, choose 14 October 2026 (or another date), then Add to calendar. The calendar follows your chosen week. Nothing is published." },
] as const;

export interface StepEvidence {
  pathname: string;
  groupOpened: boolean;
  attendanceChanged: boolean;
  registrationAdded: boolean;
  captionGenerated: boolean;
  calendarAdded: boolean;
}
export function canCompleteStep(index: number, evidence: StepEvidence) {
  if (!demoSteps[index] || evidence.pathname !== demoSteps[index].path) return false;
  return [true, evidence.groupOpened, evidence.attendanceChanged, evidence.registrationAdded, evidence.captionGenerated, evidence.calendarAdded][index];
}
