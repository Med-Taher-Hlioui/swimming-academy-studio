import type { ContentCopy, ContentDraft, ContentGenerationProvider, ContentRepository, ContentStudioService } from "./models";
import { validateBrief, validateCalendarDate, validateCopy } from "./rules";

export function createContentStudioService(repository: ContentRepository, provider: ContentGenerationProvider): ContentStudioService {
  let queue: Promise<unknown> = Promise.resolve();
  function mutate(change: (drafts: ContentDraft[]) => ContentDraft[]) {
    const result = queue.then(async () => {
      const next = change(await repository.list());
      await repository.saveAll(next);
      return next;
    });
    queue = result.catch(() => undefined);
    return result;
  }
  function changeDraft(id: string, change: (draft: ContentDraft) => ContentDraft) {
    return mutate(drafts => {
      if (!drafts.some(draft => draft.id === id)) throw new Error("Draft not found.");
      return drafts.map(draft => draft.id === id ? change(draft) : draft);
    });
  }
  return {
    providerInfo: provider.info,
    async generate(brief) {
      const examples = await provider.generate(validateBrief(brief));
      if (!Array.isArray(examples) || examples.length !== 3) throw new Error("The generator must return three examples.");
      return examples.map(validateCopy) as [ContentCopy, ContentCopy, ContentCopy];
    },
    async listDrafts() { await queue; return repository.list(); },
    saveDraft(brief, copy) {
      return mutate(drafts => [...drafts, {
        id: crypto.randomUUID(), brief: validateBrief(brief), copy: validateCopy(copy),
        status: "draft", scheduledDate: null,
      }]);
    },
    editDraft(id, copy) {
      return changeDraft(id, draft => {
        const next = validateCopy(copy);
        const changed = next.hook !== draft.copy.hook || next.caption !== draft.copy.caption || next.cta !== draft.copy.cta;
        return { ...draft, copy: next, status: changed ? "draft" : draft.status, scheduledDate: changed ? null : draft.scheduledDate };
      });
    },
    approveDraft(id) {
      return changeDraft(id, draft => ({ ...draft, copy: validateCopy(draft.copy), status: "approved" }));
    },
    scheduleDraft(id, date) {
      return changeDraft(id, draft => {
        validateCalendarDate(date);
        if (draft.status !== "approved") throw new Error("Approve this draft before adding it to the calendar.");
        return { ...draft, scheduledDate: date };
      });
    },
    unscheduleDraft(id) {
      return changeDraft(id, draft => ({ ...draft, scheduledDate: null }));
    },
  };
}
