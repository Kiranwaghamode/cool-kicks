import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * First line of defence: unauthenticated visitors to /admin are sent to the login page.
 * Every admin page, server action and data function checks the session + role again (requireRole).
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: ["/admin/:path*"],
};
