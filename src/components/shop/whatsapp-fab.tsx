import { DEFAULT_WHATSAPP_MESSAGE, whatsappLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/shop/icons";

export function WhatsAppFab({ number }: { number: string }) {
  return (
    <a
      href={whatsappLink(number, DEFAULT_WHATSAPP_MESSAGE)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="no-print fixed right-4 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_25px_rgb(37_211_102/0.4)] transition hover:scale-105 active:scale-95 lg:right-6 lg:bottom-6"
    >
      <WhatsAppIcon className="size-7" />
      <span className="absolute top-0.5 right-0.5 size-3 rounded-full border-2 border-white bg-brand" aria-hidden />
    </a>
  );
}
