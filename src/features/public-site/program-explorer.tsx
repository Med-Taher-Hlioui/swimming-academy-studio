"use client";

import { useId, useState } from "react";
import { trialAudiences, trialLevels, trialRequestLink } from "./trial-request-model";
import type { TrialRequestCopy } from "./trial-request-model";
import type { PublicPhoto } from "@/config/public-media";
import { MediaPhoto } from "./media-photo";
import styles from "./public-site.module.css";

export interface ExplorerCopy {
  title: string; levelLabel: string; action: string; note: string;
  opening: string; availability: string; visual: string; photoNote: string;
  descriptions: { child: string; adult: string; unknownLevel: string; selectedLevel: string };
}

export function ProgramExplorer({ copy, messageLabels, number, photos }: {
  copy: ExplorerCopy; messageLabels: TrialRequestCopy["message"]; number: string | null; photos: [PublicPhoto, PublicPhoto];
}) {
  const [audience, setAudience] = useState("child");
  const [level, setLevel] = useState("unknown");
  const id = useId();
  const href = trialRequestLink(number, audience, level, { ...messageLabels, opening: copy.opening, availability: copy.availability });
  const selectedAudience = trialAudiences.find(option => option.value === audience)!;
  const selectedLevel = trialLevels.find(option => option.value === level)!;
  return <div className={styles.explorer} data-program-explorer data-reveal-group>
    <div className={styles.programPhotos} data-program-visual={audience} data-reveal="up">
      <MediaPhoto asset={photos[audience === "child" ? 0 : 1]} />
      <p className={styles.smallNote}>{copy.photoNote}</p>
    </div>
    <div className={styles.explorerBody} data-reveal="up" data-reveal-order="1">
      <h3>{copy.title}</h3>
      <div role="group" aria-label="Public du programme" className={styles.audienceButtons}>
        {trialAudiences.map(option => <button type="button" key={option.value} aria-pressed={audience === option.value} onClick={() => setAudience(option.value)}>{option.value === "child" ? "Enfants dès 3 ans" : "Adultes"}</button>)}
      </div>
      <label className="field" htmlFor={`${id}-level`}>{copy.levelLabel}<select id={`${id}-level`} data-program-level value={level} onChange={event => setLevel(event.target.value)}>
        {trialLevels.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <div className={styles.programSummary} aria-live="polite" aria-atomic="true">
        <h4>{selectedAudience.label} · {selectedLevel.label}</h4>
        <p>{audience === "child" ? copy.descriptions.child : copy.descriptions.adult}</p>
        <p>{level === "unknown" ? copy.descriptions.unknownLevel : `${copy.descriptions.selectedLevel} « ${selectedLevel.label} ».`}</p>
      </div>
      <p className={styles.smallNote}>{copy.note}</p>
      {href && <a data-program-whatsapp className={styles.primaryAction} href={href} target="_blank" rel="noopener noreferrer">{copy.action} <span aria-hidden="true">↗</span></a>}
    </div>
  </div>;
}
