export const levels = ["Beginner", "Developing", "Advanced"] as const;
export type Level = (typeof levels)[number];

export interface Swimmer {
  id: string;
  name: string;
  level: Level;
  groupId: string;
  status: "Active" | "Trial";
}
export interface Coach { id: string; name: string }
export interface Group {
  id: string;
  name: string;
  level: Level;
  coachId: string;
  schedule: string;
  capacity: number;
}
export interface Session {
  id: string;
  groupId: string;
  date: string;
  // A snapshot: later group transfers do not rewrite historical attendance.
  swimmerIds: string[];
}
export type AttendanceStatus = "Present" | "Absent";
export interface Attendance {
  swimmerId: string;
  sessionId: string;
  status: AttendanceStatus;
}
export interface Registration {
  id: string;
  swimmerName: string;
  level: Level;
  status: "Pending" | "Reviewed";
  date: string;
}
export interface AcademySnapshot {
  swimmers: Swimmer[];
  coaches: Coach[];
  groups: Group[];
  sessions: Session[];
  attendance: Attendance[];
  registrations: Registration[];
}
export interface GroupInput {
  name: string;
  level: Level;
  coachId: string;
  schedule: string;
  capacity: number;
  swimmerIds: string[];
}
export interface EnquiryInput {
  demoNumber: number;
  level: Level;
  fictionalOnly: boolean;
}
export interface AcademyRepository {
  getSnapshot(): Promise<AcademySnapshot>;
  saveSnapshot(snapshot: AcademySnapshot): Promise<void>;
}
export interface Dashboard extends AcademySnapshot {
  attendanceRate: number | null;
  pendingRegistrations: number;
  availablePlaces: number;
}
export interface AcademyService {
  getDashboard(): Promise<Dashboard>;
  saveGroup(input: GroupInput, id?: string): Promise<Dashboard>;
  createSession(groupId: string, date: string): Promise<Dashboard>;
  markAttendance(sessionId: string, swimmerId: string, status: AttendanceStatus | null): Promise<Dashboard>;
  submitEnquiry(input: EnquiryInput): Promise<Dashboard>;
  reviewRegistration(id: string): Promise<Dashboard>;
}
