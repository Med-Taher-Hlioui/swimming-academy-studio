import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteConfig as site, publicDesignCopy as design, publicVenue } from "@/config/public-site";
import { SectionHeading } from "@/features/public-site/public-components";
import { TrialSessionRequest } from "@/features/public-site/trial-session-request";
import { ProgramExplorer } from "@/features/public-site/program-explorer";
import { CoachCarousel } from "@/features/public-site/coach-carousel";
import { MediaPhoto } from "@/features/public-site/media-photo";
import { FeaturedVideo } from "@/features/public-site/featured-video";
import { publicMedia } from "@/config/public-media";
import styles from "@/features/public-site/public-site.module.css";
import heroStyles from "@/features/public-site/hero.module.css";
import experience from "@/features/public-site/experience.module.css";
import { LocationMap } from "@/features/public-site/location-map";
import { venueDirections } from "@/features/public-site/location-links";
import { whatsappLink } from "@/features/public-site/contact-links";
import { PublicMotion } from "@/features/public-site/public-motion";

export const metadata: Metadata = { title: site.metadata.title };

export default function PublicHomepage() {
  return <>
    <PublicMotion />
    <section className={`${styles.hero} ${heroStyles.hero}`} aria-labelledby="hero-title">
      <div className={`${styles.container} ${styles.heroGrid} ${heroStyles.grid}`}>
        <div className={styles.heroText} data-reveal-group>
          <p className={styles.eyebrow} data-reveal="fade">{site.hero.eyebrow}</p>
          <h1 id="hero-title" className={heroStyles.title} data-reveal-headline>{site.brand.tagline.split(" ").map((word, index) => <span key={word}>{index > 0 ? " " : ""}{word}</span>)}</h1>
          <p className={styles.heroCopy} data-reveal="fade" data-reveal-order="3">{site.hero.description}</p>
          <p className={styles.trialSchedule} data-reveal="fade" data-reveal-order="4">{site.trial.scheduleLabel}</p>
          <div className={styles.actions} data-reveal="cta">
            <a href="#trial" className={styles.primaryAction}>{site.hero.primaryAction} <span aria-hidden="true">↗</span></a>
            <a href="#programs" className={styles.secondaryAction}>{site.hero.secondaryAction}</a>
          </div>
        </div>
        <div className={`${styles.heroVisual} ${heroStyles.visual}`} data-reveal-group data-motion-live>
          <FeaturedVideo asset={publicMedia.videos.hero} reveal="up">
            <MediaPhoto asset={publicMedia.photos.hero} eager />
          </FeaturedVideo>
          <span className={heroStyles.sharkFallback} aria-hidden="true" data-hero-shark="badge" data-reveal="shark">
            <span aria-hidden="true">≈</span>
          </span>
        </div>
      </div>
    </section>
    <div className={experience.experience}>
    <section id="programs" aria-labelledby="programs-title" className={`${styles.container} ${styles.section}`}>
      <SectionHeading id="programs-title" copy={site.programSection} />
      <ProgramExplorer copy={design.explorer} messageLabels={site.trial.message} number={site.contact.whatsappNumber} photos={[publicMedia.photos.technique, publicMedia.photos.group]} />
      <p className={styles.programNote}><strong>{site.programSection.detailsLabel}</strong><span>{site.programSection.pendingDetails}</span></p>
    </section>
    <section id="story" aria-labelledby="story-title" className={`${styles.story} ${styles.section}`}>
      <div className={`${styles.container} ${styles.split}`}>
        <FeaturedVideo asset={publicMedia.videos.story} reveal="left"><MediaPhoto asset={publicMedia.photos.story} /></FeaturedVideo>
        <div><SectionHeading id="story-title" copy={design.story} reveal="right" />
          <ol className={styles.storyValues} data-reveal-group>{design.story.values.map((value, index) => <li key={value.title} data-reveal="up" data-reveal-order={index}><span aria-hidden="true">0{index + 1}</span><div><h3>{value.title}</h3><p>{value.text}</p></div></li>)}</ol>
          <p className={styles.smallNote}>{design.story.note}</p>
        </div>
      </div>
    </section>
    <section id="team" aria-labelledby="team-title" className={`${styles.container} ${styles.section}`}>
      <SectionHeading id="team-title" copy={site.teamSection} />
      <CoachCarousel coaches={site.coaches} portraitLabel={design.portraitPending} />
    </section>
    <section id="trial" aria-label={site.trial.freeLabel} className={`${styles.trialSection} ${styles.section}`}>
      <div className={`${styles.container} ${styles.split}`}>
        <MediaPhoto asset={publicMedia.photos.trial} reveal />
        <TrialSessionRequest copy={site.trial} whatsappNumber={site.contact.whatsappNumber} />
      </div>
      <p className={`${styles.container} ${experience.trialRegistration}`}><Link href="/inscription">Comment s&apos;inscrire ?</Link></p>
    </section>
    <section id="contact" aria-labelledby="contact-title" className={`${styles.container} ${styles.section}`}>
      <div className={experience.locationGrid}>
        <div className={experience.locationCopy} data-reveal-group data-reveal="fade"><SectionHeading id="contact-title" copy={design.location} reveal={false} />
          <dl className={styles.contactDetails}>
            <div><dt>{publicVenue.name}</dt><dd>{publicVenue.address}</dd></div>
          </dl>
          <a data-directions href={venueDirections(publicVenue.destination)} target="_blank" rel="noopener noreferrer" className={styles.primaryAction}>{publicVenue.directionsLabel} ↗</a>
          <p className={styles.smallNote}>{design.location.mapNote}</p>
          <p className={styles.smallNote}>{site.contactSection.privacyNote}</p>
        </div>
        <LocationMap destinationUrl={site.contact.mapsUrl!} />
        <a className={experience.locationHelp} href={whatsappLink(site.contact.whatsappNumber, site.contact.whatsappMessage)!} target="_blank" rel="noopener noreferrer">Besoin d’aide pour nous trouver ? WhatsApp · {site.contact.phone} ↗</a>
      </div>
    </section>
    </div>
  </>;
}
