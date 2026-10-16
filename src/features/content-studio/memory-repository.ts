import type { ContentDraft, ContentRepository } from "./models";

export function createMemoryContentRepository(): ContentRepository {
  let drafts: ContentDraft[] = [];
  return {
    async list() { return structuredClone(drafts); },
    async saveAll(next) { drafts = structuredClone(next); },
  };
}
