import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/shop/icons";
import { formatPhone, telLink, whatsappLink } from "@/lib/whatsapp";
import { summariseHours, type OpeningHours } from "@/lib/shop-hours";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/menu", label: "Menu" },
      { href: "/offers", label: "Offers" },
      { href: "/track", label: "Track order" },
      { href: "/orders", label: "My orders" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/refund-policy", label: "Refund policy" },
    ],
  },
];

export function SiteFooter({
  shop,
}: {
  shop: {
    phone: string;
    whatsappNumber: string;
    email: string | null;
    address: string;
    hours: OpeningHours;
    instagramUrl: string | null;
    facebookUrl: string | null;
  };
}) {
  const social = [
    shop.instagramUrl && { href: shop.instagramUrl, label: "Instagram", icon: InstagramIcon },
    shop.facebookUrl && { href: shop.facebookUrl, label: "Facebook", icon: FacebookIcon },
    { href: whatsappLink(shop.whatsappNumber), label: "WhatsApp", icon: WhatsAppIcon },
  ].filter(Boolean) as { href: string; label: string; icon: typeof WhatsAppIcon }[];

  return (
    <footer className="bg-cream pb-28 lg:pb-0">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-16">
        <div className="col-span-2 space-y-4 md:col-span-3 lg:col-span-1">
          <Logo />
          <p className="max-w-sm text-ink-soft">
            Fresh fruit juices, ice juices, mojitos, shakes and falooda – made to order and served ice cold.
          </p>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-deep" aria-hidden />
              {shop.address}
            </li>
            <li>
              <a href={telLink(shop.phone)} className="flex gap-2 hover:text-ink">
                <Phone className="mt-0.5 size-4 shrink-0 text-brand-deep" aria-hidden />
                {formatPhone(shop.phone)}
              </a>
            </li>
            {shop.email && (
              <li>
                <a href={`mailto:${shop.email}`} className="flex gap-2 hover:text-ink">
                  <Mail className="mt-0.5 size-4 shrink-0 text-brand-deep" aria-hidden />
                  {shop.email}
                </a>
              </li>
            )}
          </ul>
          <p className="text-sm font-semibold text-brand-deep">{summariseHours(shop.hours)}</p>
          <div className="flex gap-2">
            {social.map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-warm-soft transition hover:text-brand-deep"
              >
                <Icon className="size-[18px]" />
              </a>
            ))}
          </div>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="mb-4 text-lg font-bold">{col.title}</h2>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-ink-soft transition hover:text-brand-deep">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cool Kick Juice Bar. All rights reserved.</p>
          <p>Made fresh, served chilled.</p>
        </div>
      </div>
    </footer>
  );
}
