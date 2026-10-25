"use client";

import { useEffect } from "react";

/**
 * Hero animation: headline/stats slide in, bottles float gently, the art and
 * fruit decorations parallax on scroll (GSAP ScrollTrigger, loaded lazily).
 * Targets elements by data attributes so the hero stays a server component.
 */
export function HeroMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ctx: { revert: () => void } | undefined;
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        gsap.from("[data-hero-copy] > *", { y: 28, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.08 });
        gsap.from("[data-hero-stats] > *", { y: 16, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.1, delay: 0.35 });
        gsap.from("[data-hero-art]", { scale: 0.94, opacity: 0, duration: 0.9, ease: "power3.out", delay: 0.1 });
        gsap.from("[data-hero-chip]", { y: 14, opacity: 0, duration: 0.6, ease: "back.out(1.7)", stagger: 0.15, delay: 0.6 });

        // Gentle float of the bottles.
        gsap.to("[data-hero-image]", { y: -10, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });

        // Parallax on scroll.
        gsap.to("[data-hero-art]", {
          yPercent: -8,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true },
        });
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          const speed = Number(el.dataset.parallax) || 20;
          gsap.to(el, {
            y: -speed * 4,
            rotate: speed / 2,
            ease: "none",
            scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true },
          });
        });
      });
    })();
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);
  return null;
}
