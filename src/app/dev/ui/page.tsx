import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { UiShowcase } from "./showcase";

export const metadata: Metadata = { title: "UI kit (dev)", robots: { index: false } };

/** Development-only component gallery. Returns 404 in production. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiShowcase />;
}
