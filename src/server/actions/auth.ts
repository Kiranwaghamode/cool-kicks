"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export type LoginState = { error: string; email: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const next = String(formData.get("next") ?? "/admin");
  const email = String(formData.get("email") ?? "").slice(0, 200);
  const redirectTo = next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin";
  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo,
    });
    return null;
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code;
      if (code === "locked") return { error: "Too many attempts. Please wait 15 minutes and try again.", email };
      return { error: "Incorrect email or password.", email };
    }
    throw e; // NEXT_REDIRECT on success
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
