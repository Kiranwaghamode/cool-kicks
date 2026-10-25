import { Clock } from "lucide-react";
import type { ShopStatus } from "@/lib/shop-hours";

/** Thin strip at the very top when the shop is closed. Hidden while open. */
export function ShopStatusBanner({ status }: { status: ShopStatus }) {
  if (status.isOpen) return null;
  return (
    <div role="status" className="bg-ink text-white">
      <p className="container-page flex items-center justify-center gap-2 py-2 text-center text-sm font-semibold">
        <Clock className="size-4 shrink-0 text-mango" aria-hidden />
        {status.message}
        {!status.temporarilyClosed && <span className="hidden text-white/70 sm:inline"> · You can still browse the menu.</span>}
      </p>
    </div>
  );
}

/** Small pill showing open/closed state (used in location card, contact page). */
export function OpenPill({ status }: { status: ShopStatus }) {
  return (
    <p className={`flex items-center gap-2 text-sm font-semibold ${status.isOpen ? "text-brand-deep" : "text-danger"}`}>
      <span className={`size-2.5 rounded-full ${status.isOpen ? "bg-brand" : "bg-danger"}`} aria-hidden />
      {status.message}
    </p>
  );
}
