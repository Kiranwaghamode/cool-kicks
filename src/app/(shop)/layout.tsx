import { SiteHeader } from "@/components/shop/site-header";
import { BottomNav } from "@/components/shop/bottom-nav";
import { SiteFooter } from "@/components/shop/site-footer";
import { WhatsAppFab } from "@/components/shop/whatsapp-fab";
import { ShopStatusBanner } from "@/components/shop/shop-status-banner";
import { getPublicShopInfo } from "@/server/settings";
import { SmoothScroll } from "@/components/shop/motion/smooth-scroll";
import { FlyToCart } from "@/components/shop/motion/fly-to-cart";

// Shop pages read live data (availability, opening hours) on every request.
export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const shop = await getPublicShopInfo();
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[90] rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <ShopStatusBanner status={shop.status} />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter shop={shop} />
      <WhatsAppFab number={shop.whatsappNumber} />
      <BottomNav />
      <FlyToCart />
      <SmoothScroll />
    </>
  );
}
