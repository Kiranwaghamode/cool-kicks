"use client";

import { useState, type ReactNode } from "react";
import { GlassWater, ShoppingBag } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge, Eyebrow } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Chip, Tag } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { BottomSheet, Drawer, Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Logo } from "@/components/ui/logo";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-headline-sm font-bold">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

const swatches = [
  ["brand", "bg-brand"],
  ["brand-dark", "bg-brand-dark"],
  ["brand-deep", "bg-brand-deep"],
  ["brand-soft", "bg-brand-soft"],
  ["mango", "bg-mango"],
  ["tangerine", "bg-tangerine"],
  ["mango-soft", "bg-mango-soft"],
  ["melon", "bg-melon"],
  ["melon-soft", "bg-melon-soft"],
  ["ice", "bg-ice"],
  ["ice-deep", "bg-ice-deep"],
  ["cream", "bg-cream"],
  ["cream-50", "bg-cream-50"],
  ["ink", "bg-ink"],
  ["ink-soft", "bg-ink-soft"],
  ["danger", "bg-danger"],
];

export function UiShowcase() {
  const [size, setSize] = useState<"SMALL" | "MEDIUM" | "LARGE">("MEDIUM");
  const [sugar, setSugar] = useState<"NONE" | "LESS" | "REGULAR" | "EXTRA">("REGULAR");
  const [qty, setQty] = useState(1);
  const [chip, setChip] = useState("all");
  const [tab, setTab] = useState<"active" | "past" | "cancelled">("active");
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [on, setOn] = useState(true);

  return (
    <main className="container-page space-y-12 py-10">
      <header className="space-y-3">
        <Logo />
        <h1 className="text-headline font-extrabold">Cool Kick UI kit</h1>
        <p className="text-ink-soft">
          Every component and state, built from the Stitch Mobile-Home / Desktop-Home design.
        </p>
      </header>

      <Section title="Colours">
        {swatches.map(([name, cls]) => (
          <div key={name} className="w-28">
            <div className={`h-16 rounded-2xl border border-line ${cls}`} />
            <p className="mt-1 text-xs font-semibold">{name}</p>
          </div>
        ))}
      </Section>

      <Section title="Typography">
        <div className="w-full space-y-2">
          <p className="text-display-sm font-extrabold md:text-display">There&apos;s a chilled juice</p>
          <p className="text-headline font-bold">The Most Popular Juices</p>
          <p className="text-headline-sm font-bold">Juice Categories</p>
          <p className="text-title font-semibold">Alphonso Mango Frost</p>
          <p className="text-lg text-ink-soft">Fresh fruit, crushed ice and zero preservatives.</p>
          <p className="text-sm text-ink-soft">Body small – descriptions and helper text.</p>
          <Eyebrow>Our menu</Eyebrow>
        </div>
      </Section>

      <Section title="Buttons">
        <Button>Order Now</Button>
        <Button variant="secondary">Customize</Button>
        <Button variant="outline">Call Us</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="dark">Claim Offer</Button>
        <Button variant="danger">Reject</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" variant="outline" aria-label="Cart">
          <ShoppingBag className="size-5" />
        </Button>
        <Button loading>Placing order</Button>
        <Button disabled>Disabled</Button>
        <LinkButton href="/" variant="outline">
          Link button
        </LinkButton>
      </Section>

      <Section title="Badges">
        <Badge>BESTSELLER</Badge>
        <Badge tone="mango">NEW</Badge>
        <Badge tone="melon">SEASONAL</Badge>
        <Badge tone="ice">Chilled</Badge>
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="success">Paid</Badge>
        <Badge tone="warning">Pending</Badge>
        <Badge tone="danger">Unavailable</Badge>
        <Badge tone="dark">Dark</Badge>
      </Section>

      <Section title="Chips & tags">
        {["all", "ice-juices", "mango", "mojitos"].map((c) => (
          <Chip key={c} active={chip === c} onClick={() => setChip(c)}>
            {c}
          </Chip>
        ))}
        <Chip active tone="ice">
          Crushed ice
        </Chip>
        <Chip disabled>Disabled</Chip>
        <Tag>Mint</Tag>
        <Tag>Lemon</Tag>
      </Section>

      <Section title="Segmented controls & stepper">
        <div className="w-full max-w-md space-y-3">
          <SegmentedControl
            label="Size"
            value={size}
            onChange={setSize}
            options={[
              { value: "SMALL", label: "Small", hint: "250 ml" },
              { value: "MEDIUM", label: "Medium", hint: "350 ml" },
              { value: "LARGE", label: "Large", hint: "500 ml", disabled: true },
            ]}
          />
          <SegmentedControl
            label="Sugar"
            size="sm"
            value={sugar}
            onChange={setSugar}
            options={[
              { value: "NONE", label: "No sugar" },
              { value: "LESS", label: "Less" },
              { value: "REGULAR", label: "Regular" },
              { value: "EXTRA", label: "Extra" },
            ]}
          />
        </div>
        <QuantityStepper value={qty} onChange={setQty} />
        <QuantityStepper value={qty} onChange={setQty} size="sm" />
      </Section>

      <Section title="Form fields">
        <div className="grid w-full gap-4 md:grid-cols-2">
          <Field label="Your name" htmlFor="name" required>
            <Input id="name" placeholder="Priya Sharma" />
          </Field>
          <Field label="Mobile number" htmlFor="phone" error="Enter a valid 10-digit mobile number">
            <Input id="phone" aria-invalid="true" defaultValue="98765" />
          </Field>
          <Field label="Area" htmlFor="area" hint="We deliver within 7 km">
            <Select id="area" defaultValue="">
              <option value="" disabled>
                Choose an area
              </option>
              <option>Shivajinagar</option>
              <option>Deccan</option>
            </Select>
          </Field>
          <Field label="Disabled" htmlFor="dis">
            <Input id="dis" disabled placeholder="Not editable" />
          </Field>
          <Field label="Special instructions" htmlFor="notes" className="md:col-span-2">
            <Textarea id="notes" placeholder="Less ice, no straw…" />
          </Field>
          <label className="flex items-center gap-3 text-sm font-medium">
            <Checkbox defaultChecked /> Extra chia seeds
          </label>
          <div className="flex items-center gap-3 text-sm font-medium">
            <Switch checked={on} onChange={setOn} label="Shop open" /> Shop {on ? "open" : "closed"}
          </div>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs
          label="Orders"
          value={tab}
          onChange={setTab}
          items={[
            { value: "active", label: "Active", count: 2 },
            { value: "past", label: "Past", count: 14 },
            { value: "cancelled", label: "Cancelled", count: 1 },
          ]}
        />
      </Section>

      <Section title="Cards">
        <Card className="w-72">
          <CardHeader>
            <CardTitle>Fresh Fruit Daily</CardTitle>
            <Badge tone="success">Fresh</Badge>
          </CardHeader>
          <CardContent className="text-sm text-ink-soft">
            Sourced from local orchards every morning.
          </CardContent>
        </Card>
      </Section>

      <Section title="Overlays & toasts">
        <Button variant="outline" onClick={() => setModal(true)}>
          Open modal
        </Button>
        <Button variant="outline" onClick={() => setSheet(true)}>
          Open bottom sheet
        </Button>
        <Button variant="outline" onClick={() => setDrawer(true)}>
          Open drawer
        </Button>
        <Button variant="secondary" onClick={() => toast.success("Added to cart", "Mango Mastani · Medium")}>
          Success toast
        </Button>
        <Button variant="secondary" onClick={() => toast.error("Couldn't place order", "Please try again")}>
          Error toast
        </Button>
        <Button variant="secondary" onClick={() => toast.info("Shop opens at 10:00 AM")}>
          Info toast
        </Button>
      </Section>

      <Section title="Skeleton & empty state">
        <div className="w-60 space-y-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Card className="w-full max-w-md">
          <EmptyState
            icon={<GlassWater />}
            title="Your cart is empty"
            description="Add a chilled drink or two to get started."
            action={<Button>Browse menu</Button>}
          />
        </Card>
      </Section>

      <Modal open={modal} onClose={() => setModal(false)} title="Confirm order" footer={<Button className="w-full" onClick={() => setModal(false)}>Place order</Button>}>
        <p className="text-ink-soft">Bottom sheet on phones, centred dialog on larger screens.</p>
      </Modal>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Customise drink">
        <p className="text-ink-soft">Bottom sheet content.</p>
      </BottomSheet>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Order CK-20001">
        <p className="text-ink-soft">Drawer content.</p>
      </Drawer>
    </main>
  );
}
