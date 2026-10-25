import type { Metadata } from "next";
import { Mail, Phone } from "lucide-react";
import { SectionHeading } from "@/components/shop/section-heading";
import { LocationCard } from "@/components/shop/location-card";
import { WhatsAppIcon } from "@/components/shop/icons";
import { FaqAccordion } from "@/components/shop/faq-accordion";
import { ContactForm } from "./contact-form";
import { getPublicShopInfo } from "@/server/settings";
import { FAQ } from "@/content/faq";
import { WEEKDAYS, WEEKDAY_LABELS, describeDay, shopClock } from "@/lib/shop-hours";
import { DEFAULT_WHATSAPP_MESSAGE, formatPhone, telLink, whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Call, WhatsApp or visit Cool Kick. Opening hours, location and contact form.",
};

export default async function ContactPage() {
  const shop = await getPublicShopInfo();
  const today = shopClock(new Date()).day;

  const cards = [
    { icon: Phone, title: "Call us", value: formatPhone(shop.phone), href: telLink(shop.phone), tone: "bg-mango-soft text-tangerine" },
    {
      icon: WhatsAppIcon,
      title: "WhatsApp",
      value: "Chat with us",
      href: whatsappLink(shop.whatsappNumber, DEFAULT_WHATSAPP_MESSAGE),
      tone: "bg-brand-soft text-brand-deep",
      external: true,
    },
    ...(shop.email ? [{ icon: Mail, title: "Email", value: shop.email, href: `mailto:${shop.email}`, tone: "bg-ice text-ice-deep" }] : []),
  ];

  return (
    <div className="container-page py-10 md:py-16">
      <SectionHeading as="h1" eyebrow="Say hello" title="Contact Cool Kick" subtitle="Questions, bulk orders or feedback – we'd love to hear from you." />

      <ul className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ icon: Icon, title, value, href, tone, ...rest }) => (
          <li key={title}>
            <a
              href={href}
              {...("external" in rest ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex items-center gap-4 rounded-card bg-surface p-5 shadow-warm-soft transition hover:-translate-y-0.5 hover:shadow-warm"
            >
              <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", tone)}>
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-soft">{title}</span>
                <span className="block truncate font-bold">{value}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <LocationCard shop={shop} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="rounded-card bg-surface p-6 shadow-warm-soft" aria-labelledby="hours-h">
          <h2 id="hours-h" className="mb-4 text-xl font-extrabold">
            Opening hours
          </h2>
          <table className="w-full text-[15px]">
            <caption className="sr-only">Opening hours by day</caption>
            <tbody>
              {WEEKDAYS.map((d) => (
                <tr key={d} className={cn("border-b border-line last:border-0", d === today && "font-bold text-brand-deep")}>
                  <th scope="row" className="py-2.5 text-left font-medium">
                    {WEEKDAY_LABELS[d]}
                    {d === today && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs">Today</span>}
                  </th>
                  <td className="py-2.5 text-right">{describeDay(shop.hours[d])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-card bg-surface p-6 shadow-warm-soft" aria-labelledby="form-h">
          <h2 id="form-h" className="mb-4 text-xl font-extrabold">
            Send us a message
          </h2>
          <ContactForm />
        </section>
      </div>

      <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="faq-h">
        <h2 id="faq-h" className="mb-5 text-center text-headline-sm font-extrabold">
          Common questions
        </h2>
        <FaqAccordion items={FAQ.flatMap((g) => g.items).slice(0, 6)} />
      </section>
    </div>
  );
}
