import { ShieldAlert } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "No access" };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-[28px] bg-surface p-10 text-center shadow-warm-soft">
      <span className="flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger">
        <ShieldAlert className="size-8" aria-hidden />
      </span>
      <p className="mt-5 font-mono text-sm font-bold text-danger">403</p>
      <h1 className="mt-1 text-2xl font-extrabold">You don&apos;t have access</h1>
      <p className="mt-2 text-ink-soft">This area is restricted for your role. Ask the shop owner if you need access.</p>
      <LinkButton href="/admin" className="mt-6">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
