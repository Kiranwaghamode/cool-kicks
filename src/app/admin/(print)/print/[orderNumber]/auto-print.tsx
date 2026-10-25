"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[80mm] gap-2">
      <button type="button" onClick={() => window.print()} className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-bold text-white">
        Print
      </button>
      <button type="button" onClick={() => window.close()} className="rounded-full border px-4 py-2 text-sm font-bold">
        Close
      </button>
    </div>
  );
}
