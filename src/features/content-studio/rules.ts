import { languages, objectives, platforms } from "./models";
import type { ContentBrief, ContentCopy } from "./models";

export function validateBrief(brief: ContentBrief): ContentBrief {
  if (!platforms.includes(brief.platform)) throw new Error("Select Instagram, Facebook or TikTok.");
  if (!objectives.includes(brief.objective)) throw new Error("Select a content objective.");
  if (!languages.includes(brief.language)) throw new Error("Select a supported language.");
  const description = brief.description.trim();
  if (description.length < 10 || description.length > 500) {
    throw new Error("Describe the fictional lesson or event in 10–500 characters.");
  }
  return { ...brief, description };
}
export function validateCopy(copy: ContentCopy): ContentCopy {
  const normalized = { hook: copy.hook.trim(), caption: copy.caption.trim(), cta: copy.cta.trim() };
  const limits = { hook: 180, caption: 2000, cta: 200 };
  for (const field of ["hook", "caption", "cta"] as const) {
    if (!normalized[field] || normalized[field].length > limits[field]) {
      throw new Error(`${field === "cta" ? "Call to action" : field} must contain 1–${limits[field]} characters.`);
    }
  }
  return normalized;
}
export function validateCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date) throw new Error("Choose a valid calendar date.");
}
export function captionText(copy: ContentCopy) {
  return [copy.hook, copy.caption, copy.cta].join("\n\n");
}
export function mondayOfWeek(date: string) {
  validateCalendarDate(date);
  const day = new Date(date + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
export function shiftDate(date: string, days: number) {
  validateCalendarDate(date);
  const day = new Date(date + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}
export function weekDates(date: string) {
  const monday = mondayOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}
