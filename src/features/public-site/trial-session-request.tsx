"use client";

import { useId, useState } from "react";
import { trialAudiences, trialLevels, trialRequestLink } from "./trial-request-model";
import type { TrialRequestCopy } from "./trial-request-model";
import styles from "./public-site.module.css";

/** Ephemeral choices only: no submit handler, storage, analytics or network requests. */
export function TrialSessionRequest({ copy, whatsappNumber }: { copy: TrialRequestCopy; whatsappNumber: string | null }) {
  const id = useId();
  const [audience, setAudience] = useState("");
  const [level, setLevel] = useState("unknown");
  const href = trialRequestLink(whatsappNumber, audience, level, copy.message);

  return <div className={styles.trialPanel} data-trial-request data-reveal-group data-reveal="fade">
    <p className={styles.eyebrow}>{copy.freeLabel}</p>
    <h2 id={`${id}-title`} className={styles.trialTitle}>{copy.title}</h2>
    <p className={styles.description}>{copy.description}</p>
    <p className={styles.trialSchedule}>{copy.scheduleLabel}</p>
    <fieldset aria-labelledby={`${id}-title`} className={styles.trialChoices}>
      <label className="field" htmlFor={`${id}-audience`}>{copy.audienceLabel}
        <select id={`${id}-audience`} data-trial-audience value={audience} onChange={event => setAudience(event.target.value)}>
          <option value="">{copy.audiencePrompt}</option>
          {trialAudiences.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={`${id}-level`}>{copy.levelLabel}
        <select id={`${id}-level`} data-trial-level value={level} aria-describedby={`${id}-classification`} onChange={event => setLevel(event.target.value)}>
          {trialLevels.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </fieldset>
    <p id={`${id}-classification`} className={styles.smallNote}>{copy.classificationNote}</p>
    {!audience && <p role="status" className={styles.smallNote}>{copy.selectNotice}</p>}
    {href ? <a data-trial-whatsapp href={href} target="_blank" rel="noopener noreferrer" className={styles.primaryAction}>{copy.action}<span aria-hidden="true">↗</span></a> : audience && <p role="status">{copy.unavailable}</p>}
    <p className={styles.smallNote}>{copy.disclaimer}</p>
    <p className={styles.smallNote}>{copy.privacyNote}</p>
  </div>;
}
