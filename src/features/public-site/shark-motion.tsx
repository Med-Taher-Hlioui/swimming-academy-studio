"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./public-site.module.css";

/** Motion remains gated on a faithful transparent original. The JPG fallback stays static. */
export function SharkMotion({ asset, fallback, note }: { asset: string | null; fallback: string; note: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const sprite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!asset) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    function draw() {
      frame = 0;
      if (!stage.current || !sprite.current) return;
      const rect = stage.current.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height)));
      const distance = Math.min(rect.width * .25, 100);
      sprite.current.style.transform = media.matches ? "none" : `translate(${Math.sin(progress * Math.PI) * distance}px, ${progress * 55}px) rotate(${Math.sin(progress * Math.PI * 2) * 8}deg)`;
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    media.addEventListener("change", schedule);
    draw();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
    };
  }, [asset]);
  return <div ref={stage} className={styles.sharkStage} data-shark-mode={asset ? "ready" : "static-original-logo"}>
    <div ref={sprite} className={styles.sharkSprite} aria-hidden="true"><Image unoptimized src={asset ?? fallback} alt="" width={365} height={365} /></div>
    <p className={styles.assetNote}>{note}</p>
  </div>;
}
