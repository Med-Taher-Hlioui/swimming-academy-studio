import type { Metadata } from "next";
import { PageHeading } from "@/components/ui";
import { AttendanceManager } from "@/features/attendance/attendance-manager";

export default function AttendancePage() {
  return <>
    <PageHeading title="Attendance" description="Choose a demo session and mark its roster. All attendance is fictional and stored in memory only." />
    <AttendanceManager />
  </>;
}

export const metadata: Metadata = { title: "Attendance" };
