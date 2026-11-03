import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BusinessLoginForm } from "./login-form";
import { getBusiness } from "@/server/business-auth";

export const metadata: Metadata = { title: "Business login", robots: { index: false, follow: true } };

export default async function BusinessLoginPage({ searchParams }: PageProps<"/business/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/business/") && !sp.next.startsWith("//") ? sp.next : "/business/account";
  if (await getBusiness()) redirect(next);
  return (
    <div className="container-page flex justify-center py-12 md:py-20">
      <div className="w-full max-w-md rounded-[28px] bg-surface p-7 shadow-warm md:p-9">
        <h1 className="text-2xl font-extrabold">Business login</h1>
        <p className="mt-1 text-sm text-ink-soft">For registered retailers and distributors.</p>
        <BusinessLoginForm next={next} />
        <p className="mt-6 text-center text-sm text-ink-soft">
          New here?{" "}
          <Link href="/business/register" className="font-bold text-brand-deep underline">
            Register your business
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-ink-muted">Forgot your password? Call or WhatsApp us and we&apos;ll reset it.</p>
      </div>
    </div>
  );
}
