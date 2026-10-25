import { GlassWater } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function ShopNotFound() {
  return (
    <div className="container-page py-16 md:py-24">
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-[28px] bg-surface p-10 text-center shadow-warm-soft">
        <span className="flex size-20 items-center justify-center rounded-full bg-mango-soft text-tangerine">
          <GlassWater className="size-10" aria-hidden />
        </span>
        <p className="mt-6 font-mono text-sm font-bold tracking-widest text-tangerine">404</p>
        <h1 className="mt-1 text-headline-sm font-extrabold">This glass is empty</h1>
        <p className="mt-2 text-ink-soft">We couldn&apos;t find the page you were looking for. It may have moved, or the drink is off the menu.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LinkButton href="/menu">Browse the menu</LinkButton>
          <LinkButton href="/" variant="outline">
            Go home
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
