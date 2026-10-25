"use client";

import { useEffect } from "react";

/**
 * Lenis smooth scrolling for customer pages. Loaded when the browser is idle (or on first
 * wheel/touch) so it never competes with the first paint. Disabled for reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let destroyed = false;
    let cleanup: (() => void) | undefined;
    let started = false;

    async function start() {
      if (started) return;
      started = true;
      window.removeEventListener("wheel", start);
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (destroyed) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ duration: 1.05, smoothWheel: true, syncTouch: false });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    }

    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle ? window.requestIdleCallback(start, { timeout: 4000 }) : setTimeout(start, 2500);
    window.addEventListener("wheel", start, { passive: true, once: true });
    return () => {
      destroyed = true;
      if (hasIdle) window.cancelIdleCallback(idle as number);
      else clearTimeout(idle);
      window.removeEventListener("wheel", start);
      cleanup?.();
    };
  }, []);
  return null;
}
