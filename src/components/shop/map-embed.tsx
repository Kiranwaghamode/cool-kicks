"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

/**
 * Click-to-load Google Maps embed. The real iframe pulls ~500 KB of Google scripts,
 * so it's only loaded when the visitor asks for it.
 */
export function MapEmbed({ src, title, className }: { src: string; title: string; className?: string }) {
  const [show, setShow] = useState(false);
  if (show) {
    return <iframe title={title} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className={className} />;
  }
  return (
    <button
      type="button"
      onClick={() => setShow(true)}
      className={`group relative flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_30%,#eaf5dc,transparent_55%),radial-gradient(circle_at_70%_70%,#dff6ff,transparent_50%),#fff6d9] ${className ?? ""}`}
      aria-label={`Show map: ${title}`}
    >
      <span aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgb(17_17_17/0.04)_1px,transparent_1px),linear-gradient(rgb(17_17_17/0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <span className="relative flex flex-col items-center gap-2">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-glow transition group-hover:scale-105">
          <MapPin className="size-7" aria-hidden />
        </span>
        <span className="rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-ink shadow-warm-soft">Show map</span>
      </span>
    </button>
  );
}
