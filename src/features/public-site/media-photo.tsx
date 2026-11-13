import Image from "next/image";
import type { PublicPhoto } from "@/config/public-media";
import styles from "./public-site.module.css";

export function MediaPhoto({ asset, eager = false, caption, reveal = false }: { asset: PublicPhoto; eager?: boolean; caption?: string; reveal?: boolean }) {
  return <figure className={styles.realPhoto} data-media-photo={asset.id} data-reveal-group={reveal ? "" : undefined} data-reveal={reveal ? "up" : undefined}>
    <div className={styles.mediaFrame}>
      {asset.placeholder ? <div className={styles.previewPlaceholder}><span>Shark Aquatics</span><small>Visuel de démonstration</small></div> : <Image src={asset.url} alt={asset.alt} fill
        sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1200px) 45vw, 550px"
        preload={eager} loading={eager ? undefined : "lazy"}
        style={{ objectFit: "cover", objectPosition: asset.focalPoint }} />}
    </div>
    {caption && <figcaption className={styles.mediaCaption}>{caption}</figcaption>}
  </figure>;
}
