import { levels } from "./models";
import type { AcademyRepository, AcademyService, AcademySnapshot, Dashboard } from "./models";
import { updateAttendance, validateGroup, validateSessionDate } from "./rules";

export function deriveDashboard(data: AcademySnapshot): Dashboard {
  const present = data.attendance.filter(record => record.status === "Present").length;
  return {
    ...data,
    attendanceRate: data.attendance.length ? Math.round(present / data.attendance.length * 100) : null,
    pendingRegistrations: data.registrations.filter(record => record.status === "Pending").length,
    availablePlaces: data.groups.reduce((total, group) => total + group.capacity -
      data.swimmers.filter(swimmer => swimmer.groupId === group.id).length, 0),
  };
}

export function createAcademyService(repository: AcademyRepository): AcademyService {
  // Serialize read-modify-write operations, including simultaneous button clicks.
  let queue: Promise<unknown> = Promise.resolve();
  function mutate(change: (data: AcademySnapshot) => AcademySnapshot) {
    const result = queue.then(async () => {
      const next = change(await repository.getSnapshot());
      await repository.saveSnapshot(next);
      return deriveDashboard(next);
    });
    queue = result.catch(() => undefined);
    return result;
  }
  return {
    async getDashboard() { await queue; return deriveDashboard(await repository.getSnapshot()); },
    saveGroup(input, id) {
      return mutate(data => {
        validateGroup(data, input, id);
        const groupId = id ?? crypto.randomUUID();
        const group = {
          id: groupId, name: input.name.trim(), level: input.level,
          coachId: input.coachId, schedule: input.schedule.trim(), capacity: input.capacity,
        };
        return {
          ...data,
          groups: id ? data.groups.map(item => item.id === id ? group : item) : [...data.groups, group],
          swimmers: data.swimmers.map(swimmer => ({
            ...swimmer,
            groupId: input.swimmerIds.includes(swimmer.id) ? groupId : swimmer.groupId === groupId ? "" : swimmer.groupId,
          })),
        };
      });
    },
    createSession(groupId, date) {
      return mutate(data => {
        if (!data.groups.some(group => group.id === groupId)) throw new Error("Choose an existing group.");
        validateSessionDate(date);
        if (data.sessions.some(session => session.groupId === groupId && session.date === date)) {
          throw new Error("This group already has a session on that date.");
        }
        const swimmerIds = data.swimmers.filter(swimmer => swimmer.groupId === groupId).map(swimmer => swimmer.id);
        if (!swimmerIds.length) throw new Error("Allocate swimmers to the group before creating a session.");
        return { ...data, sessions: [...data.sessions, { id: crypto.randomUUID(), groupId, date, swimmerIds }] };
      });
    },
    markAttendance(sessionId, swimmerId, status) {
      return mutate(data => updateAttendance(data, sessionId, swimmerId, status));
    },
    submitEnquiry(input) {
      return mutate(data => {
        if (!input.fictionalOnly) throw new Error("Confirm that this is a fictional enquiry.");
        if (!Number.isInteger(input.demoNumber) || input.demoNumber < 1 || input.demoNumber > 9999) {
          throw new Error("Demo applicant number must be a whole number between 1 and 9999.");
        }
        if (!levels.includes(input.level)) throw new Error("Choose a valid swimming level.");
        const swimmerName = `Demo Applicant ${String(input.demoNumber).padStart(2, "0")}`;
        if (data.registrations.some(item => item.swimmerName === swimmerName)) throw new Error("That demo applicant already has an enquiry.");
        return { ...data, registrations: [...data.registrations, {
          id: crypto.randomUUID(), swimmerName, level: input.level, status: "Pending",
          date: new Date().toISOString().slice(0, 10),
        }] };
      });
    },
    reviewRegistration(id) {
      return mutate(data => {
        if (!data.registrations.some(item => item.id === id)) throw new Error("Registration not found.");
        return { ...data, registrations: data.registrations.map(item => item.id === id ? { ...item, status: "Reviewed" } : item) };
      });
    },
  };
}
