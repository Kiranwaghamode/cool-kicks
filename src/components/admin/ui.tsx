import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { BUSINESS_STATUS_LABELS, PAYMENT_STATUS_LABELS, QUOTATION_STATUS_LABELS, type BusinessStatus, type PaymentStatus, type QuotationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[20px] border border-line bg-surface p-5 shadow-[0_2px_10px_rgb(17_17_17/0.03)]", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** KPI tile: label, big value, optional hint. */
export function StatTile({ label, value, hint, icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "brand" | "mango" | "melon" | "ice" }) {
  const tones = { brand: "bg-brand-soft text-brand-deep", mango: "bg-mango-soft text-warning", melon: "bg-melon-soft text-melon-deep", ice: "bg-ice text-ice-deep" };
  return (
    <div className="rounded-[20px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-soft">{label}</p>
        {icon && <span className={cn("flex size-9 items-center justify-center rounded-full [&_svg]:size-5", tones[tone])}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums md:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

const STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  PLACED: "melon",
  CONFIRMED: "ice",
  PREPARING: "mango",
  PACKED: "ice",
  READY_FOR_PICKUP: "brand",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "success",
  CANCELLED: "neutral",
  REJECTED: "danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{status === "PLACED" ? "New" : STATUS_LABELS[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone: BadgeTone = status === "PAID" ? "success" : status === "PARTIALLY_PAID" ? "ice" : status === "REFUNDED" ? "ice" : status === "FAILED" ? "danger" : "warning";
  return <Badge tone={tone}>{status === "PENDING" ? "Unpaid" : PAYMENT_STATUS_LABELS[status]}</Badge>;
}

const BUSINESS_TONES: Record<BusinessStatus, BadgeTone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", SUSPENDED: "neutral" };

export function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  return <Badge tone={BUSINESS_TONES[status]}>{BUSINESS_STATUS_LABELS[status]}</Badge>;
}

const QUOTE_TONES: Record<QuotationStatus, BadgeTone> = { REQUESTED: "melon", QUOTED: "ice", ACCEPTED: "success", DECLINED: "neutral", CANCELLED: "neutral" };

export function QuotationBadge({ status }: { status: QuotationStatus }) {
  return <Badge tone={QUOTE_TONES[status]}>{status === "REQUESTED" ? "New request" : QUOTATION_STATUS_LABELS[status]}</Badge>;
}

/** Wholesale channel marker for order lists. */
export function WholesaleBadge() {
  return <Badge tone="dark">B2B</Badge>;
}

/** Simple responsive table wrapper. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-5 overflow-x-auto px-5">{children}</div>;
}

export const th = "px-3 py-2.5 text-left text-xs font-bold tracking-wide text-ink-muted uppercase whitespace-nowrap";
export const td = "px-3 py-3 align-middle";
