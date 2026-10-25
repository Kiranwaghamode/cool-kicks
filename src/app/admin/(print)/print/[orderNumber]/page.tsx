import { notFound } from "next/navigation";
import { AutoPrint } from "./auto-print";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { formatDateTime } from "@/lib/order-format";
import { ICE_LABELS, PAYMENT_METHOD_LABELS, SIZE_LABELS, SUGAR_LABELS } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/order-status";

/** Kitchen order ticket (KOT) – sized for 80 mm thermal printers, works on A4 too. */
export default async function PrintSlipPage({ params }: PageProps<"/admin/print/[orderNumber]">) {
  await requireRole("orders");
  const { orderNumber } = await params;
  const o = await db.order.findUnique({ where: { orderNumber: decodeURIComponent(orderNumber).toUpperCase() }, include: { items: { orderBy: { id: "asc" } } } });
  if (!o) notFound();
  const address = [o.addressLine1, o.addressLine2, o.landmark, o.area, o.pincode].filter(Boolean).join(", ");

  return (
    <div className="p-4 font-mono text-[13px] leading-snug">
      <style>{`@page { size: 80mm auto; margin: 4mm; } @media print { body { background: #fff; } }`}</style>
      <AutoPrint />
      <div className="mx-auto max-w-[80mm]">
        <div className="text-center">
          <p className="text-lg font-bold">COOL KICK</p>
          <p className="text-xs">Fresh &amp; Chilled</p>
        </div>
        <hr className="my-2 border-dashed border-black" />
        <p className="text-center text-2xl font-bold">{o.orderNumber}</p>
        <p className="text-center text-sm font-bold uppercase">{o.fulfilment === "PICKUP" ? "*** PICKUP ***" : "*** DELIVERY ***"}</p>
        <p className="mt-1 text-center text-xs">{formatDateTime(o.createdAt)} · {STATUS_LABELS[o.status]}</p>
        <hr className="my-2 border-dashed border-black" />
        <p className="font-bold">{o.customerName}</p>
        <p>+91 {o.customerPhone}</p>
        {o.fulfilment === "DELIVERY" && <p className="mt-1">{address}</p>}
        <hr className="my-2 border-dashed border-black" />
        <table className="w-full">
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="w-8 py-1 text-lg font-bold">{i.quantity}×</td>
                <td className="py-1">
                  <p className="font-bold">{i.productName}</p>
                  <p>
                    {SIZE_LABELS[i.size]} · {SUGAR_LABELS[i.sugarLevel]} · {ICE_LABELS[i.iceLevel]}
                  </p>
                  {i.instructions && <p className="font-bold">» {i.instructions}</p>}
                </td>
                <td className="py-1 text-right">{formatPaise(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {o.notes && (
          <>
            <hr className="my-2 border-dashed border-black" />
            <p className="font-bold">NOTE: {o.notes}</p>
          </>
        )}
        <hr className="my-2 border-dashed border-black" />
        <div className="space-y-0.5">
          <p className="flex justify-between"><span>Subtotal</span><span>{formatPaise(o.subtotal)}</span></p>
          {o.discount > 0 && <p className="flex justify-between"><span>Discount {o.couponCode ? `(${o.couponCode})` : ""}</span><span>-{formatPaise(o.discount)}</span></p>}
          {o.fulfilment === "DELIVERY" && <p className="flex justify-between"><span>Delivery</span><span>{formatPaise(o.deliveryFee)}</span></p>}
          <p className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{formatPaise(o.total)}</span></p>
        </div>
        <p className="mt-2 text-center font-bold">
          {PAYMENT_METHOD_LABELS[o.paymentMethod]} · {o.paymentStatus === "PAID" ? "PAID" : "TO COLLECT"}
        </p>
        <hr className="my-2 border-dashed border-black" />
        <p className="text-center text-xs">Thank you! Stay cool 🍹</p>
      </div>
    </div>
  );
}
