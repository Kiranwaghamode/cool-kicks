"use client";

import { usePathname } from "next/navigation";
import { DEFAULT_WHATSAPP_MESSAGE, whatsappLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/shop/icons";
import { cn } from "@/lib/utils";

/** Pages with their own sticky bottom action bar – hide the FAB there on phones. */
const STICKY_BAR_PAGES = ["/product/", "/cart", "/checkout"];

export function WhatsAppFab({ number }: { number: string }) {
  const pathname = usePathname();
  const hideOnMobile = STICKY_BAR_PAGES.some((p) => pathname.startsWith(p));
  return (
    <a
      href={whatsappLink(number, DEFAULT_WHATSAPP_MESSAGE)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={cn(
        "no-print fixed right-4 bottom-24 z-40 size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_25px_rgb(37_211_102/0.4)] transition hover:scale-105 active:scale-95 lg:right-6 lg:bottom-6",
        hideOnMobile ? "hidden md:flex" : "flex",
      )}
    >
      <WhatsAppIcon className="size-7" />
      <span className="absolute top-0.5 right-0.5 size-3 rounded-full border-2 border-white bg-brand" aria-hidden />
    </a>
  );
}
