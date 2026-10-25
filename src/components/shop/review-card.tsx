import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn("flex gap-0.5", className)} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-4", i <= Math.round(rating) ? "fill-mango text-mango" : "text-line-strong")}
        />
      ))}
    </div>
  );
}

export function ReviewCard({
  review,
  className,
}: {
  review: { customerName: string; rating: number; comment: string; product?: { name: string } | null };
  className?: string;
}) {
  const initials = review.customerName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <figure className={cn("flex h-full flex-col rounded-card bg-surface p-6 shadow-warm-soft md:p-7", className)}>
      <Stars rating={review.rating} />
      <blockquote className="mt-4 flex-1 text-ink-soft italic md:text-lg">“{review.comment}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-mango-soft font-bold text-warning ring-2 ring-brand/60">
          {initials}
        </span>
        <span>
          <span className="block font-bold text-ink">{review.customerName}</span>
          {review.product && <span className="block text-xs text-ink-muted">on {review.product.name}</span>}
        </span>
      </figcaption>
    </figure>
  );
}
