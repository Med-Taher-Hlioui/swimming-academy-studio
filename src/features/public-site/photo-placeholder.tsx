import styles from "./public-site.module.css";

export function PhotoPlaceholder({ title, note, children }: { title: string; note: string; children?: React.ReactNode }) {
  return <figure className={styles.photoSlot}>
    <div className={styles.photoSurface}>
      <span className={styles.lane} aria-hidden="true" />
      <span className={styles.bubble} aria-hidden="true" />
      {children}
      <p className={styles.photoTitle}>{title}</p>
    </div>
    <figcaption>{note}</figcaption>
  </figure>;
}
