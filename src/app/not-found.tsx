import { GlassWater } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-cream to-cream-50 px-4 text-center">
      <Logo />
      <span className="mt-10 flex size-20 items-center justify-center rounded-full bg-mango-soft text-tangerine">
        <GlassWater className="size-10" aria-hidden />
      </span>
      <p className="mt-6 font-mono text-sm font-bold tracking-widest text-tangerine">404</p>
      <h1 className="mt-1 text-headline-sm font-extrabold">This glass is empty</h1>
      <p className="mt-2 max-w-md text-ink-soft">We couldn&apos;t find that page.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <LinkButton href="/menu">Browse the menu</LinkButton>
        <LinkButton href="/" variant="outline">
          Go home
        </LinkButton>
      </div>
    </main>
  );
}
