import type { Metadata } from "next";
import { FAQ } from "@/content/faq";
import { FaqAccordion } from "@/components/shop/faq-accordion";
import { SectionHeading } from "@/components/shop/section-heading";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about ordering, delivery areas, payment and our drinks at Cool Kick.",
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.flatMap((g) =>
      g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
    ),
  };
  return (
    <div className="container-page py-10 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SectionHeading as="h1" eyebrow="Help" title="Frequently Asked Questions" subtitle="Everything you need to know about ordering from Cool Kick." />
      <div className="mx-auto max-w-3xl space-y-10">
        {FAQ.map((g) => (
          <section key={g.title} aria-labelledby={`faq-${g.title}`}>
            <h2 id={`faq-${g.title}`} className="mb-4 text-xl font-extrabold">
              {g.title}
            </h2>
            <FaqAccordion items={g.items} />
          </section>
        ))}
        <div className="rounded-card bg-brand-soft p-6 text-center">
          <p className="font-bold">Still have a question?</p>
          <p className="mt-1 text-ink-soft">We&apos;re happy to help.</p>
          <LinkButton href="/contact" className="mt-4">
            Contact us
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
