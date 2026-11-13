"use client";

import { useState } from "react";
import { publicVenue } from "@/config/public-site";
import { venueEmbed } from "./location-links";
import styles from "./experience.module.css";

export function LocationMap({ destinationUrl }: { destinationUrl: string }) {
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const [interacted, setInteracted] = useState(false);
  return <div className={styles.mapArea} data-location-map>
    <div className={styles.mapFrame} data-reveal-group data-reveal={interacted ? undefined : "up"}>
      {active && !failed ? <iframe src={venueEmbed(publicVenue.embedCoordinates)} title={publicVenue.mapTitle}
        loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen onError={() => setFailed(true)} /> :
        <div className={styles.mapPlaceholder}><span aria-hidden="true">↗</span><p>{publicVenue.name}</p><p>{publicVenue.address}</p></div>}
    </div>
    <button type="button" className={styles.mapToggle} aria-pressed={active && !failed} onClick={() => { setInteracted(true); setFailed(false); setActive(!active || failed); }}>
      {active && !failed ? "Fermer la carte pour faire défiler la page" : publicVenue.loadMapLabel}
    </button>
    <p className={styles.mapNote}>{publicVenue.mapNotice}</p>
    <p className={styles.mapNote} role={failed ? "status" : undefined}>{publicVenue.mapFallback} <a href={destinationUrl} target="_blank" rel="noopener noreferrer">Ouvrir Google Maps ↗</a></p>
  </div>;
}
