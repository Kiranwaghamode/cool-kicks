import type { ReactNode } from "react";
import { FileWarning } from "lucide-react";

export type PolicySection = { id: string; title: string; body: ReactNode };

/** Shared layout for privacy / terms / refund policy: TOC + sections + last updated. */
export function PolicyPage({
  title,
  intro,
  lastUpdated,
  sections,
}: {
  title: string;
  intro: ReactNode;
  lastUpdated: string;
  sections: PolicySection[];
}) {
  return (
    <div className="container-page py-10 md:py-16">
      <div className="mx-auto max-w-5xl">
        <p
          role="note"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-mango/50 bg-mango-soft px-4 py-3 text-sm font-medium text-warning"
        >
          <FileWarning className="mt-0.5 size-5 shrink-0" aria-hidden />
          DRAFT – this text is a starting point written for Cool Kick. The shop owner should review it (ideally with a
          legal advisor) before the website goes live.
        </p>
        <header className="mb-8">
          <h1 className="text-headline-sm font-extrabold md:text-headline">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">Last updated: {lastUpdated}</p>
          <div className="mt-4 max-w-3xl text-ink-soft md:text-lg">{intro}</div>
        </header>
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-2 text-xs font-bold tracking-wider text-ink-muted uppercase">On this page</p>
            <ol className="space-y-1.5 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block rounded-lg px-2 py-1 text-ink-soft hover:bg-cream hover:text-ink">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="space-y-8 rounded-[24px] bg-surface p-6 shadow-warm-soft md:p-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="mb-3 text-xl font-extrabold">
                  {i + 1}. {s.title}
                </h2>
                <div className="space-y-3 leading-relaxed text-ink-soft [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
