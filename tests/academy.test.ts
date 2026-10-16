import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoSnapshot, createMemoryAcademyRepository } from "../src/features/academy/mock-repository";
import { createAcademyService } from "../src/features/academy/service";
import type { AttendanceStatus, GroupInput } from "../src/features/academy/models";

function setup() {
  const repository = createMemoryAcademyRepository();
  return { repository, service: createAcademyService(repository) };
}
function groupInput(overrides: Partial<GroupInput> = {}): GroupInput {
  return {
    name: "Little Waves", level: "Beginner", coachId: "c1",
    schedule: "Mon 16:00", capacity: 8, swimmerIds: ["s1", "s2"], ...overrides,
  };
}

test("attendance is upserted once per swimmer/session and dashboard tracks changes", async () => {
  const { service } = setup();
  assert.equal((await service.getDashboard()).attendanceRate, 75);
  let data = await service.markAttendance("session1", "s2", "Present");
  assert.equal(data.attendance.length, 4);
  assert.equal(data.attendanceRate, 100);
  data = await service.markAttendance("session1", "s2", "Present");
  assert.equal(data.attendance.length, 4);
  data = await service.markAttendance("session1", "s2", "Absent");
  assert.equal(data.attendanceRate, 75);
});

test("unmarking removes a record; unmarked swimmers are excluded from the percentage", async () => {
  const { service } = setup();
  const data = await service.markAttendance("session1", "s2", null);
  assert.equal(data.attendance.length, 3);
  assert.equal(data.attendanceRate, 100);
  assert.equal(data.attendance.some(record => record.sessionId === "session1" && record.swimmerId === "s2"), false);
});

test("zero attendance has a null rate, not a fabricated zero percent", async () => {
  const seed = createDemoSnapshot();
  seed.attendance = [];
  const service = createAcademyService(createMemoryAcademyRepository(seed));
  assert.equal((await service.getDashboard()).attendanceRate, null);
});

test("attendance rejects nonexistent sessions, outsiders and invalid status without mutation", async () => {
  const { service } = setup();
  const before = await service.getDashboard();
  await assert.rejects(service.markAttendance("missing", "s1", "Present"), /Session not found/);
  await assert.rejects(service.markAttendance("session1", "s3", "Present"), /not on/);
  await assert.rejects(service.markAttendance("session1", "missing", "Present"), /not on/);
  await assert.rejects(service.markAttendance("session1", "s1", "Late" as AttendanceStatus), /Invalid attendance/);
  assert.deepEqual(await service.getDashboard(), before);
});

test("attendance marks are isolated by session, including a new session with the same swimmers", async () => {
  const { service } = setup();
  const next = await service.createSession("g1", "2026-10-19");
  const session = next.sessions.at(-1)!;
  const marked = await service.markAttendance(session.id, "s1", "Absent");
  assert.equal(marked.attendance.find(record => record.sessionId === "session1" && record.swimmerId === "s1")?.status, "Present");
  assert.equal(marked.attendance.find(record => record.sessionId === session.id && record.swimmerId === "s1")?.status, "Absent");
});

test("session creation rejects duplicates and invalid dates", async () => {
  const { service } = setup();
  await assert.rejects(service.createSession("g1", "2026-10-12"), /already has/);
  await assert.rejects(service.createSession("g1", "2026-02-30"), /valid session date/);
  await assert.rejects(service.createSession("g1", "invalid"), /valid session date/);
  await assert.rejects(service.createSession("missing", "2026-10-19"), /existing group/);
});

test("capacity permits exactly full groups", async () => {
  const { service } = setup();
  const data = await service.saveGroup(groupInput({ capacity: 2 }), "g1");
  assert.equal(data.groups.find(group => group.id === "g1")?.capacity, 2);
  assert.equal(data.availablePlaces, 14);
});

test("capacity cannot shrink below allocated swimmers and rejection is atomic", async () => {
  const { service } = setup();
  const before = await service.getDashboard();
  await assert.rejects(service.saveGroup(groupInput({ capacity: 1 }), "g1"), /selected swimmer count/);
  assert.deepEqual(await service.getDashboard(), before);
});

test("capacity must be an integer in the allowed range", async () => {
  const { service } = setup();
  for (const capacity of [0, -1, 2.5, 51, NaN, Infinity]) {
    await assert.rejects(service.saveGroup(groupInput({ capacity }), "g1"), /whole number/);
  }
});

test("duplicate swimmers, mismatched levels, unknown swimmers and coaches are rejected", async () => {
  const { service } = setup();
  await assert.rejects(service.saveGroup(groupInput({ swimmerIds: ["s1", "s1"] }), "g1"), /only be allocated once/);
  await assert.rejects(service.saveGroup(groupInput({ swimmerIds: ["s3"] }), "g1"), /match the group level/);
  await assert.rejects(service.saveGroup(groupInput({ swimmerIds: ["missing"] }), "g1"), /Swimmer not found/);
  await assert.rejects(service.saveGroup(groupInput({ coachId: "missing" }), "g1"), /demo coach/);
});

test("group creation transfers swimmers without duplication and preserves historical rosters", async () => {
  const { service } = setup();
  let data = await service.saveGroup(groupInput({ name: "Demo New Waves", capacity: 1, swimmerIds: ["s1"], coachId: "c2" }));
  const group = data.groups.find(item => item.name === "Demo New Waves")!;
  assert.equal(group.coachId, "c2");
  assert.equal(data.swimmers.filter(swimmer => swimmer.groupId === group.id).length, 1);
  assert.equal(data.swimmers.filter(swimmer => swimmer.groupId === "g1").length, 1);
  assert.deepEqual(data.sessions.find(session => session.id === "session1")?.swimmerIds, ["s1", "s2"]);
  data = await service.markAttendance("session1", "s1", "Absent");
  assert.equal(data.attendance.find(record => record.sessionId === "session1" && record.swimmerId === "s1")?.status, "Absent");
});

test("removing an allocation makes a swimmer unassigned and empty groups cannot create sessions", async () => {
  const { service } = setup();
  const data = await service.saveGroup(groupInput({ swimmerIds: [] }), "g1");
  assert.equal(data.swimmers.find(swimmer => swimmer.id === "s1")?.groupId, "");
  await assert.rejects(service.createSession("g1", "2026-10-19"), /Allocate swimmers/);
});

test("queued writes do not lose attendance updates and recover after a rejected operation", async () => {
  const { service } = setup();
  await assert.rejects(service.saveGroup(groupInput({ capacity: 0 }), "g1"));
  await Promise.all([
    service.markAttendance("session3", "s4", "Present"),
    service.markAttendance("session3", "s6", "Absent"),
  ]);
  const data = await service.getDashboard();
  assert.equal(data.attendance.length, 6);
  assert.equal(data.attendanceRate, 67);
});

test("fictional enquiries are validated, deduplicated and reflected in dashboard reviews", async () => {
  const { service } = setup();
  await assert.rejects(service.submitEnquiry({ demoNumber: 3, level: "Beginner", fictionalOnly: false }), /fictional/);
  await assert.rejects(service.submitEnquiry({ demoNumber: 0, level: "Beginner", fictionalOnly: true }), /whole number/);
  let data = await service.submitEnquiry({ demoNumber: 3, level: "Beginner", fictionalOnly: true });
  assert.equal(data.pendingRegistrations, 2);
  const added = data.registrations.at(-1)!;
  assert.equal(added.swimmerName, "Demo Applicant 03");
  await assert.rejects(service.submitEnquiry({ demoNumber: 3, level: "Beginner", fictionalOnly: true }), /already has/);
  data = await service.reviewRegistration(added.id);
  assert.equal(data.pendingRegistrations, 1);
  assert.equal(data.swimmers.length, 6);
});

test("repository snapshots are cloned and independent instances are isolated", async () => {
  const { repository, service } = setup();
  const snapshot = await repository.getSnapshot();
  snapshot.groups[0].capacity = 999;
  assert.equal((await repository.getSnapshot()).groups[0].capacity, 8);
  await service.saveGroup(groupInput({ capacity: 2 }), "g1");
  assert.equal((await createMemoryAcademyRepository().getSnapshot()).groups[0].capacity, 8);
});
