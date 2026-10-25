"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/server/rate-limit";

const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name").max(60),
    phone: z.string().trim().max(16).optional().default(""),
    email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional().default(""),
    message: z.string().trim().min(10, "Please write a little more (10+ characters)").max(1000),
    /** Honeypot – real people never fill this in. */
    website: z.string().optional().default(""),
    /** Time the form was rendered (ms). Bots submit instantly. */
    startedAt: z.number().optional(),
  })
  .refine((v) => v.phone || v.email, { message: "Add a phone number or email so we can reply", path: ["phone"] });

export type ContactState = { ok: boolean; message: string; fieldErrors?: Record<string, string> } | null;

export async function sendContactMessage(input: z.input<typeof contactSchema>): Promise<ContactState> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, message: "Please check the form.", fieldErrors };
  }
  const v = parsed.data;
  // Spam: pretend success so bots don't learn anything.
  if (v.website || (v.startedAt && Date.now() - v.startedAt < 2500)) {
    return { ok: true, message: "Thanks! We'll get back to you soon." };
  }
  const ip = await clientIp();
  if (!(await rateLimit(`contact:ip:${ip}`, 3, 60 * 60))) {
    return { ok: false, message: "You've sent a few messages already. Please call or WhatsApp us instead." };
  }
  await db.contactMessage.create({
    data: { name: v.name, phone: v.phone || null, email: v.email || null, message: v.message },
  });
  return { ok: true, message: "Thanks! We'll get back to you soon." };
}
