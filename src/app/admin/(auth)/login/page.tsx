import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/ui/logo";
import { getStaff } from "@/server/auth-guard";

export const metadata: Metadata = { title: "Staff login", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getStaff()) redirect("/admin");
  const sp = await searchParams;
  const next = typeof sp.callbackUrl === "string" ? new URL(sp.callbackUrl, "http://x").pathname : "/admin";
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>
        <div className="rounded-[28px] bg-surface p-7 shadow-warm md:p-9">
          <h1 className="text-2xl font-extrabold">Staff login</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to manage orders, menu and the shop.</p>
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-ink-muted">Authorised Cool Kick staff only. All logins are recorded.</p>
      </div>
    </main>
  );
}
