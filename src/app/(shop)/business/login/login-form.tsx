"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { businessLogin } from "@/server/actions/business/account";

export function BusinessLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(businessLogin, null);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Mobile number" htmlFor="b-phone">
        <Input
          id="b-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="username"
          placeholder="98765 43210"
          required
          autoFocus
          defaultValue={state?.phone ?? ""}
          key={state?.phone ?? "empty"}
        />
      </Field>
      <Field label="Password" htmlFor="b-password">
        <div className="relative">
          <Input id="b-password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-12" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-cream"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        <LogIn className="size-5" aria-hidden /> Log in
      </Button>
    </form>
  );
}
