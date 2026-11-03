"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Building2, Eye, EyeOff, FileUp, Lock, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StateSelect } from "@/components/ui/state-select";
import { toast } from "@/components/ui/toast";
import { registerBusinessSchema } from "@/lib/b2b-validation";
import { gstinProblem, normalizeGstin } from "@/lib/gst";
import type { BusinessType } from "@/lib/types";
import { registerBusiness } from "@/server/actions/business/account";

type FormState = {
  legalName: string;
  tradeName: string;
  type: BusinessType;
  contactName: string;
  phone: string;
  email: string;
  password: string;
  confirm: string;
  gstin: string;
  pan: string;
  stateCode: string;
  line1: string;
  line2: string;
  landmark: string;
  area: string;
  city: string;
  pincode: string;
  acceptTerms: boolean;
};

const EMPTY: FormState = {
  legalName: "",
  tradeName: "",
  type: "RETAILER",
  contactName: "",
  phone: "",
  email: "",
  password: "",
  confirm: "",
  gstin: "",
  pan: "",
  stateCode: "27",
  line1: "",
  line2: "",
  landmark: "",
  area: "",
  city: "",
  pincode: "",
  acceptTerms: false,
};

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-card bg-surface p-5 shadow-warm-soft md:p-7">
      <legend className="sr-only">{title}</legend>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-deep [&_svg]:size-5">{icon}</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [f, setF] = useState<FormState>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const err = (k: string) => errors[k];
  const bind = (k: keyof FormState, id: string) => ({
    id,
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never),
    "aria-invalid": err(k) ? true : undefined,
    "aria-describedby": err(k) ? `${id}-error` : undefined,
  });

  function onGstinChange(value: string) {
    const g = normalizeGstin(value).slice(0, 15);
    setF((prev) => {
      const next = { ...prev, gstin: g };
      // A valid GSTIN tells us the state and PAN.
      if (g.length === 15 && !gstinProblem(g)) {
        next.stateCode = g.slice(0, 2);
        next.pan = g.slice(2, 12);
      }
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      legalName: f.legalName,
      tradeName: f.tradeName,
      type: f.type,
      contactName: f.contactName,
      phone: f.phone,
      email: f.email,
      password: f.password,
      gstin: f.gstin,
      pan: f.pan,
      stateCode: f.stateCode,
      address: { line1: f.line1, line2: f.line2, landmark: f.landmark, area: f.area, city: f.city, pincode: f.pincode },
      acceptTerms: f.acceptTerms,
    };
    const parsed = registerBusinessSchema.safeParse(data);
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const key = i.path[0] === "address" ? String(i.path[1]) : i.path.join(".");
        nextErrors[key] ??= i.message;
      }
    }
    if (f.password !== f.confirm) nextErrors.confirm = "Passwords don't match";
    if (file && file.size > 3 * 1024 * 1024) nextErrors.gstCertificate = "File is too large (max 3 MB)";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error("Please check the form", Object.values(nextErrors)[0]);
      document.getElementById(`r-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }

    start(async () => {
      const fd = new FormData();
      fd.set("data", JSON.stringify(data));
      if (file) fd.set("gstCertificate", file);
      const res = await registerBusiness(fd);
      if (res.ok) {
        toast.success("Application received", "We'll review your details shortly.");
        router.push("/business/account");
        router.refresh();
      } else {
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.fieldErrors ?? {})) fe[k.replace(/^address\./, "")] = v;
        setErrors(fe);
        toast.error("Registration failed", res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-5">
      <Section icon={<Building2 />} title="Business details">
        <Field label="Registered business name" htmlFor="r-legalName" error={err("legalName")} required className="sm:col-span-2">
          <Input {...bind("legalName", "r-legalName")} autoComplete="organization" maxLength={120} />
        </Field>
        <Field label="Shop / trade name" htmlFor="r-tradeName" hint="If different from the registered name" className="sm:col-span-2">
          <Input {...bind("tradeName", "r-tradeName")} maxLength={120} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 pl-1 text-sm font-semibold">I am a</p>
          <SegmentedControl
            label="Business type"
            value={f.type}
            onChange={(v) => set("type", v)}
            options={[
              { value: "RETAILER", label: "Retailer", hint: "Shop, café, canteen" },
              { value: "DISTRIBUTOR", label: "Distributor", hint: "Supply to other shops" },
            ]}
          />
        </div>
        <Field label="GSTIN" htmlFor="r-gstin" error={err("gstin")} hint="Optional, but needed for GST input credit">
          <Input
            id="r-gstin"
            value={f.gstin}
            onChange={(e) => onGstinChange(e.target.value)}
            placeholder="27ABCDE1234F1Z5"
            className="font-mono uppercase"
            aria-invalid={err("gstin") ? true : undefined}
            aria-describedby={err("gstin") ? "r-gstin-error" : undefined}
          />
        </Field>
        <Field label="PAN" htmlFor="r-pan" error={err("pan")} hint="Optional">
          <Input {...bind("pan", "r-pan")} onChange={(e) => set("pan", e.target.value.toUpperCase().slice(0, 10))} placeholder="ABCDE1234F" className="font-mono uppercase" />
        </Field>
        <Field label="State" htmlFor="r-stateCode" error={err("stateCode")} required className="sm:col-span-2">
          <StateSelect id="r-stateCode" value={f.stateCode} onChange={(e) => set("stateCode", e.target.value)} aria-invalid={err("stateCode") ? true : undefined} />
        </Field>
      </Section>

      <Section icon={<UserRound />} title="Contact person">
        <Field label="Full name" htmlFor="r-contactName" error={err("contactName")} required>
          <Input {...bind("contactName", "r-contactName")} autoComplete="name" maxLength={60} />
        </Field>
        <Field label="Mobile number" htmlFor="r-phone" error={err("phone")} required hint="You'll log in with this number">
          <Input {...bind("phone", "r-phone")} type="tel" inputMode="numeric" autoComplete="tel" placeholder="98765 43210" />
        </Field>
        <Field label="Email" htmlFor="r-email" error={err("email")} className="sm:col-span-2">
          <Input {...bind("email", "r-email")} type="email" autoComplete="email" />
        </Field>
      </Section>

      <Section icon={<MapPin />} title="Business address">
        <Field label="Shop / building and street" htmlFor="r-line1" error={err("line1")} required className="sm:col-span-2">
          <Input {...bind("line1", "r-line1")} autoComplete="address-line1" maxLength={120} />
        </Field>
        <Field label="Address line 2" htmlFor="r-line2" className="sm:col-span-2">
          <Input {...bind("line2", "r-line2")} autoComplete="address-line2" maxLength={120} />
        </Field>
        <Field label="Area" htmlFor="r-area" error={err("area")} required>
          <Input {...bind("area", "r-area")} maxLength={80} />
        </Field>
        <Field label="Landmark" htmlFor="r-landmark">
          <Input {...bind("landmark", "r-landmark")} maxLength={80} />
        </Field>
        <Field label="City" htmlFor="r-city" error={err("city")} required>
          <Input {...bind("city", "r-city")} autoComplete="address-level2" maxLength={60} />
        </Field>
        <Field label="Pincode" htmlFor="r-pincode" error={err("pincode")} required>
          <Input {...bind("pincode", "r-pincode")} inputMode="numeric" autoComplete="postal-code" maxLength={6} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
      </Section>

      <Section icon={<FileUp />} title="Verification">
        <Field label="GST certificate" htmlFor="r-gstCertificate" error={err("gstCertificate")} hint="PDF, JPG or PNG, up to 3 MB. You can also upload it later." className="sm:col-span-2">
          <input
            id="r-gstCertificate"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-3xl border-[1.5px] border-dashed border-line-strong bg-cream-50 p-4 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:font-bold file:text-white"
          />
        </Field>
      </Section>

      <Section icon={<Lock />} title="Create your login">
        <Field label="Password" htmlFor="r-password" error={err("password")} required hint="At least 8 characters with a number">
          <div className="relative">
            <Input {...bind("password", "r-password")} type={show ? "text" : "password"} autoComplete="new-password" className="pr-12" />
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
        <Field label="Confirm password" htmlFor="r-confirm" error={err("confirm")} required>
          <Input {...bind("confirm", "r-confirm")} type={show ? "text" : "password"} autoComplete="new-password" />
        </Field>
      </Section>

      <div className="rounded-card bg-surface p-5 shadow-warm-soft md:p-7">
        <label className="flex items-start gap-3">
          <Checkbox id="r-acceptTerms" checked={f.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} className="mt-0.5" />
          <span className="text-sm text-ink-soft">
            I confirm these details are correct and agree to the{" "}
            <Link href="/terms" className="font-bold text-brand-deep underline" target="_blank">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-bold text-brand-deep underline" target="_blank">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {err("acceptTerms") && (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {err("acceptTerms")}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-5 w-full" loading={pending}>
          Submit application
        </Button>
      </div>
    </form>
  );
}
