import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { MotionProvider } from "@/components/shop/motion/motion-provider";
import { ShopNameProvider } from "@/components/brand/shop-name";
import { getShopName } from "@/server/brand";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// The shop name (titles, logo, messages) comes from Admin → Settings, so every page reads it per request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getShopName();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${name} – Fresh & Chilled Juices`,
      template: `%s | ${name}`,
    },
    description:
      "Fresh fruit juices, ice juices, mojitos, milkshakes and falooda – made to order. Order online for pickup or home delivery.",
    applicationName: name,
  };
}

export const viewport: Viewport = {
  themeColor: "#6ba32e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const shopName = await getShopName();
  return (
    <html lang="en-IN" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ShopNameProvider name={shopName}>
          <MotionProvider>
            {children}
            <Toaster />
          </MotionProvider>
        </ShopNameProvider>
      </body>
    </html>
  );
}
