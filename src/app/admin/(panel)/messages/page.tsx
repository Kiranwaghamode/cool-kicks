import { PageHeader } from "@/components/admin/ui";
import { MessageList } from "./message-list";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requireRole("messages");
  const messages = await db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Messages" description="Sent through the contact form on the website." />
      <MessageList messages={messages.map((m) => ({ id: m.id, name: m.name, phone: m.phone, email: m.email, message: m.message, isRead: m.isRead, createdAt: m.createdAt.toISOString() }))} />
    </>
  );
}
