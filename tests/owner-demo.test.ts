import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryAcademyRepository } from "../src/features/academy/mock-repository";
import { createAcademyService } from "../src/features/academy/service";
import { createDemoContentService } from "../src/features/content-studio/composition";
import { canCompleteStep, demoSteps } from "../src/features/demo/guide-model";
import type { StepEvidence } from "../src/features/demo/guide-model";

const emptyEvidence: StepEvidence = {
  pathname: "/dashboard", groupOpened: false, attendanceChanged: false,
  registrationAdded: false, captionGenerated: false, calendarAdded: false,
};

test("walkthrough has the requested six steps in order and never skips uncompleted actions", () => {
  assert.equal(demoSteps.length, 6);
  assert.deepEqual(demoSteps.map(step => step.path), ["/dashboard", "/groups", "/attendance", "/registrations", "/shark-ai", "/shark-ai"]);
  assert.equal(canCompleteStep(0, emptyEvidence), true);
  for (let index = 1; index < demoSteps.length; index++) {
    assert.equal(canCompleteStep(index, { ...emptyEvidence, pathname: demoSteps[index].path }), false);
  }
  assert.equal(canCompleteStep(6, emptyEvidence), false);
  assert.equal(canCompleteStep(-1, emptyEvidence), false);
});

test("each step requires its matching route and action evidence", () => {
  const complete = {
    pathname: "/dashboard", groupOpened: true, attendanceChanged: true,
    registrationAdded: true, captionGenerated: true, calendarAdded: true,
  };
  demoSteps.forEach((step, index) => {
    assert.equal(canCompleteStep(index, { ...complete, pathname: step.path }), true);
    assert.equal(canCompleteStep(index, { ...complete, pathname: "/settings" }), false);
  });
});

test("owner walkthrough works from dashboard to approved calendar using actual services", async () => {
  const academy = createAcademyService(createMemoryAcademyRepository());
  const content = createDemoContentService();
  const baseline = await academy.getDashboard();
  assert.equal(baseline.swimmers.length, 6);
  assert.equal(baseline.attendanceRate, 75);
  const group = baseline.groups.find(item => item.name === "Little Waves")!;
  assert.ok(group);
  assert.equal(baseline.coaches.find(coach => coach.id === group.coachId)?.name, "Demo Coach A");
  assert.equal(baseline.swimmers.filter(swimmer => swimmer.groupId === group.id).length, 2);
  const attendance = await academy.markAttendance("session1", "s2", "Present");
  assert.equal(attendance.attendanceRate, 100);
  const enquiry = await academy.submitEnquiry({ demoNumber: 3, level: "Beginner", fictionalOnly: true });
  assert.equal(enquiry.pendingRegistrations, baseline.pendingRegistrations + 1);
  const brief = {
    platform: "Instagram" as const, objective: "awareness" as const,
    language: "fr" as const, description: "Une séance fictive de flottaison avec un coach de démonstration.",
  };
  const examples = await content.generate(brief);
  assert.equal(examples.length, 3);
  const [draft] = await content.saveDraft(brief, examples[0]);
  await content.approveDraft(draft.id);
  const [planned] = await content.scheduleDraft(draft.id, "2026-10-14");
  assert.equal(planned.status, "approved");
  assert.equal(planned.scheduledDate, "2026-10-14");
  assert.equal((await academy.getDashboard()).attendanceRate, 100);
});

test("fresh demo adapters restore academy records and clear content plans", async () => {
  const academy = createAcademyService(createMemoryAcademyRepository());
  await academy.markAttendance("session1", "s2", "Present");
  const resetAcademy = createAcademyService(createMemoryAcademyRepository());
  assert.equal((await resetAcademy.getDashboard()).attendanceRate, 75);
  assert.equal((await resetAcademy.getDashboard()).pendingRegistrations, 1);
  assert.deepEqual(await createDemoContentService().listDrafts(), []);
});


test("public homepage cannot complete a workspace tour step", () => {
  assert.equal(canCompleteStep(0, { ...emptyEvidence, pathname: "/" }), false);
  assert.equal(demoSteps[0].href, "/dashboard");
});
