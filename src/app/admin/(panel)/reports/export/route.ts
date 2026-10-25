import ExcelJS from "exceljs";
import { getStaff } from "@/server/auth-guard";
import { can } from "@/lib/permissions";
import { getSalesReport, resolveRange } from "@/server/admin/reports";
import { addDays, istDateKey } from "@/lib/dates";
import { formatDateTime } from "@/lib/order-format";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/order-status";

export const dynamic = "force-dynamic";

const rs = (paise: number) => Math.round(paise) / 100;

function csvCell(v: unknown) {
  const s = String(v ?? "");
  // Escape quotes and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !can(staff.role, "reports")) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const { from, to } = resolveRange("custom", url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const r = await getSalesReport(from, to);
  const label = `${istDateKey(from)}_to_${istDateKey(addDays(to, -1))}`;

  const summary: [string, string | number][] = [
    ["Period", `${istDateKey(from)} to ${istDateKey(addDays(to, -1))} (Asia/Kolkata)`],
    ["Note", "Revenue figures, not profit. Cancelled/rejected orders excluded."],
    ["Gross sales (₹)", rs(r.gross)],
    ["Discounts (₹)", rs(r.discounts)],
    ["Refunds (₹)", rs(r.refunds)],
    ["Net sales (₹)", rs(r.net)],
    ["Total orders", r.orderCount],
    ["Cancelled / rejected orders", r.cancelledCount],
    ["Average order value (₹)", rs(r.avgOrderValue)],
    ["Expenses (₹)", rs(r.expenseTotal)],
    ["Estimated balance – not accounting profit (₹)", rs(r.estimatedBalance)],
  ];
  const orderHeader = ["Order", "Date", "Customer", "Type", "Status", "Payment method", "Payment status", "Coupon", "Subtotal (₹)", "Discount (₹)", "Delivery (₹)", "Total (₹)"];
  const orderRows = r.orders.map((o) => [
    o.orderNumber,
    formatDateTime(o.createdAt),
    o.customerName,
    o.fulfilment === "PICKUP" ? "Pickup" : "Delivery",
    STATUS_LABELS[o.status],
    PAYMENT_METHOD_LABELS[o.paymentMethod],
    PAYMENT_STATUS_LABELS[o.paymentStatus],
    o.couponCode ?? "",
    rs(o.subtotal),
    rs(o.discount),
    rs(o.deliveryFee),
    rs(o.total),
  ]);

  if (format === "csv") {
    const lines = [
      ...summary.map((row) => row.map(csvCell).join(",")),
      "",
      orderHeader.map(csvCell).join(","),
      ...orderRows.map((row) => row.map(csvCell).join(",")),
      "",
      ["Product", "Quantity", "Revenue (₹)"].join(","),
      ...r.bestSellers.map((b) => [b.name, b.quantity, rs(b.revenue)].map(csvCell).join(",")),
    ];
    return new Response("\uFEFF" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="coolkick-sales_${label}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Cool Kick";
  const s1 = wb.addWorksheet("Summary");
  s1.columns = [{ width: 48 }, { width: 40 }];
  summary.forEach((row) => s1.addRow(row));
  s1.getColumn(1).font = { bold: true };

  const s2 = wb.addWorksheet("Orders");
  s2.addRow(orderHeader).font = { bold: true };
  orderRows.forEach((row) => s2.addRow(row));
  s2.columns.forEach((c) => (c.width = 16));

  const s3 = wb.addWorksheet("Products");
  s3.addRow(["Product", "Quantity", "Revenue (₹)"]).font = { bold: true };
  r.bestSellers.forEach((b) => s3.addRow([b.name, b.quantity, rs(b.revenue)]));
  s3.columns.forEach((c) => (c.width = 24));

  const s4 = wb.addWorksheet("Expenses");
  s4.addRow(["Date", "Expense", "Category", "Amount (₹)"]).font = { bold: true };
  r.expenses.forEach((e) => s4.addRow([istDateKey(new Date(e.date)), e.title, e.category, rs(e.amount)]));
  s4.columns.forEach((c) => (c.width = 22));

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="coolkick-sales_${label}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
