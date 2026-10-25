/** Build a wa.me click-to-chat link. `number` is digits with country code, e.g. 919876543210. */
export function whatsappLink(number: string, text?: string) {
  const digits = number.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telLink(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** "+919876543210" -> "+91 98765 43210" */
export function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  const local = d.length > 10 ? d.slice(-10) : d;
  const cc = d.length > 10 ? `+${d.slice(0, d.length - 10)} ` : "";
  return local.length === 10 ? `${cc}${local.slice(0, 5)} ${local.slice(5)}` : phone;
}

export const DEFAULT_WHATSAPP_MESSAGE = "Hi Cool Kick! 🍹 I'd like to place an order.";
