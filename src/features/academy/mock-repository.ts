import type { AcademyRepository, AcademySnapshot } from "./models";

// Fictional, intentionally anonymous fixtures. No real identities or contact details.
export function createDemoSnapshot(): AcademySnapshot {
  return {
    swimmers: [
      { id: "s1", name: "Demo Swimmer 01", level: "Beginner", groupId: "g1", status: "Active" },
      { id: "s2", name: "Demo Swimmer 02", level: "Beginner", groupId: "g1", status: "Trial" },
      { id: "s3", name: "Demo Swimmer 03", level: "Developing", groupId: "g2", status: "Active" },
      { id: "s4", name: "Demo Swimmer 04", level: "Advanced", groupId: "g3", status: "Active" },
      { id: "s5", name: "Demo Swimmer 05", level: "Developing", groupId: "g2", status: "Active" },
      { id: "s6", name: "Demo Swimmer 06", level: "Advanced", groupId: "g3", status: "Active" },
    ],
    coaches: [
      { id: "c1", name: "Demo Coach A" },
      { id: "c2", name: "Demo Coach B" },
      { id: "c3", name: "Demo Coach C" },
    ],
    groups: [
      { id: "g1", name: "Little Waves", level: "Beginner", coachId: "c1", schedule: "Mon & Wed · 16:00", capacity: 8 },
      { id: "g2", name: "Blue Current", level: "Developing", coachId: "c2", schedule: "Tue & Thu · 17:00", capacity: 10 },
      { id: "g3", name: "Deep Divers", level: "Advanced", coachId: "c3", schedule: "Fri & Sat · 18:00", capacity: 8 },
    ],
    sessions: [
      { id: "session1", groupId: "g1", date: "2026-10-12", swimmerIds: ["s1", "s2"] },
      { id: "session2", groupId: "g2", date: "2026-10-13", swimmerIds: ["s3", "s5"] },
      { id: "session3", groupId: "g3", date: "2026-10-16", swimmerIds: ["s4", "s6"] },
    ],
    attendance: [
      { swimmerId: "s1", sessionId: "session1", status: "Present" },
      { swimmerId: "s2", sessionId: "session1", status: "Absent" },
      { swimmerId: "s3", sessionId: "session2", status: "Present" },
      { swimmerId: "s5", sessionId: "session2", status: "Present" },
    ],
    registrations: [
      { id: "r1", swimmerName: "Demo Applicant 01", level: "Beginner", status: "Pending", date: "2026-10-10" },
      { id: "r2", swimmerName: "Demo Applicant 02", level: "Developing", status: "Reviewed", date: "2026-10-11" },
    ],
  };
}

// Create once per mounted demo provider, never as mutable server-global state.
export function createMemoryAcademyRepository(seed = createDemoSnapshot()): AcademyRepository {
  let snapshot = structuredClone(seed);
  return {
    async getSnapshot() { return structuredClone(snapshot); },
    async saveSnapshot(next) { snapshot = structuredClone(next); },
  };
}
