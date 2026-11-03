"use client";

import { ArrowLeft, Printer } from "lucide-react";

/** Print / back buttons above a printable document (hidden when printing). */
export function PrintBar({ backHref, backLabel = "Back" }: { backHref?: string; backLabel?: string }) {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 px-6 pt-6">
      {backHref && (
        <a href={backHref} className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold">
          <ArrowLeft className="size-4" aria-hidden /> {backLabel}
        </a>
      )}
      <button type="button" onClick={() => window.print()} className="ml-auto inline-flex items-center gap-2 rounded-full bg-black px-5 py-2 text-sm font-bold text-white">
        <Printer className="size-4" aria-hidden /> Print / save PDF
      </button>
    </div>
  );
}
