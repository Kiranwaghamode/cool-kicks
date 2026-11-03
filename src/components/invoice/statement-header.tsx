import { formatDate } from "@/lib/order-format";

export function StatementHeader({
  seller,
  buyer,
  from,
  to,
}: {
  seller: { name: string; address: string; gstin: string | null };
  buyer: { legalName: string; tradeName: string | null; gstin: string | null; phone: string };
  from: string;
  to: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-3 text-sm">
      <div>
        <p className="text-lg font-extrabold">{seller.name}</p>
        <p className="max-w-sm">{seller.address}</p>
        {seller.gstin && <p>GSTIN: {seller.gstin}</p>}
      </div>
      <div className="text-right">
        <p className="text-lg font-extrabold tracking-wide">ACCOUNT STATEMENT</p>
        <p className="font-bold">{buyer.tradeName || buyer.legalName}</p>
        {buyer.tradeName && <p>{buyer.legalName}</p>}
        {buyer.gstin && <p>GSTIN: {buyer.gstin}</p>}
        <p>
          {formatDate(from)} – {formatDate(to)}
        </p>
      </div>
    </header>
  );
}
