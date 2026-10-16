"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Card } from "@/components/ui";
import { useContentStudio } from "./content-provider";
import { languageLabels, languages, objectiveLabels, objectives, platforms } from "./models";
import type { ContentLanguage, Objective, Platform } from "./models";

export function GenerationForm() {
  const { busy, generate } = useContentStudio();
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<ContentLanguage>("fr");
  const examples: Record<ContentLanguage, string> = {
    fr: "Une séance fictive pour débutants autour de la flottaison avec un coach de démonstration.",
    en: "A fictional beginner lesson exploring floating with a demo coach.",
    aeb: "حصّة سباحة خياليّة للمبتدئين باش يكتشفوا الطفو مع مدرّب للتجربة.",
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await generate({
      platform: String(fields.get("platform")) as Platform,
      objective: String(fields.get("objective")) as Objective,
      language: String(fields.get("language")) as ContentLanguage,
      description,
    });
  }
  return <Card>
    <h2 id="generator" className="text-xl font-semibold">1. Shape your idea</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">Choose a channel and purpose, then describe a fictional lesson or event.</p>
    <form aria-busy={busy} onSubmit={submit} className="mt-6">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-3">
        <label className="field">Platform<select name="platform" defaultValue="Instagram">{platforms.map(platform => <option key={platform}>{platform}</option>)}</select></label>
        <label className="field">Objective<select name="objective" defaultValue="awareness">{objectives.map(objective => <option key={objective} value={objective}>{objectiveLabels[objective]}</option>)}</select></label>
        <label className="field">Output language<select name="language" value={language} onChange={event => setLanguage(event.target.value as ContentLanguage)}>{languages.map(item => <option key={item} value={item}>{languageLabels[item]}</option>)}</select></label>
        <label className="field sm:col-span-3">Fictional lesson or event
          <textarea name="description" required minLength={10} maxLength={500} rows={4} lang={language} dir={language === "aeb" ? "rtl" : "ltr"} value={description} onChange={event => setDescription(event.target.value)} placeholder="Example: A fictional beginner lesson exploring floating with a demo coach." aria-describedby="brief-help" />
        </label>
        <p id="brief-help" className="text-xs leading-5 text-slate-500 sm:col-span-3">{description.length}/500 characters · Templates use the selected language. Your description is included as written, without translation. Write it in your chosen language for consistent copy.</p>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button type="submit" className="button">{busy ? "Working…" : "Generate 3 examples"}</button>
          <button type="button" className="secondary-button" onClick={() => setDescription(examples[language])}>Use fictional example</button>
        </div>
        <p className="text-xs text-slate-500 sm:col-span-3">Generating again replaces unsaved examples. Saved drafts are kept in demo memory.</p>
      </fieldset>
    </form>
  </Card>;
}
