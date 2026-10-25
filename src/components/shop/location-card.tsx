import { MapPin, Navigation, Phone, Store } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shop/icons";
import { OpenPill } from "@/components/shop/shop-status-banner";
import { summariseHours, type OpeningHours, type ShopStatus } from "@/lib/shop-hours";
import { telLink, whatsappLink, DEFAULT_WHATSAPP_MESSAGE } from "@/lib/whatsapp";

export function LocationCard({
  shop,
  showMap = true,
}: {
  shop: {
    shopName: string;
    address: string;
    phone: string;
    whatsappNumber: string;
    mapEmbedUrl: string | null;
    mapLink: string | null;
    hours: OpeningHours;
    status: ShopStatus;
  };
  showMap?: boolean;
}) {
  return (
    <div className="grid overflow-hidden rounded-[28px] bg-surface shadow-warm-soft lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col gap-5 p-6 md:p-10">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-glow md:size-14">
            <Store className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold tracking-[0.15em] text-brand-deep uppercase">Visit our counter</p>
            <h3 className="mt-1 text-xl font-extrabold md:text-2xl">{shop.shopName} Juice Bar</h3>
          </div>
        </div>
        <p className="flex gap-2 text-ink-soft md:text-lg">
          <MapPin className="mt-1 size-5 shrink-0 text-tangerine" aria-hidden />
          {shop.address}
        </p>
        <div className="space-y-1">
          <OpenPill status={shop.status} />
          <p className="pl-[18px] text-sm text-ink-soft">{summariseHours(shop.hours)}</p>
        </div>
        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href={telLink(shop.phone)} className={buttonVariants({ variant: "secondary", className: "sm:flex-1" })}>
            <Phone className="size-4" aria-hidden /> Call Us
          </a>
          <a
            href={whatsappLink(shop.whatsappNumber, DEFAULT_WHATSAPP_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ className: "sm:flex-1" })}
          >
            <WhatsAppIcon className="size-5" /> WhatsApp Us
          </a>
          {shop.mapLink && (
            <a
              href={shop.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", className: "sm:flex-1" })}
            >
              <Navigation className="size-4" aria-hidden /> Directions
            </a>
          )}
        </div>
      </div>
      {showMap && shop.mapEmbedUrl && (
        <iframe
          title={`Map showing ${shop.shopName}`}
          src={shop.mapEmbedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-64 w-full border-0 lg:h-full lg:min-h-80"
        />
      )}
    </div>
  );
}
