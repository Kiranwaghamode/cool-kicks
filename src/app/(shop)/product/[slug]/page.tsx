import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft, Leaf, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/chip";
import { ProductConfigurator } from "@/components/shop/product-configurator";
import { ProductCard } from "@/components/shop/product-card";
import { ReviewCard } from "@/components/shop/review-card";
import { getProductBySlug, getRelatedProducts } from "@/server/catalog";
import { formatPaise } from "@/lib/money";
import { TAG_LABELS } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Drink not found" };
  const from = Math.min(...p.variants.map((v) => v.price));
  const description = `${p.description ?? p.name} From ${formatPaise(from)}. Order online for pickup or delivery.`;
  return {
    title: p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: {
      title: `${p.name} | Cool Kick`,
      description,
      images: p.image ? [{ url: p.image, width: 800, height: 800, alt: p.name }] : undefined,
    },
  };
}

const TAG_TONES = { BESTSELLER: "brand", NEW: "mango", SEASONAL: "melon" } as const;

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product.id, product.category.id, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${product.image}` : undefined,
    category: product.category.name,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      name: v.size,
      price: (v.price / 100).toFixed(2),
      priceCurrency: "INR",
      availability: v.isAvailable && product.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    })),
    ...(product.rating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount } }
      : {}),
  };

  return (
    <div className="container-page pt-4 pb-40 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-ink-soft">
        <Link href={`/menu/${product.category.slug}`} className="inline-flex items-center gap-1 font-semibold hover:text-brand-deep">
          <ChevronLeft className="size-4" aria-hidden /> {product.category.name}
        </Link>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10 lg:gap-16">
        <div className="md:sticky md:top-28 md:self-start">
          <div className="relative aspect-square overflow-hidden rounded-[28px] border-4 border-white bg-cream shadow-warm">
            {product.image && (
              <Image
                src={product.image}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className={product.isAvailable ? "object-cover" : "object-cover grayscale"}
              />
            )}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <Badge key={t} tone={TAG_TONES[t]} className="shadow-sm">
                  {TAG_LABELS[t]}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">{product.category.name}</p>
          <h1 className="mt-1 text-headline-sm font-extrabold md:text-headline">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-2xl font-extrabold">
              {formatPaise(Math.min(...product.variants.map((v) => v.price)))}
              <span className="ml-1 text-sm font-medium text-ink-muted">onwards</span>
            </span>
            {product.rating && (
              <span className="flex items-center gap-1 rounded-full bg-mango-soft px-2.5 py-1 text-sm font-bold">
                <Star className="size-4 fill-mango text-mango" aria-hidden /> {product.rating}
                <span className="font-medium text-ink-soft">({product.reviewCount})</span>
              </span>
            )}
            {product.isAvailable ? (
              <Badge tone="success">
                <Leaf className="size-3" aria-hidden /> Available
              </Badge>
            ) : (
              <Badge tone="danger">Currently unavailable</Badge>
            )}
          </div>
          {product.description && <p className="mt-4 text-ink-soft md:text-lg">{product.description}</p>}

          {product.ingredients.length > 0 && (
            <div className="mt-5">
              <h2 className="mb-2 text-sm font-bold">Ingredients</h2>
              <ul className="flex flex-wrap gap-2">
                {product.ingredients.map((i) => (
                  <li key={i}>
                    <Tag>{i}</Tag>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 rounded-[24px] bg-surface p-5 shadow-warm-soft md:p-6">
            <ProductConfigurator
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                image: product.image,
                isAvailable: product.isAvailable,
                allowSugarChoice: product.allowSugarChoice,
                allowIceChoice: product.allowIceChoice,
                variants: product.variants,
              }}
            />
          </div>
        </div>
      </div>

      {product.reviews.length > 0 && (
        <section className="mt-16" aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="mb-6 text-headline-sm font-extrabold">
            What people say
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {product.reviews.map((r) => (
              <li key={r.id}>
                <ReviewCard review={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-title">
          <h2 id="related-title" className="mb-6 text-headline-sm font-extrabold">
            You may also like
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
