import { Skeleton } from "@/components/ui/skeleton";

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-card bg-surface p-3 shadow-warm-soft md:p-4">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mx-auto mt-3 h-3 w-1/3" />
          <Skeleton className="mx-auto mt-2 h-5 w-3/4" />
          <Skeleton className="mx-auto mt-2 h-4 w-1/2" />
          <Skeleton className="mt-4 h-9 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container-page py-8 md:py-12" aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-8 h-10 w-64" />
      <ProductGridSkeleton />
    </div>
  );
}
