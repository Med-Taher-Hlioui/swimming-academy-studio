"use client";

import { useEffect } from "react";
import { staticPreferred, subscribePreferences } from "./motion-preferences";
import styles from "./motion.module.css";

export function PublicMotion() {
  useEffect(() => {
    const root = document.getElementById("public-top");
    if (!root) return;

    const groups = root.querySelectorAll<HTMLElement>("[data-reveal-group]");
    let remaining = groups.length;
    const observer = !staticPreferred() && "IntersectionObserver" in window
      ? new IntersectionObserver(entries => {
          if (staticPreferred()) return;
          for (const { target, isIntersecting } of entries) {
            const group = target as HTMLElement;
            if (group.hasAttribute("data-motion-live")) {
              group.toggleAttribute("data-motion-visible", isIntersecting);
              if (isIntersecting) group.dataset.revealed = "true";
              continue;
            }
            if (!isIntersecting || group.dataset.revealed) continue;
            group.dataset.revealed = "true";
            observer?.unobserve(group);
            remaining -= 1;
          }
          if (remaining === 0) observer?.disconnect();
        }, { rootMargin: "0px 0px -32px 0px" })
      : undefined;

    if (!staticPreferred()) root.classList.add(styles.motionEnabled);
    groups.forEach(group => observer?.observe(group));

    function disableMotion() {
      root?.classList.remove(styles.motionEnabled);
      root?.classList.add(styles.motionDisabled);
      observer?.disconnect();
    }

    if (staticPreferred()) disableMotion();
    const unsubscribe = subscribePreferences(() => {
      if (staticPreferred()) disableMotion();
    });
    return () => {
      unsubscribe();
      observer?.disconnect();
      root.classList.remove(styles.motionEnabled, styles.motionDisabled);
      groups.forEach(group => {
        delete group.dataset.revealed;
        group.removeAttribute("data-motion-visible");
      });
    };
  }, []);

  return null;
}
