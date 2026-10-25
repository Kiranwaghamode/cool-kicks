import { formatPaise } from "@/lib/money";
import { SHOP_TIMEZONE } from "@/lib/shop-hours";
import { ICE_LABELS, PAYMENT_METHOD_LABELS, SIZE_LABELS, SUGAR_LABELS, type Fulfilment, type Level, type PaymentMethod, type Size } from "@/lib/types";

export function formatDateTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: SHOP_TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: SHOP_TIMEZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** Estimated ready / delivery time. */
export function estimatedTime(createdAt: string | Date, fulfilment: Fulfilment, prepMins: number) {
  const mins = prepMins + (fulfilment === "DELIVERY" ? 20 : 0);
  return { mins, at: new Date(new Date(createdAt).getTime() + mins * 60_000) };
}

export function itemOptions(i: { size: Size; sugarLevel: Level; iceLevel: Level }) {
  return [
    SIZE_LABELS[i.size],
    i.sugarLevel !== "REGULAR" ? SUGAR_LABELS[i.sugarLevel] : null,
    i.iceLevel !== "REGULAR" ? ICE_LABELS[i.iceLevel] : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** WhatsApp message with the order summary. */
export function orderWhatsappText(o: {
  orderNumber: string;
  fulfilment: Fulfilment;
  paymentMethod: PaymentMethod;
  total: number;
  items: { productName: string; quantity: number; size: Size; sugarLevel: Level; iceLevel: Level; instructions: string | null }[];
}) {
  const lines = o.items.map(
    (i) => `• ${i.quantity} × ${i.productName} (${itemOptions(i)})${i.instructions ? ` – ${i.instructions}` : ""}`,
  );
  return [
    `Hi Cool Kick! 🍹 I just placed order *${o.orderNumber}*.`,
    "",
    ...lines,
    "",
    `Total: ${formatPaise(o.total)} · ${o.fulfilment === "PICKUP" ? "Pickup" : "Delivery"} · ${PAYMENT_METHOD_LABELS[o.paymentMethod]}`,
  ].join("\n");
}
