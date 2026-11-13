import Image from "next/image";
import type { PublicSiteConfig, PublicSectionCopy } from "@/config/public-site";
import styles from "./public-site.module.css";

export function SectionHeading({ copy, id, reveal = "up" }: { copy: PublicSectionCopy; id: string; reveal?: "up" | "right" | false }) {
  return <div className={styles.sectionHeading} data-reveal-group={reveal || undefined} data-reveal={reveal || undefined}>
    <p className={styles.eyebrow}>{copy.eyebrow}</p>
    <h2 id={id}>{copy.title}</h2>
    <p className={styles.description}>{copy.description}</p>
  </div>;
}

/** Use only the unchanged local asset supplied by the owner; no substitute artwork. */
export function OfficialLogo({ logo }: { logo: PublicSiteConfig["brand"]["logo"] }) {
  if (!logo) return null;
  return <Image unoptimized src={logo.src} width={logo.width} height={logo.height} alt={logo.alt} className={styles.officialLogo} />;
}

export function ContactChannel({ href, label, pending }: { href: string | null; label: string; pending: string }) {
  return href
    ? <a className={styles.primaryAction} href={href} target="_blank" rel="noopener noreferrer">{label}<span aria-hidden="true">↗</span></a>
    : <p className={styles.pendingChannel}><span aria-hidden="true">○</span>{pending}</p>;
}
