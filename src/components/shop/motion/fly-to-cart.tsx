"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";

type Flight = { id: number; from: { x: number; y: number }; to: { x: number; y: number }; image: string | null };

/** Little drop that flies from the "Add" button to the visible cart icon. */
export function FlyToCart() {
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    let id = 0;
    function onAdd(e: Event) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const detail = (e as CustomEvent<{ x: number; y: number; image: string | null } | undefined>).detail;
      if (!detail) return;
      const targets = [...document.querySelectorAll<HTMLElement>("[data-cart-target]")].filter((el) => el.offsetParent !== null);
      const target = targets[0];
      if (!target) return;
      const r = target.getBoundingClientRect();
      const flight = { id: ++id, from: { x: detail.x, y: detail.y }, to: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, image: detail.image };
      setFlights((f) => [...f, flight]);
      setTimeout(() => setFlights((f) => f.filter((x) => x.id !== flight.id)), 900);
    }
    window.addEventListener("coolkick:added-to-cart", onAdd);
    return () => window.removeEventListener("coolkick:added-to-cart", onAdd);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[95]">
      <AnimatePresence>
        {flights.map((f) => (
          <m.div
            key={f.id}
            className="absolute size-10 overflow-hidden rounded-full border-2 border-white bg-brand shadow-glow"
            style={{ left: 0, top: 0 }}
            initial={{ x: f.from.x - 20, y: f.from.y - 20, scale: 1, opacity: 1 }}
            animate={{
              x: [f.from.x - 20, (f.from.x + f.to.x) / 2 - 20, f.to.x - 20],
              y: [f.from.y - 20, Math.min(f.from.y, f.to.y) - 120, f.to.y - 20],
              scale: [1, 0.9, 0.35],
              opacity: [1, 1, 0.6],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: "easeInOut" }}
          >
            {f.image && (
              // eslint-disable-next-line @next/next/no-img-element -- tiny decorative thumbnail during animation
              <img src={f.image} alt="" className="size-full object-cover" />
            )}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
