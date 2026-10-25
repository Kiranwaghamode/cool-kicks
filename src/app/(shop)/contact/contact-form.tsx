"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { sendContactMessage, type ContactState } from "@/server/actions/contact";

export function ContactForm() {
  const [state, setState] = useState<ContactState>(null);
  const [pending, start] = useTransition();
  const startedAt = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (state?.ok) {
    return (
      <div role="status" className="flex flex-col items-center rounded-card bg-brand-soft p-8 text-center">
        <CheckCircle2 className="size-12 text-brand" aria-hidden />
        <p className="mt-3 text-lg font-bold text-brand-deep">{state.message}</p>
        <Button variant="outline" className="mt-5" onClick={() => setState(null)}>
          Send another message
        </Button>
      </div>
    );
  }

  const err = state?.fieldErrors ?? {};
  return (
    <form
      ref={formRef}
      noValidate
      onFocus={() => (startedAt.current ??= Date.now())}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await sendContactMessage({
            name: String(fd.get("name") ?? ""),
            phone: String(fd.get("phone") ?? ""),
            email: String(fd.get("email") ?? ""),
            message: String(fd.get("message") ?? ""),
            website: String(fd.get("website") ?? ""),
            startedAt: startedAt.current ?? undefined,
          }).catch(() => ({ ok: false, message: "Network problem – please try again." }));
          setState(res);
        });
      }}
      className="grid gap-4 md:grid-cols-2"
    >
      <Field label="Name" htmlFor="c-name" error={err.name} required>
        <Input id="c-name" name="name" autoComplete="name" aria-invalid={!!err.name || undefined} />
      </Field>
      <Field label="Phone" htmlFor="c-phone" error={err.phone}>
        <Input id="c-phone" name="phone" type="tel" autoComplete="tel" aria-invalid={!!err.phone || undefined} />
      </Field>
      <Field label="Email" htmlFor="c-email" error={err.email} className="md:col-span-2">
        <Input id="c-email" name="email" type="email" autoComplete="email" aria-invalid={!!err.email || undefined} />
      </Field>
      <Field label="Message" htmlFor="c-message" error={err.message} required className="md:col-span-2">
        <Textarea id="c-message" name="message" maxLength={1000} aria-invalid={!!err.message || undefined} placeholder="Bulk order, feedback, party booking…" />
      </Field>
      {/* Honeypot: hidden from people and screen readers */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm font-medium text-danger md:col-span-2">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="md:col-span-2 md:w-fit">
        <Send className="size-4" aria-hidden /> Send message
      </Button>
    </form>
  );
}
