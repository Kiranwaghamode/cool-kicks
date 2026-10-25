import { Skeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <div className="container-page py-6 md:py-10" aria-busy="true" aria-label="Loading drink">
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <Skeleton className="aspect-square w-full rounded-[28px]" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-72 w-full rounded-[24px]" />
        </div>
      </div>
    </div>
  );
}
