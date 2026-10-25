import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, Heart, Leaf, Snowflake, Users } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/shop/section-heading";
import { db } from "@/lib/db";
import { getReviewStats } from "@/server/catalog";

export const metadata: Metadata = {
  title: "About us",
  description: "The story of Cool Kick – fresh fruit, crushed ice and honest juices made to order.",
};

const VALUES = [
  { icon: Leaf, title: "Fresh, always", body: "Fruit bought every morning and pressed only when you order." },
  { icon: Snowflake, title: "Ice-cold, safely", body: "RO-purified ice and sanitised counters, every single shift." },
  { icon: Heart, title: "Honest recipes", body: "No concentrates, no preservatives – just fruit, ice and a little love." },
  { icon: Users, title: "Neighbourhood first", body: "Friendly faces, fair prices and drinks made the way you like them." },
];

export default async function AboutPage() {
  const [productCount, stats] = await Promise.all([
    db.product.count({ where: { isActive: true } }),
    getReviewStats(),
  ]);

  return (
    <>
      <section className="bg-gradient-to-b from-cream to-cream-50">
        <div className="container-page grid items-center gap-10 py-12 md:py-20 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-tangerine uppercase">Our story</p>
            <h1 className="mt-2 text-[2rem] leading-tight font-extrabold md:text-display-sm">
              Born on a hot afternoon, built on fresh fruit.
            </h1>
            <div className="mt-5 space-y-4 text-ink-soft md:text-lg">
              <p>
                Cool Kick started with a simple idea: the best cure for a sweltering Indian summer is a glass of
                freshly pressed juice, poured over a mountain of crushed ice.
              </p>
              <p>
                What began as a small counter with a juicer and a few crates of fruit is now the neighbourhood&apos;s
                favourite spot for ice juices, mojitos, thick shakes and royal faloodas. We still buy fruit every
                morning, we still press every drink to order, and we still taste everything before it leaves the counter.
              </p>
            </div>
            <LinkButton href="/menu" size="lg" className="mt-7">
              Explore the menu <ArrowRight className="size-5" aria-hidden />
            </LinkButton>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["/images/products/blue-lagoon-ice-juice.webp", "Blue Lagoon ice juice"],
              ["/images/products/royal-rose-falooda.webp", "Royal Rose Falooda"],
              ["/images/products/watermelon-juice.webp", "Watermelon juice"],
              ["/images/products/mojito-party-pack.webp", "Mojitos"],
            ].map(([src, alt], i) => (
              <div key={src} className={`relative aspect-square overflow-hidden rounded-[24px] shadow-warm ${i % 2 ? "translate-y-6" : ""}`}>
                <Image src={src} alt={alt} fill sizes="(max-width: 1024px) 45vw, 300px" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container-page">
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              [`${productCount}+`, "Drinks on the menu"],
              ["100%", "Fresh fruit"],
              [stats.average ? `${stats.average}★` : "5★", "Average rating"],
              ["0", "Preservatives"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-card bg-surface p-6 text-center shadow-warm-soft">
                <dd className="text-4xl font-extrabold text-brand-deep">{v}</dd>
                <dt className="mt-1 text-sm font-medium text-ink-soft">{l}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="bg-cream/60 py-14 md:py-20">
        <div className="container-page">
          <SectionHeading eyebrow="What we stand for" title="Our promise in every glass" />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-card bg-surface p-6 shadow-warm-soft">
                <span className="flex size-12 items-center justify-center rounded-full bg-mango-soft text-brand-deep">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container-page">
          <div className="rounded-[28px] bg-gradient-to-r from-brand to-mango p-8 text-center text-white shadow-warm md:p-14">
            <h2 className="text-3xl font-extrabold md:text-5xl">Thirsty yet?</h2>
            <p className="mx-auto mt-3 max-w-lg text-white/95 md:text-lg">Order online for pickup or delivery – it&apos;ll be ready before you know it.</p>
            <LinkButton href="/menu" variant="dark" size="lg" className="mt-6">
              Order now <ArrowRight className="size-5" aria-hidden />
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
