import { whatsappLink } from "./contact-links";

export const trialAudiences = [
  { value: "child", label: "Enfant (3 ans et plus)" },
  { value: "adult", label: "Adulte" },
] as const;
export const trialLevels = [
  { value: "unknown", label: "Je ne sais pas" },
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
] as const;
export type TrialAudience = typeof trialAudiences[number]["value"];
export type TrialLevel = typeof trialLevels[number]["value"];

export interface TrialRequestCopy {
  title: string; description: string; audienceLabel: string; audiencePrompt: string;
  levelLabel: string; classificationNote: string; action: string; selectNotice: string;
  privacyNote: string; disclaimer: string; unavailable: string;
  freeLabel: string; scheduleLabel: string;
  message: { opening: string; audienceLabel: string; levelLabel: string; availability: string };
}

/** Only two enum selections enter the message; arbitrary fields/text are never accepted. */
export function trialMessage(audience: string, level: string, copy: TrialRequestCopy["message"]): string | null {
  const selectedAudience = trialAudiences.find(option => option.value === audience);
  const selectedLevel = trialLevels.find(option => option.value === level);
  if (!selectedAudience || !selectedLevel) return null;
  return [copy.opening, `${copy.audienceLabel} : ${selectedAudience.label}`, `${copy.levelLabel} : ${selectedLevel.label}`, copy.availability].join("\n");
}

export function trialRequestLink(number: string | null, audience: string, level: string, copy: TrialRequestCopy["message"]): string | null {
  const message = trialMessage(audience, level, copy);
  return message ? whatsappLink(number, message) : null;
}
