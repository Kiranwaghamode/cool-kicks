// Order status rules – enforced on the server, mirrored in the UI.

export const ORDER_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

/** Customer-friendly description of each status. */
export const STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  PLACED: "We've received your order and will confirm it shortly.",
  CONFIRMED: "Your order is confirmed and in the queue.",
  PREPARING: "We're crushing, pressing and blending your drinks.",
  READY_FOR_PICKUP: "Your order is ready – collect it at the counter.",
  OUT_FOR_DELIVERY: "Your chilled order is on its way.",
  DELIVERED: "Enjoy your drinks! 🍹",
  CANCELLED: "This order was cancelled.",
  REJECTED: "Sorry, we couldn't accept this order.",
};

export const ACTIVE_STATUSES: OrderStatus[] = ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];
export const CLOSED_STATUSES: OrderStatus[] = ["DELIVERED", "CANCELLED", "REJECTED"];
/** Statuses excluded from sales figures. */
export const NON_SALE_STATUSES: OrderStatus[] = ["CANCELLED", "REJECTED"];

/** Allowed transitions. The final step depends on fulfilment. */
export function allowedTransitions(status: OrderStatus, fulfilment: "PICKUP" | "DELIVERY"): OrderStatus[] {
  const handoff: OrderStatus = fulfilment === "PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY";
  switch (status) {
    case "PLACED":
      return ["CONFIRMED", "REJECTED", "CANCELLED"];
    case "CONFIRMED":
      return ["PREPARING", "CANCELLED"];
    case "PREPARING":
      return [handoff, "CANCELLED"];
    case "READY_FOR_PICKUP":
    case "OUT_FOR_DELIVERY":
      return ["DELIVERED", "CANCELLED"];
    default:
      return [];
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus, fulfilment: "PICKUP" | "DELIVERY") {
  return allowedTransitions(from, fulfilment).includes(to);
}

/** The "happy path" next step (for a single "Next" button). */
export function nextStatus(status: OrderStatus, fulfilment: "PICKUP" | "DELIVERY"): OrderStatus | null {
  const next = allowedTransitions(status, fulfilment).filter((s) => s !== "CANCELLED" && s !== "REJECTED");
  return next[0] ?? null;
}

/** Ordered steps for the customer timeline. */
export function timelineSteps(fulfilment: "PICKUP" | "DELIVERY"): OrderStatus[] {
  return ["PLACED", "CONFIRMED", "PREPARING", fulfilment === "PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY", "DELIVERED"];
}

export function deliveredLabel(fulfilment: "PICKUP" | "DELIVERY") {
  return fulfilment === "PICKUP" ? "Picked up" : "Delivered";
}
