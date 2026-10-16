import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryContentRepository } from "../src/features/content-studio/memory-repository";
import { languages, objectives, platforms } from "../src/features/content-studio/models";
import type { ContentBrief, ContentCopy, ContentGenerationProvider, Platform, ThreeExamples } from "../src/features/content-studio/models";
import { captionText, mondayOfWeek, weekDates } from "../src/features/content-studio/rules";
import { createContentStudioService } from "../src/features/content-studio/service";
import { templateGenerationProvider } from "../src/features/content-studio/template-provider";

const brief: ContentBrief = {
  platform: "Instagram", objective: "education", language: "en",
  description: "A fictional beginner lesson exploring floating with a demo coach.",
};
const copy: ContentCopy = { hook: "A fictional lesson", caption: "Explore a demo activity in the pool.", cta: "Ask for more details." };
function setup(provider = templateGenerationProvider) {
  const repository = createMemoryContentRepository();
  return { repository, service: createContentStudioService(repository, provider) };
}

test("all 36 platform/objective/language combinations produce exactly three deterministic examples", async () => {
  const { service } = setup();
  let combinations = 0;
  for (const platform of platforms) for (const objective of objectives) for (const language of languages) {
    const request = { ...brief, platform, objective, language };
    const first = await service.generate(request);
    assert.equal(first.length, 3);
    assert.equal(new Set(first.map(item => item.hook)).size, 3);
    assert.equal(new Set(first.map(item => item.caption)).size, 3);
    assert.equal(new Set(first.map(item => item.cta)).size, 3);
    assert.deepEqual(await service.generate(request), first);
    for (const item of first) {
      assert.ok(item.caption.includes(brief.description));
      assert.ok(item.hook.length > 0 && item.cta.length > 0);
      if (language === "aeb") assert.match(item.hook, /[\u0600-\u06ff]/);
    }
    combinations++;
  }
  assert.equal(combinations, 36);
  assert.deepEqual(await service.listDrafts(), []);
  assert.equal(service.providerInfo.label, "Demo Generator");
  assert.equal(service.providerInfo.mode, "template");
});

test("platform, objective and language affect copy while descriptions remain verbatim", async () => {
  const { service } = setup();
  const english = await service.generate(brief);
  const french = await service.generate({ ...brief, language: "fr" });
  const facebook = await service.generate({ ...brief, platform: "Facebook" });
  const trust = await service.generate({ ...brief, objective: "parent-trust" });
  assert.notEqual(english[0].hook, french[0].hook);
  assert.notEqual(english[0].caption, facebook[0].caption);
  assert.notEqual(english[0].hook, trust[0].hook);
  assert.ok(french[0].caption.includes(brief.description));
});

test("generation rejects empty, short, oversized and unsupported briefs", async () => {
  const { service } = setup();
  for (const description of ["", "   ", "too short", "a".repeat(501)]) {
    await assert.rejects(service.generate({ ...brief, description }), /10–500/);
  }
  await assert.rejects(service.generate({ ...brief, platform: "Other" as Platform }), /Select Instagram/);
});

test("saving and editing drafts persists copy and metadata in the memory adapter", async () => {
  const { service } = setup();
  const saved = await service.saveDraft(brief, copy);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].status, "draft");
  assert.equal(saved[0].scheduledDate, null);
  assert.deepEqual(saved[0].brief, brief);
  const changed = { ...copy, caption: "A new fictional caption." };
  await service.editDraft(saved[0].id, changed);
  assert.deepEqual((await service.listDrafts())[0].copy, changed);
});

test("unapproved drafts cannot enter the calendar; approval and scheduling are explicit", async () => {
  const { service } = setup();
  const [draft] = await service.saveDraft(brief, copy);
  await assert.rejects(service.scheduleDraft(draft.id, "2026-10-14"), /Approve this draft/);
  assert.equal((await service.listDrafts())[0].scheduledDate, null);
  await service.approveDraft(draft.id);
  const [scheduled] = await service.scheduleDraft(draft.id, "2026-10-14");
  assert.equal(scheduled.status, "approved");
  assert.equal(scheduled.scheduledDate, "2026-10-14");
});

test("moving a calendar entry does not duplicate it; removal keeps the approved draft", async () => {
  const { service } = setup();
  const [draft] = await service.saveDraft(brief, copy);
  await service.approveDraft(draft.id);
  await service.scheduleDraft(draft.id, "2026-10-14");
  const moved = await service.scheduleDraft(draft.id, "2026-10-16");
  assert.equal(moved.length, 1);
  assert.equal(moved[0].scheduledDate, "2026-10-16");
  const [removed] = await service.unscheduleDraft(draft.id);
  assert.equal(removed.scheduledDate, null);
  assert.equal(removed.status, "approved");
});

test("editing approved content revokes approval and removes the calendar entry", async () => {
  const { service } = setup();
  const [draft] = await service.saveDraft(brief, copy);
  await service.approveDraft(draft.id);
  await service.scheduleDraft(draft.id, "2026-10-14");
  const [edited] = await service.editDraft(draft.id, { ...copy, hook: "Edited hook" });
  assert.equal(edited.status, "draft");
  assert.equal(edited.scheduledDate, null);
  await assert.rejects(service.scheduleDraft(draft.id, "2026-10-14"), /Approve this draft/);
});

test("saving unchanged normalized copy preserves approval and calendar placement", async () => {
  const { service } = setup();
  const [draft] = await service.saveDraft(brief, copy);
  await service.approveDraft(draft.id);
  await service.scheduleDraft(draft.id, "2026-10-14");
  const [same] = await service.editDraft(draft.id, { ...copy, hook: ` ${copy.hook} ` });
  assert.equal(same.status, "approved");
  assert.equal(same.scheduledDate, "2026-10-14");
});

test("invalid copy, dates and missing drafts fail without changing stored content", async () => {
  const { service } = setup();
  const [draft] = await service.saveDraft(brief, copy);
  await service.approveDraft(draft.id);
  const before = await service.listDrafts();
  await assert.rejects(service.editDraft(draft.id, { ...copy, caption: "  " }), /caption must contain/);
  await assert.rejects(service.editDraft(draft.id, { ...copy, hook: "a".repeat(181) }), /hook must contain/);
  for (const date of ["2026-02-30", "not-a-date", "2026-1-2"]) {
    await assert.rejects(service.scheduleDraft(draft.id, date), /valid calendar date/);
  }
  await assert.rejects(service.approveDraft("missing"), /Draft not found/);
  assert.deepEqual(await service.listDrafts(), before);
});

test("weekly calendar uses Monday through Sunday across month/year boundaries", () => {
  assert.equal(mondayOfWeek("2026-10-18"), "2026-10-12");
  assert.deepEqual(weekDates("2027-01-01"), [
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
  ]);
});

test("clipboard text combines the current hook, caption and CTA without HTML", () => {
  assert.equal(captionText(copy), `${copy.hook}\n\n${copy.caption}\n\n${copy.cta}`);
});

test("generation provider is replaceable without changing service consumers", async () => {
  let received: ContentBrief | undefined;
  const replacement: ContentGenerationProvider = {
    info: { id: "fake-test-provider", label: "Test provider", mode: "cloud" },
    async generate(input) { received = input; return [copy, copy, copy]; },
  };
  const { service } = setup(replacement);
  assert.deepEqual(await service.generate({ ...brief, description: ` ${brief.description} ` }), [copy, copy, copy]);
  assert.deepEqual(received, brief);
  assert.equal(service.providerInfo.id, "fake-test-provider");
});

test("malformed provider output and provider errors are surfaced, never saved", async () => {
  const malformed: ContentGenerationProvider = {
    info: { id: "test", label: "Test", mode: "template" },
    async generate() { return [copy] as unknown as ThreeExamples; },
  };
  const { service } = setup(malformed);
  await assert.rejects(service.generate(brief), /three examples/);
  assert.deepEqual(await service.listDrafts(), []);
  const failing: ContentGenerationProvider = {
    ...malformed, async generate() { throw new Error("Provider unavailable"); },
  };
  await assert.rejects(setup(failing).service.generate(brief), /Provider unavailable/);
});

test("queued draft saves are preserved; repositories clone data and isolate workspaces", async () => {
  const { service } = setup();
  await Promise.all([service.saveDraft(brief, copy), service.saveDraft(brief, { ...copy, hook: "Another hook" })]);
  const drafts = await service.listDrafts();
  assert.equal(drafts.length, 2);
  drafts[0].copy.hook = "Mutated outside repository";
  assert.equal((await service.listDrafts())[0].copy.hook, copy.hook);
  assert.deepEqual(await setup().service.listDrafts(), []);
});
