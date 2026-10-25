import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { rateLimit, resetRateLimit } from "@/server/rate-limit";

class LockedOut extends CredentialsSignin {
  code = "locked";
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

// A real hash so failed lookups take the same time as wrong passwords.
const DUMMY_HASH = "$2b$12$T5Iq/2qkdkuSn2V6FCBT5eHUirFUACzHyfT6RFhy7d8E6TpsTLMEa";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

        // Lock out after repeated attempts: 5 per email / 20 per IP in 15 minutes.
        const [emailOk, ipOk] = await Promise.all([
          rateLimit(`login:email:${email}`, 5, 15 * 60),
          rateLimit(`login:ip:${ip}`, 20, 15 * 60),
        ]);
        if (!emailOk || !ipOk) throw new LockedOut();

        const user = await db.staffUser.findUnique({ where: { email } });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid || !user.isActive) return null;

        await Promise.all([
          resetRateLimit(`login:email:${email}`),
          db.staffUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
        ]);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
