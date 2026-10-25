"use client";

import { useEffect } from "react";

/**
 * Hero motion. The entrance (rise) and the bottle float are pure CSS (see globals.css:
 * .hero-rise / .hero-float) so the hero paints immediately (good LCP). The scroll parallax
 * needs GSAP ScrollTrigger, which is only downloaded on the first scroll.
 */
export function HeroMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ctx: { revert: () => void } | undefined;
    let started = false;
    let cancelled = false;

    async function start() {
      if (started) return;
      started = true;
      window.removeEventListener("scroll", start);
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        const trigger = { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true };
        gsap.to("[data-hero-art]", { yPercent: -8, ease: "none", scrollTrigger: trigger });
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          const speed = Number(el.dataset.parallax) || 20;
          gsap.to(el, { y: -speed * 4, rotate: speed / 2, ease: "none", scrollTrigger: trigger });
        });
      });
    }

    window.addEventListener("scroll", start, { passive: true, once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", start);
      ctx?.revert();
    };
  }, []);
  return null;
}
