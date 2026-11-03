export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Printable documents for business customers (invoices, statements) – no shop chrome. */
export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white text-black">{children}</div>;
}
