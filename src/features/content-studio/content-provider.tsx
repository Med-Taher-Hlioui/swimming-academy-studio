"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createDemoContentService } from "./composition";
import type { ContentBrief, ContentDraft, ContentStudioService, ProviderInfo, ThreeExamples } from "./models";
import { mondayOfWeek } from "./rules";

interface GeneratedBatch { brief: ContentBrief; examples: ThreeExamples; saved: number[] }
interface ContentContextValue {
  providerInfo: ProviderInfo;
  drafts: ContentDraft[];
  generated: GeneratedBatch | null;
  generationCount: number;
  busy: boolean;
  error: string;
  message: string;
  calendarWeek: string;
  showCalendarWeek: (date: string) => void;
  generate: (brief: ContentBrief) => Promise<void>;
  saveExample: (index: number) => Promise<void>;
  run: (operation: (service: ContentStudioService) => Promise<ContentDraft[]>, success: string) => Promise<boolean>;
}
const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentStudioProvider({ children }: { children: ReactNode }) {
  const [service] = useState(createDemoContentService);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [generated, setGenerated] = useState<GeneratedBatch | null>(null);
  const [generationCount, setGenerationCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [calendarWeek, setCalendarWeek] = useState("2026-10-12");

  async function perform(operation: () => Promise<void>, success: string) {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
      setMessage(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This content action could not be completed.");
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function run(operation: (service: ContentStudioService) => Promise<ContentDraft[]>, success: string) {
    return perform(async () => setDrafts(await operation(service)), success);
  }
  async function generate(brief: ContentBrief) {
    await perform(async () => {
      const examples = await service.generate(brief);
      setGenerated({ brief: { ...brief, description: brief.description.trim() }, examples, saved: [] });
      setGenerationCount(count => count + 1);
    }, "Three examples are ready. Review and save the ones you want to keep.");
  }
  async function saveExample(index: number) {
    if (!generated || generated.saved.includes(index) || !generated.examples[index]) return;
    await perform(async () => {
      setDrafts(await service.saveDraft(generated.brief, generated.examples[index]));
      setGenerated(previous => previous ? { ...previous, saved: [...previous.saved, index] } : null);
    }, "Draft saved in demo memory. Find it below to edit and approve.");
  }
  return <ContentContext.Provider value={{ providerInfo: service.providerInfo, drafts, generated, generationCount, busy, error, message, calendarWeek, showCalendarWeek: date => setCalendarWeek(mondayOfWeek(date)), generate, saveExample, run }}>
    {children}
  </ContentContext.Provider>;
}
export function useContentStudio() {
  const value = useContext(ContentContext);
  if (!value) throw new Error("Content Studio requires its provider.");
  return value;
}
