// Order status rules – enforced on the server, mirrored in the UI.

export const ORDER_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "PACKED",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderChannel = "RETAIL" | "WHOLESALE";
type Fulfilment = "PICKUP" | "DELIVERY";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  PACKED: "Packed",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

/** Wholesale wording for the same statuses. */
export const WHOLESALE_STATUS_LABELS: Record<OrderStatus, string> = {
  ...STATUS_LABELS,
  PREPARING: "Processing",
  OUT_FOR_DELIVERY: "Dispatched",
};

export function statusLabel(status: OrderStatus, channel: OrderChannel = "RETAIL") {
  return (channel === "WHOLESALE" ? WHOLESALE_STATUS_LABELS : STATUS_LABELS)[status];
}

/** Customer-friendly description of each status. */
export const STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  PLACED: "We've received your order and will confirm it shortly.",
  CONFIRMED: "Your order is confirmed and in the queue.",
  PREPARING: "We're crushing, pressing and blending your drinks.",
  PACKED: "Your order is packed and waiting for dispatch.",
  READY_FOR_PICKUP: "Your order is ready – collect it at the counter.",
  OUT_FOR_DELIVERY: "Your chilled order is on its way.",
  DELIVERED: "Enjoy your drinks! 🍹",
  CANCELLED: "This order was cancelled.",
  REJECTED: "Sorry, we couldn't accept this order.",
};

export const WHOLESALE_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  PLACED: "We've received your order and will confirm it shortly.",
  CONFIRMED: "Order confirmed. Stock has been reserved for you.",
  PREPARING: "Your order is being prepared.",
  PACKED: "Packed and waiting for dispatch.",
  READY_FOR_PICKUP: "Ready to collect from the shop.",
  OUT_FOR_DELIVERY: "Dispatched – on its way to you.",
  DELIVERED: "Delivered.",
  CANCELLED: "This order was cancelled.",
  REJECTED: "Sorry, we couldn't accept this order.",
};

export const ACTIVE_STATUSES: OrderStatus[] = ["PLACED", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];
export const CLOSED_STATUSES: OrderStatus[] = ["DELIVERED", "CANCELLED", "REJECTED"];
/** Statuses excluded from sales figures. */
export const NON_SALE_STATUSES: OrderStatus[] = ["CANCELLED", "REJECTED"];

/** Allowed transitions. The final step depends on fulfilment; wholesale orders have an extra PACKED step. */
export function allowedTransitions(status: OrderStatus, fulfilment: Fulfilment, channel: OrderChannel = "RETAIL"): OrderStatus[] {
  const handoff: OrderStatus = fulfilment === "PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY";
  const wholesale = channel === "WHOLESALE";
  switch (status) {
    case "PLACED":
      return ["CONFIRMED", "REJECTED", "CANCELLED"];
    case "CONFIRMED":
      return ["PREPARING", "CANCELLED"];
    case "PREPARING":
      return wholesale ? ["PACKED", "CANCELLED"] : [handoff, "CANCELLED"];
    case "PACKED":
      return wholesale ? [handoff, "CANCELLED"] : [];
    case "READY_FOR_PICKUP":
    case "OUT_FOR_DELIVERY":
      return ["DELIVERED", "CANCELLED"];
    default:
      return [];
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus, fulfilment: Fulfilment, channel: OrderChannel = "RETAIL") {
  return allowedTransitions(from, fulfilment, channel).includes(to);
}

/** The "happy path" next step (for a single "Next" button). */
export function nextStatus(status: OrderStatus, fulfilment: Fulfilment, channel: OrderChannel = "RETAIL"): OrderStatus | null {
  const next = allowedTransitions(status, fulfilment, channel).filter((s) => s !== "CANCELLED" && s !== "REJECTED");
  return next[0] ?? null;
}

/** Ordered steps for the customer timeline. */
export function timelineSteps(fulfilment: Fulfilment, channel: OrderChannel = "RETAIL"): OrderStatus[] {
  const handoff: OrderStatus = fulfilment === "PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY";
  return channel === "WHOLESALE"
    ? ["PLACED", "CONFIRMED", "PREPARING", "PACKED", handoff, "DELIVERED"]
    : ["PLACED", "CONFIRMED", "PREPARING", handoff, "DELIVERED"];
}

export function deliveredLabel(fulfilment: Fulfilment) {
  return fulfilment === "PICKUP" ? "Picked up" : "Delivered";
}
