export const platforms = ["Instagram", "Facebook", "TikTok"] as const;
export const objectives = ["awareness", "education", "parent-trust", "registrations"] as const;
export const languages = ["fr", "aeb", "en"] as const;
export type Platform = (typeof platforms)[number];
export type Objective = (typeof objectives)[number];
export type ContentLanguage = (typeof languages)[number];
export const objectiveLabels: Record<Objective, string> = {
  awareness: "Awareness", education: "Education", "parent-trust": "Parent trust", registrations: "Registrations",
};
export const languageLabels: Record<ContentLanguage, string> = {
  fr: "French", aeb: "Tunisian Arabic", en: "English",
};

export interface ContentBrief {
  platform: Platform;
  objective: Objective;
  language: ContentLanguage;
  description: string;
}
export interface ContentCopy { hook: string; caption: string; cta: string }
export type ThreeExamples = [ContentCopy, ContentCopy, ContentCopy];
export interface ProviderInfo {
  id: string;
  label: string;
  mode: "template" | "cloud";
}
export interface ContentGenerationProvider {
  readonly info: ProviderInfo;
  generate(brief: ContentBrief): Promise<ThreeExamples>;
}
export interface ContentDraft {
  id: string;
  brief: ContentBrief;
  copy: ContentCopy;
  status: "draft" | "approved";
  scheduledDate: string | null;
}
export interface ContentRepository {
  list(): Promise<ContentDraft[]>;
  saveAll(drafts: ContentDraft[]): Promise<void>;
}
export interface ContentStudioService {
  readonly providerInfo: ProviderInfo;
  generate(brief: ContentBrief): Promise<ThreeExamples>;
  listDrafts(): Promise<ContentDraft[]>;
  saveDraft(brief: ContentBrief, copy: ContentCopy): Promise<ContentDraft[]>;
  editDraft(id: string, copy: ContentCopy): Promise<ContentDraft[]>;
  approveDraft(id: string): Promise<ContentDraft[]>;
  scheduleDraft(id: string, date: string): Promise<ContentDraft[]>;
  unscheduleDraft(id: string): Promise<ContentDraft[]>;
}
