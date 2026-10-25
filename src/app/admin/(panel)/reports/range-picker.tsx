"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type Range = "today" | "week" | "month" | "custom";

export function RangePicker({ range, from, to }: { range: Range; from: string; to: string }) {
  const router = useRouter();
  const [custom, setCustom] = useState(range === "custom");
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Tabs
        label="Date range"
        value={custom ? "custom" : range}
        onChange={(v: Range) => {
          if (v === "custom") return setCustom(true);
          setCustom(false);
          router.push(`/admin/reports?range=${v}`);
        }}
        items={[
          { value: "today", label: "Today" },
          { value: "week", label: "This week" },
          { value: "month", label: "This month" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {custom && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/admin/reports?range=custom&from=${f}&to=${t}`);
          }}
        >
          <label className="text-xs font-semibold text-ink-soft">
            From
            <Input type="date" value={f} onChange={(e) => setF(e.target.value)} className="mt-1 h-10" required />
          </label>
          <label className="text-xs font-semibold text-ink-soft">
            To
            <Input type="date" value={t} onChange={(e) => setT(e.target.value)} className="mt-1 h-10" required />
          </label>
          <Button type="submit" variant="dark">
            Show
          </Button>
        </form>
      )}
    </div>
  );
}
