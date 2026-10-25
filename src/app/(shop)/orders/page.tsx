import type { Metadata } from "next";
import { MyOrdersView } from "./my-orders-view";

export const metadata: Metadata = { title: "My Orders", robots: { index: false } };

export default function MyOrdersPage() {
  return <MyOrdersView />;
}
