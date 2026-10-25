import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Blend,
  Bike,
  ShieldCheck,
  Snowflake,
  Sprout,
  Zap,
} from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/shop/product-card";
import { SectionHeading } from "@/components/shop/section-heading";
import { CategoryIcon } from "@/components/shop/icons";
import { CopyButton } from "@/components/shop/copy-button";
import { LocationCard } from "@/components/shop/location-card";
import { ReviewCard } from "@/components/shop/review-card";
import {
  getActiveCoupons,
  getApprovedReviews,
  getBestsellers,
  getCategories,
} from "@/server/catalog";
import { getPublicShopInfo } from "@/server/settings";
import { couponConditions, couponHeadline } from "@/lib/coupons";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/shop-hours";

export const metadata: Metadata = {
  title: { absolute: "Cool Kick – Fresh & Chilled Juices | Order Online" },
  description:
    "There's a chilled juice for every mood. Fresh fruit juices, ice juices, mojitos, milkshakes and falooda made to order – pickup or home delivery.",
  openGraph: {
    title: "Cool Kick – Fresh & Chilled Juices",
    description: "Fresh fruit, crushed ice and zero preservatives – made to order.",
    images: [{ url: "/images/design/hero-bottles.webp", width: 1024, height: 1024 }],
    type: "website",
    locale: "en_IN",
  },
};

const WHY = [
  {
    icon: Sprout,
    title: "Fresh Fruit Daily",
    body: "Sourced from local markets every morning. No frozen blocks, no concentrates.",
  },
  {
    icon: Blend,
    title: "Made to Order",
    body: "Pressed and blended only when your order comes in. Never sitting on shelves.",
  },
  {
    icon: ShieldCheck,
    title: "Hygienic Preparation",
    body: "RO-purified ice, sanitised counters and sealed cups for every drink.",
  },
  {
    icon: Bike,
    title: "Fast, Chilled Delivery",
    body: "Packed in insulated bags and delivered cold to your doorstep.",
  },
];

export default async function HomePage() {
  const [shop, categories, bestsellers, coupons, reviews] = await Promise.all([
    getPublicShopInfo(),
    getCategories(),
    getBestsellers(8),
    getActiveCoupons(),
    getApprovedReviews(6),
  ]);
  const featured = coupons.find((c) => c.type === "BUY_X_GET_Y") ?? coupons[0];
  const otherCoupons = coupons.filter((c) => c.id !== featured?.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    name: shop.shopName,
    description: shop.tagline ?? "Fresh & chilled juices",
    servesCuisine: ["Juices", "Beverages", "Desserts"],
    telephone: shop.phone,
    email: shop.email ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: shop.address, addressCountry: "IN" },
    hasMap: shop.mapLink ?? undefined,
    url: process.env.NEXT_PUBLIC_SITE_URL,
    image: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/images/design/hero-bottles.webp`,
    priceRange: "₹₹",
    openingHoursSpecification: WEEKDAYS.filter((d) => !shop.hours[d].closed).map((d) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: WEEKDAY_LABELS[d],
      opens: shop.hours[d].open,
      closes: shop.hours[d].close,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ───────── Hero ───────── */}
      <section className="overflow-hidden bg-gradient-to-b from-cream to-cream-50">
        <div className="container-page grid items-center gap-8 py-8 md:py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
          <div className="text-center lg:text-left" data-hero-copy>
            <p className="mb-5 hidden items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-[11px] font-bold tracking-wider text-warning uppercase lg:inline-flex">
              <span className="size-2 rounded-full bg-brand" aria-hidden />
              100% fresh • Made to order • Ice cold
            </p>
            <h1 className="text-[2rem] leading-[1.15] font-extrabold tracking-tight text-ink sm:text-display-sm lg:text-[3rem] lg:leading-[1.08] lg:tracking-[-0.03em] xl:text-[3.5rem]">
              <span className="sm:whitespace-nowrap">There&apos;s a chilled juice</span>{" "}
              <span className="sm:block sm:whitespace-nowrap">for every mood.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-ink-soft md:text-lg lg:mx-0 lg:max-w-xl lg:text-xl">
              Fresh fruit, crushed ice and zero preservatives — made to order with seasonal pulps and chilled
              botanicals.
            </p>

            <dl className="mt-8 hidden grid-cols-3 gap-6 lg:grid" data-hero-stats>
              {[
                ["100%", "Fresh fruit"],
                ["0%", "Preservatives"],
                [`${shop.estimatedPrepMins} min`, "Ready time"],
              ].map(([v, l]) => (
                <div key={l} className="border-l-4 border-brand pl-3">
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-4xl font-extrabold tracking-tight">{v}</dd>
                  <dd className="text-sm font-medium text-ink-soft">{l}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 hidden items-center gap-5 lg:flex">
              <LinkButton href="/menu" size="lg" className="tracking-wide uppercase">
                Order Now <ArrowRight className="size-5" aria-hidden />
              </LinkButton>
              <p className="flex items-center gap-2 text-sm font-medium text-ink-soft">
                <Snowflake className="size-4 text-brand-deep" aria-hidden /> Served chilled with RO crystal ice
              </p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none" data-hero-art>
            <div className="relative aspect-square overflow-hidden rounded-[28px] border-4 border-white/80 bg-cream shadow-warm lg:rounded-[32px]">
              <Image
                src="/images/design/hero-bottles.webp"
                alt="Three chilled juice bottles – strawberry watermelon, mango orange and grape – with a fruit splash"
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 600px"
                className="object-cover"
                data-hero-image
              />
            </div>
            <div className="glass absolute -top-3 right-2 hidden items-center gap-3 rounded-2xl px-4 py-2.5 shadow-glass sm:flex lg:-right-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand text-white">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <span className="text-left">
                <span className="block text-xs font-bold">Hygiene first</span>
                <span className="block text-sm text-ink-soft">RO ice · sealed cups</span>
              </span>
            </div>
            <div className="glass absolute -bottom-4 left-2 hidden items-center gap-3 rounded-2xl px-4 py-2.5 shadow-glass sm:flex lg:-left-6">
              <span className="flex size-9 items-center justify-center rounded-full bg-mango text-ink">
                <Zap className="size-5" aria-hidden />
              </span>
              <span className="text-left">
                <span className="block text-xs font-bold">Crushed on order</span>
                <span className="block text-sm text-ink-soft">Alphonso mango &amp; mint</span>
              </span>
            </div>
          </div>

          {/* Mobile stats + CTA (design: white stat card then centred button) */}
          <div className="lg:hidden">
            <dl className="grid grid-cols-3 divide-x divide-line rounded-[22px] bg-surface p-4 text-center shadow-warm-soft">
              {[
                ["100%", "Fresh fruit"],
                ["0%", "Preservatives"],
                [`${shop.estimatedPrepMins}m`, "Ready time"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-2xl font-extrabold text-brand-deep">{v}</dd>
                  <dd className="text-xs font-medium text-ink-soft">{l}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex justify-center">
              <LinkButton href="/menu" size="lg" className="min-w-56 tracking-wide uppercase">
                Order Now <ArrowRight className="size-5" aria-hidden />
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Categories ───────── */}
      <section className="bg-cream/60 py-12 md:py-16" aria-labelledby="categories-heading">
        <div className="container-page">
          <div className="mb-8 text-center">
            <h2 id="categories-heading" className="text-headline-sm font-extrabold md:text-headline">
              Juice Categories
            </h2>
            <p className="mt-2 text-ink-soft">Explore our fresh-pressed and ice-cold collections</p>
          </div>
          <ul className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:justify-center md:gap-6 md:overflow-visible md:px-0">
            {categories.map((c) => (
              <li key={c.id} className="snap-start">
                <Link
                  href={`/menu/${c.slug}`}
                  className="group flex w-20 flex-col items-center gap-2 text-center md:w-24"
                >
                  <span className="flex size-[72px] items-center justify-center rounded-full bg-surface text-brand shadow-warm-soft ring-1 ring-mango/20 transition group-hover:-translate-y-1 group-hover:bg-brand group-hover:text-white group-hover:shadow-glow md:size-20">
                    <CategoryIcon slug={c.slug} className="size-8" />
                  </span>
                  <span className="text-xs leading-tight font-bold text-ink md:text-sm">
                    {c.name.replace(" Juices", "").replace(" Juice", "")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Most popular ───────── */}
      <section className="py-14 md:py-20" aria-labelledby="popular-heading">
        <div className="container-page">
          <SectionHeading
            eyebrow="Our menu"
            title="The Most Popular Juices"
            subtitle="Sip into customer-favourite blends made with seasonal fruit and hand-crushed ice."
          />
          <span id="popular-heading" className="sr-only">
            Most popular drinks
          </span>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {bestsellers.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <LinkButton href="/menu" variant="outline" size="lg">
              View full menu <ArrowRight className="size-5" aria-hidden />
            </LinkButton>
          </div>
        </div>
      </section>

      {/* ───────── Why choose us ───────── */}
      <section className="bg-cream/60 py-14 md:py-20" aria-labelledby="why-heading">
        <div className="container-page">
          <div className="rounded-[28px] bg-surface p-6 shadow-warm-soft md:bg-transparent md:p-0 md:shadow-none">
            <SectionHeading eyebrow="Quality promise" title="The Cool Kick Standard" subtitle="We treat every juice as fresh, honest nourishment." />
            <span id="why-heading" className="sr-only">
              Why choose us
            </span>
            <ul className="grid gap-6 md:grid-cols-2 md:gap-5 lg:grid-cols-4">
              {WHY.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4 md:flex-col md:rounded-card md:bg-surface md:p-6 md:shadow-warm-soft">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-mango-soft text-brand-deep ring-1 ring-brand/30 md:size-14">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold md:text-xl">{title}</h3>
                    <p className="mt-1 text-sm text-ink-soft">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── Offers ───────── */}
      {featured && (
        <section className="py-14 md:py-20" aria-labelledby="offer-heading">
          <div className="container-page space-y-5">
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-brand via-mango to-mango-soft p-6 shadow-warm md:p-12">
              <Snowflake
                aria-hidden
                className="pointer-events-none absolute -right-6 -bottom-8 size-40 text-white/30 md:size-56"
              />
              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl text-white">
                  <Badge tone="neutral" className="bg-white/30 text-white uppercase">
                    Limited offer
                  </Badge>
                  <h2 id="offer-heading" className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">
                    {couponHeadline(featured)}
                  </h2>
                  <p className="mt-2 text-lg text-white/95">
                    {featured.description ?? couponConditions(featured)}
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 pl-5 shadow-glass">
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-ink-soft uppercase">Promo code</p>
                    <p className="font-mono text-xl font-extrabold tracking-[0.15em] text-brand-deep">
                      {featured.code}
                    </p>
                  </div>
                  <CopyButton value={featured.code} label="Copy code" />
                </div>
              </div>
            </div>
            {otherCoupons.length > 0 && (
              <ul className="grid gap-4 sm:grid-cols-2">
                {otherCoupons.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 rounded-card border-2 border-dashed border-mango/60 bg-surface p-5">
                    <div>
                      <p className="text-2xl font-extrabold text-ink">{couponHeadline(c)}</p>
                      <p className="text-sm text-ink-soft">{couponConditions(c)}</p>
                      <p className="mt-1 font-mono font-bold tracking-widest text-brand-deep">{c.code}</p>
                    </div>
                    <CopyButton value={c.code} variant="secondary" />
                  </li>
                ))}
              </ul>
            )}
            <div className="text-center">
              <Link href="/offers" className="font-bold text-brand-deep underline-offset-4 hover:underline">
                See all offers →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ───────── Reviews ───────── */}
      {reviews.length > 0 && (
        <section className="bg-cream/60 py-14 md:py-20" aria-labelledby="reviews-heading">
          <div className="container-page">
            <SectionHeading title="What Our Customers Are Saying" subtitle="Loved by thirsty souls every single day" />
            <span id="reviews-heading" className="sr-only">
              Customer reviews
            </span>
            <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
              {reviews.slice(0, 6).map((r) => (
                <li key={r.id} className="w-[85%] shrink-0 snap-center md:w-auto">
                  <ReviewCard review={r} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ───────── Location ───────── */}
      <section className="py-14 md:py-20" aria-label="Shop location">
        <div className="container-page">
          <LocationCard shop={shop} />
        </div>
      </section>
    </>
  );
}
