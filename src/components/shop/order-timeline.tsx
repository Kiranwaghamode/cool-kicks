import { Ban, Check, CircleDot } from "lucide-react";
import { STATUS_DESCRIPTIONS, STATUS_LABELS, deliveredLabel, timelineSteps, type OrderStatus } from "@/lib/order-status";
import { formatDateTime } from "@/lib/order-format";
import { cn } from "@/lib/utils";

/** Vertical customer timeline built from the status history. */
export function OrderTimeline({
  status,
  fulfilment,
  history,
  cancelReason,
}: {
  status: OrderStatus;
  fulfilment: "PICKUP" | "DELIVERY";
  history: { toStatus: OrderStatus; createdAt: string; note: string | null }[];
  cancelReason?: string | null;
}) {
  const at = new Map<OrderStatus, string>();
  for (const h of history) at.set(h.toStatus, h.createdAt);

  if (status === "CANCELLED" || status === "REJECTED") {
    const reached = timelineSteps(fulfilment).filter((s) => at.has(s));
    return (
      <ol className="space-y-0">
        {reached.map((s) => (
          <Step key={s} label={STATUS_LABELS[s]} time={at.get(s)} state="done" />
        ))}
        <li className="flex gap-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger text-white">
            <Ban className="size-5" aria-hidden />
          </span>
          <div className="pb-2">
            <p className="font-bold text-danger">{STATUS_LABELS[status]}</p>
            {at.get(status) && <p className="text-xs text-ink-muted">{formatDateTime(at.get(status)!)}</p>}
            <p className="mt-1 text-sm text-ink-soft">{cancelReason || STATUS_DESCRIPTIONS[status]}</p>
          </div>
        </li>
      </ol>
    );
  }

  const steps = timelineSteps(fulfilment);
  const currentIndex = steps.indexOf(status);
  return (
    <ol>
      {steps.map((s, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? (s === "DELIVERED" ? "done" : "current") : "todo";
        const label = s === "DELIVERED" ? deliveredLabel(fulfilment) : STATUS_LABELS[s];
        return (
          <Step
            key={s}
            label={label}
            time={at.get(s)}
            state={state}
            description={i === currentIndex ? STATUS_DESCRIPTIONS[s] : undefined}
            last={i === steps.length - 1}
          />
        );
      })}
    </ol>
  );
}

function Step({
  label,
  time,
  state,
  description,
  last,
}: {
  label: string;
  time?: string;
  state: "done" | "current" | "todo";
  description?: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4" aria-current={state === "current" ? "step" : undefined}>
      {!last && (
        <span
          aria-hidden
          className={cn("absolute top-9 bottom-0 left-[17px] w-0.5", state === "done" ? "bg-brand" : "bg-line-strong")}
        />
      )}
      <span
        className={cn(
          "relative flex size-9 shrink-0 items-center justify-center rounded-full",
          state === "done" && "bg-brand text-white",
          state === "current" && "bg-mango text-ink ring-4 ring-mango/30",
          state === "todo" && "border-2 border-line-strong bg-surface text-ink-muted",
        )}
      >
        {state === "current" && (
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-mango/50 motion-reduce:hidden" />
        )}
        {state === "done" ? <Check className="size-5" aria-hidden /> : <CircleDot className="relative size-4" aria-hidden />}
      </span>
      <div className="pb-7">
        <p className={cn("font-bold", state === "todo" && "text-ink-muted")}>{label}</p>
        {time && <p className="text-xs text-ink-muted">{formatDateTime(time)}</p>}
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        <span className="sr-only">{state === "done" ? "(completed)" : state === "current" ? "(current step)" : "(upcoming)"}</span>
      </div>
    </li>
  );
}
