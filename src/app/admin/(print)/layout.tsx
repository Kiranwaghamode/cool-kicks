export const dynamic = "force-dynamic";
export const metadata = { title: "Order slip", robots: { index: false, follow: false } };

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white text-black">{children}</div>;
}
