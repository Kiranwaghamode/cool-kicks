"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Mail, MailOpen, Phone, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { Panel } from "@/components/admin/ui";
import { deleteMessage, setMessageRead } from "@/server/actions/admin/config";
import { formatDateTime } from "@/lib/order-format";
import { cn } from "@/lib/utils";

type Msg = { id: string; name: string; phone: string | null; email: string | null; message: string; isRead: boolean; createdAt: string };

export function MessageList({ messages }: { messages: Msg[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(p: Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const res = await p;
      if (res.ok) router.refresh();
      else toast.error("Not saved", res.error);
    });
  }
  return (
    <Panel>
      {messages.length === 0 ? (
        <EmptyState icon={<Mail />} title="No messages yet" description="Messages from the contact form will appear here." />
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={cn("rounded-2xl border p-4", m.isRead ? "border-line" : "border-brand/40 bg-brand-soft/40")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">
                    {m.name} {!m.isRead && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-[10px] text-white">NEW</span>}
                  </p>
                  <p className="text-xs text-ink-muted">{formatDateTime(m.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.phone && (
                    <a href={`tel:${m.phone}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                      <Phone className="size-4" aria-hidden /> {m.phone}
                    </a>
                  )}
                  {m.email && (
                    <a href={`mailto:${m.email}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                      <Mail className="size-4" aria-hidden /> Reply
                    </a>
                  )}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-ink-soft">{m.message}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(setMessageRead(m.id, !m.isRead))}>
                  <MailOpen className="size-4" aria-hidden /> Mark {m.isRead ? "unread" : "read"}
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(deleteMessage(m.id))}>
                  <Trash2 className="size-4" aria-hidden /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
