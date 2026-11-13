import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteConfig as site, publicDesignCopy as design, publicVenue } from "@/config/public-site";
import { OfficialLogo } from "@/features/public-site/public-components";
import { PublicNavigation } from "@/features/public-site/public-navigation";
import { whatsappLink } from "@/features/public-site/contact-links";
import styles from "@/features/public-site/public-site.module.css";
import experience from "@/features/public-site/experience.module.css";

// Launch approval is deliberately independent of editable preview copy.
export const metadata: Metadata = {
  title: { default: site.brand.name, template: `%s | ${site.brand.name}` },
  description: site.metadata.description,
  robots: { index: false, follow: true },
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div lang={site.language} id="public-top" className={styles.site} style={{ "--academy-primary": site.brand.primaryColor } as CSSProperties}>
    <a href="#public-content" className="skip-link">{site.navigation.skip}</a>
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link href="/" className={styles.brand}><OfficialLogo logo={site.brand.logo} /><span><span className={styles.brandName}>{site.brand.name}</span><span className={styles.descriptor}>{site.brand.descriptor}</span></span></Link>
        <PublicNavigation links={design.links} trialLabel={site.trial.freeLabel} workspaceLabel={site.navigation.workspace} />
      </div>
    </header>
    {site.preview && <p className={styles.notice}>{site.notice}</p>}
    <main id="public-content" tabIndex={-1}>{children}</main>
    <footer className={`${styles.footer} ${experience.footer}`}>
      <div className={`${styles.container} ${styles.footerInner}`} data-reveal-group>
        <div className={styles.footerBrand} data-reveal="up"><OfficialLogo logo={site.brand.logo} /><p className={styles.footerName}>{site.brand.name}</p><p>{site.footer.note}</p></div>
        <nav aria-label="Navigation de bas de page" data-reveal="up" data-reveal-order="1">{design.links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
        <div data-reveal="up" data-reveal-order="2"><p>{publicVenue.name}<br />{publicVenue.address}</p><a href={whatsappLink(site.contact.whatsappNumber, site.contact.whatsappMessage) ?? "#contact"} target="_blank" rel="noopener noreferrer">WhatsApp · {site.contact.phone} ↗</a>{site.contact.instagramUrl && <a href={site.contact.instagramUrl} target="_blank" rel="noopener noreferrer">{site.social.instagramLabel} ↗</a>}<Link prefetch={false} href="/dashboard">{site.navigation.workspace}</Link></div>
      </div>
      <div className={`${styles.container} ${styles.footerBottom}`}><p>© {design.copyrightYear} {design.copyright}</p><a href="#public-top">{site.footer.backToTop} ↑</a></div>
    </footer>
  </div>;
}
