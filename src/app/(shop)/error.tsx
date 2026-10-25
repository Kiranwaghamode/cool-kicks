"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page py-16 md:py-24">
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-[28px] bg-surface p-10 text-center shadow-warm-soft">
        <span className="flex size-20 items-center justify-center rounded-full bg-melon-soft text-melon-deep">
          <TriangleAlert className="size-10" aria-hidden />
        </span>
        <h1 className="mt-6 text-headline-sm font-extrabold">Oops, something spilled</h1>
        <p className="mt-2 text-ink-soft">Something went wrong on our side. Please try again – your cart is safe.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-ink-muted">Ref: {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
          <LinkButton href="/" variant="outline">
            Go home
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
