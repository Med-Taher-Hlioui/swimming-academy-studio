"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import styles from "./public-site.module.css";

export function PublicNavigation({ links, trialLabel, workspaceLabel }: {
  links: { href: string; label: string }[]; trialLabel: string; workspaceLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <div className={styles.navigation} onKeyDown={event => {
    if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
  }}>
    <Link href="/#trial" className={styles.headerTrial}>{trialLabel}</Link>
    <button ref={trigger} type="button" className={styles.menuToggle} aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(value => !value)}>Menu <span aria-hidden="true">{open ? "−" : "+"}</span></button>
    <nav id="public-navigation" aria-label="Navigation publique" className={`${styles.nav} ${open ? styles.navOpen : ""}`}>
      {links.map(link => <Link href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
      <Link href="/dashboard" prefetch={false} className={styles.workspaceLink} onClick={() => setOpen(false)}>{workspaceLabel}</Link>
    </nav>
  </div>;
}
