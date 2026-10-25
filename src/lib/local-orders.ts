"use client";

/** Orders placed on this device (for "My Orders"). Stored in localStorage. */
export type LocalOrder = { orderNumber: string; phone: string; placedAt: string };

const KEY = "coolkick-orders";
const CUSTOMER_KEY = "coolkick-customer";

export function getLocalOrders(): LocalOrder[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((o) => o && typeof o.orderNumber === "string") : [];
  } catch {
    return [];
  }
}

export function saveLocalOrder(order: Omit<LocalOrder, "placedAt">) {
  try {
    const list = getLocalOrders().filter((o) => o.orderNumber !== order.orderNumber);
    list.unshift({ ...order, placedAt: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* storage unavailable – ignore */
  }
}

export function removeLocalOrder(orderNumber: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(getLocalOrders().filter((o) => o.orderNumber !== orderNumber)));
  } catch {
    /* ignore */
  }
}

export type SavedCustomer = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  area?: string;
  pincode?: string;
};

export function getSavedCustomer(): SavedCustomer {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMER_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function saveCustomer(c: SavedCustomer) {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}
