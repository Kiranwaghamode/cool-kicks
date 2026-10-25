import type { Metadata } from "next";
import { TrackView } from "./track-view";
import { getShopSettings } from "@/server/settings";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Track your Cool Kick order with your order number and phone number.",
};

export default async function TrackPage({ searchParams }: PageProps<"/track">) {
  const sp = await searchParams;
  const order = typeof sp.order === "string" ? sp.order.toUpperCase().slice(0, 12) : "";
  const settings = await getShopSettings();
  return <TrackView initialOrderNumber={order} whatsappNumber={settings.whatsappNumber} prepMins={settings.estimatedPrepMins} />;
}
