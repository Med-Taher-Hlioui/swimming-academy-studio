"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { PublicSiteConfig } from "@/config/public-site";
import styles from "./public-site.module.css";
import { staticPreferred } from "./motion-preferences";

export function CoachCarousel({ coaches, portraitLabel }: { coaches: PublicSiteConfig["coaches"]; portraitLabel: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  function move(next: number) {
    const bounded = Math.max(0, Math.min(coaches.length - 1, next));
    const reduced = staticPreferred();
    const card = track.current?.children[bounded] as HTMLElement | undefined;
    track.current?.scrollTo({ left: card?.offsetLeft ?? 0, behavior: reduced ? "instant" : "smooth" });
    setIndex(bounded);
  }
  return <div className={styles.carousel}>
    <div className={styles.carouselControls}>
      <p aria-live="polite">{index + 1} / {coaches.length}</p>
      <button type="button" aria-label="Coach précédent" disabled={index === 0} onClick={() => move(index - 1)}>←</button>
      <button type="button" aria-label="Coach suivant" disabled={index === coaches.length - 1} onClick={() => move(index + 1)}>→</button>
    </div>
    <div ref={track} className={styles.coachTrack} tabIndex={0} role="region" aria-label="Les coachs Shark Aquatics" data-reveal-group onScroll={() => {
      const node = track.current;
      if (!node) return;
      const offsets = Array.from(node.children).map(child => Math.abs((child as HTMLElement).offsetLeft - node.scrollLeft));
      setIndex(offsets.indexOf(Math.min(...offsets)));
    }} onKeyDown={event => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(index + (event.key === "ArrowRight" ? 1 : -1)); }
      if (event.key === "Home" || event.key === "End") { event.preventDefault(); move(event.key === "Home" ? 0 : coaches.length - 1); }
    }}>
      {coaches.map((coach, position) => <article key={coach.id} className={styles.coachCard} data-reveal="up" data-reveal-order={position} data-motion-card data-active={position === index}>
        <div className={styles.portrait}>
          {coach.photo ? <Image src={coach.photo.src} alt={coach.name} width={coach.photo.width} height={coach.photo.height}
            sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1200px) 45vw, 560px"
            loading="lazy" className={styles.coachPhoto} style={{ objectPosition: coach.photo.position }} /> :
            <><span aria-hidden="true">{coach.name.replace("Coach ", "").slice(0, 1)}</span><p>{portraitLabel}</p></>}
        </div>
        <div className={styles.coachBio}><h3>{coach.name}</h3><p>{coach.biography}</p></div>
      </article>)}
    </div>
  </div>;
}
