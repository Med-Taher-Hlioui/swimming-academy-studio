import { levels } from "./models";
import type { AcademySnapshot, AttendanceStatus, GroupInput } from "./models";

export function validateGroup(data: AcademySnapshot, input: GroupInput, id?: string) {
  if (id && !data.groups.some(group => group.id === id)) throw new Error("Group not found.");
  if (!input.name.trim() || input.name.trim().length > 60) throw new Error("Group name must contain 1–60 characters.");
  if (data.groups.some(group => group.id !== id && group.name.toLowerCase() === input.name.trim().toLowerCase())) {
    throw new Error("Choose a unique group name.");
  }
  if (!levels.includes(input.level)) throw new Error("Choose a valid swimming level.");
  if (!data.coaches.some(coach => coach.id === input.coachId)) throw new Error("Choose a demo coach.");
  if (!input.schedule.trim() || input.schedule.length > 100) throw new Error("Enter a sample schedule of up to 100 characters.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 50) {
    throw new Error("Capacity must be a whole number between 1 and 50.");
  }
  if (new Set(input.swimmerIds).size !== input.swimmerIds.length) throw new Error("A swimmer can only be allocated once.");
  if (input.swimmerIds.length > input.capacity) throw new Error("Capacity cannot be lower than the selected swimmer count.");
  for (const swimmerId of input.swimmerIds) {
    const swimmer = data.swimmers.find(item => item.id === swimmerId);
    if (!swimmer) throw new Error("Swimmer not found.");
    if (swimmer.level !== input.level) throw new Error("All selected swimmers must match the group level.");
  }
}

export function updateAttendance(
  data: AcademySnapshot,
  sessionId: string,
  swimmerId: string,
  status: AttendanceStatus | null,
): AcademySnapshot {
  const session = data.sessions.find(item => item.id === sessionId);
  if (!session) throw new Error("Session not found.");
  if (!data.swimmers.some(item => item.id === swimmerId) || !session.swimmerIds.includes(swimmerId)) {
    throw new Error("This swimmer is not on the selected session roster.");
  }
  if (status !== null && status !== "Present" && status !== "Absent") throw new Error("Invalid attendance status.");
  const attendance = data.attendance.filter(item => !(item.sessionId === sessionId && item.swimmerId === swimmerId));
  if (status !== null) attendance.push({ sessionId, swimmerId, status });
  return { ...data, attendance };
}

export function validateSessionDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error("Choose a valid session date.");
  }
}
