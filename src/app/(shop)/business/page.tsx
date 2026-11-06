import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, BadgePercent, CalendarClock, FileText, Package, ShieldCheck, Wallet } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/badge";
import { SectionHeading } from "@/components/shop/section-heading";
import { getBusiness } from "@/server/business-auth";
import { getShopName } from "@/server/brand";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getShopName();
  return {
    title: "Wholesale for retailers & distributors",
    description:
      `Stock ${name} juices in your shop. Wholesale prices, bulk packs, credit terms and GST invoices for approved retailers and distributors.`,
  };
}

const BENEFITS = [
  { icon: BadgePercent, title: "Wholesale prices", body: "Trade prices, with extra discounts as your order grows." },
  { icon: Package, title: "Bulk packs", body: "Order by the case with clear minimum quantities." },
  { icon: Wallet, title: "Credit terms", body: "Approved partners can order on credit and pay later." },
  { icon: FileText, title: "GST invoices", body: "Proper tax invoices and account statements, always online." },
  { icon: CalendarClock, title: "Scheduled delivery", body: "Pick the day and time slot that suits your shop." },
  { icon: ShieldCheck, title: "Quotes on request", body: "Large or special orders? Ask us for a quotation." },
];

const STEPS = [
  ["Register", "Tell us about your business and upload your GST certificate."],
  ["Get approved", "Our team verifies your details, usually within one working day."],
  ["Order in bulk", "See your prices, order by the case and track every delivery."],
];

export default async function BusinessLandingPage() {
  if (await getBusiness()) redirect("/business/account");
  const shopName = await getShopName();
  return (
    <>
      <section className="bg-gradient-to-b from-cream to-cream-50">
        <div className="container-page py-12 md:py-20">
          <div className="max-w-2xl">
            <Eyebrow>{shopName} for business</Eyebrow>
            <h1 className="mt-3 text-[2rem] leading-tight font-extrabold md:text-display-sm">
              Fresh juices for your shelves, at wholesale prices.
            </h1>
            <p className="mt-4 text-ink-soft md:text-lg">
              For retailers, cafés, canteens and distributors. Register once, get approved, and order bulk packs with GST
              invoices and flexible payment.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href="/business/register" size="lg">
                Register your business <ArrowRight className="size-5" aria-hidden />
              </LinkButton>
              <LinkButton href="/business/login" size="lg" variant="outline">
                Business login
              </LinkButton>
            </div>
            <p className="mt-4 text-sm text-ink-muted">Wholesale prices are shown only to approved business accounts.</p>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container-page">
          <SectionHeading eyebrow="Why partner with us" title="Everything a reseller needs" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-card bg-surface p-6 shadow-warm-soft">
                <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-1 text-ink-soft">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-cream py-14 md:py-20">
        <div className="container-page">
          <SectionHeading eyebrow="How it works" title="Three steps to your first order" />
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="rounded-card bg-surface p-6 shadow-warm-soft">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand text-lg font-extrabold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-1 text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-center">
            <LinkButton href="/business/register" size="lg">
              Get started <ArrowRight className="size-5" aria-hidden />
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
