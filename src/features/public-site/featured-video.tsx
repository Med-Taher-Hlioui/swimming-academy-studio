"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import type { PublicVideo } from "@/config/public-media";
import styles from "./public-site.module.css";
import { staticPreferred, subscribePreferences } from "./motion-preferences";

export function FeaturedVideo({ asset, children, reveal }: { asset: PublicVideo; children: ReactNode; reveal?: "left" | "up" }) {
  const id = useId();
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const preferStatic = useSyncExternalStore(subscribePreferences, staticPreferred, () => false);

  useEffect(() => {
    const node = video.current;
    if (!node || !requested || failed || preferStatic) return;
    node.load();
    node.play().catch(error => {
      if (error.name !== "AbortError") setFailed(true);
    });
  }, [requested, failed, preferStatic]);

  useEffect(() => {
    const node = video.current;
    function pauseWhenHidden() { if (document.hidden) node?.pause(); }
    function anotherVideoStarted(event: Event) {
      if ((event as CustomEvent<string>).detail !== asset.id) node?.pause();
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) node?.pause();
    });
    if (container.current) observer.observe(container.current);
    document.addEventListener("visibilitychange", pauseWhenHidden);
    window.addEventListener("shark-video-started", anotherVideoStarted);
    return () => {
      observer.disconnect();
      node?.pause();
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      window.removeEventListener("shark-video-started", anotherVideoStarted);
    };
  }, [asset.id]);

  function activate() {
    if (!requested) { setRequested(true); return; }
    if (failed) { setFailed(false); return; }
    if (playing) video.current?.pause();
    else video.current?.play().catch(error => {
      if (error.name !== "AbortError") setFailed(true);
    });
  }

  if (asset.available === false) return <div className={styles.featuredMedia} data-featured-video={asset.id}>{children}<p className={styles.smallNote}>Aperçu de développement · Vidéo omise</p></div>;

  const showingVideo = requested && !failed && !preferStatic;
  return <div ref={container} className={styles.featuredMedia} data-featured-video={asset.id}>
    <div className={styles.videoFrame}>
      <div className={showingVideo ? styles.photoBehindVideo : undefined} data-reveal-group={reveal} data-reveal={reveal}>{children}</div>
      <video ref={video} id={id} hidden={!showingVideo} src={requested && !preferStatic ? asset.url : undefined}
        poster={asset.poster} preload="none" muted playsInline controls={showingVideo}
        aria-label={asset.description} onPlay={() => {
          setPlaying(true);
          setLoading(false);
          window.dispatchEvent(new CustomEvent("shark-video-started", { detail: asset.id }));
        }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onWaiting={() => setLoading(true)} onCanPlay={() => setLoading(false)} onError={() => { setFailed(true); setPlaying(false); }} />
    </div>
    <div className={styles.videoActions}>
      <button type="button" className={styles.secondaryAction} aria-controls={id} disabled={preferStatic} onClick={activate}>
        <Image unoptimized src={asset.poster} width={asset.width} height={asset.height} alt="" loading="lazy" className={styles.videoPosterThumb} />
        <span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span> {failed ? "Réessayer la vidéo" : playing ? "Mettre en pause" : asset.playLabel}
      </button>
      <p role="status" className={styles.smallNote}>
        {preferStatic ? "Photographie affichée selon vos préférences de mouvement ou de données." : failed ? "La vidéo est indisponible. La photographie reste affichée." : loading && showingVideo ? "Chargement de la vidéo…" : "Court aperçu sans son · Lecture à votre demande"}
      </p>
    </div>
  </div>;
}
