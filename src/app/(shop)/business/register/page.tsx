import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";
import { getBusiness } from "@/server/business-auth";

export const metadata: Metadata = {
  title: "Register your business",
  description: "Apply for a Cool Kick wholesale account for your shop or distribution business.",
};

export default async function BusinessRegisterPage() {
  if (await getBusiness()) redirect("/business/account");
  return (
    <div className="container-page py-10 md:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold tracking-[0.18em] text-tangerine uppercase">Wholesale account</p>
        <h1 className="mt-2 text-[2rem] leading-tight font-extrabold md:text-headline">Register your business</h1>
        <p className="mt-2 text-ink-soft">
          We review every application before showing wholesale prices. Already registered?{" "}
          <Link href="/business/login" className="font-bold text-brand-deep underline">
            Log in
          </Link>
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
