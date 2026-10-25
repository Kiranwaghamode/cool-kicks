"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Switch } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { Panel, TableWrap, td, th } from "@/components/admin/ui";
import { deleteProduct, restoreProduct, setProductAvailable } from "@/server/actions/admin/catalog";
import { formatPaise } from "@/lib/money";

type Row = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  categoryId: string;
  categoryName: string;
  isAvailable: boolean;
  isActive: boolean;
  minPrice: number;
  maxPrice: number;
};

export function ProductTable({ products, categories }: { products: Row[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [avail, setAvail] = useState<"" | "available" | "unavailable" | "deleted">("");
  const [rows, setRows] = useState(products);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!term || r.name.toLowerCase().includes(term) || r.slug.includes(term)) &&
        (!cat || r.categoryId === cat) &&
        (avail === "deleted" ? !r.isActive : r.isActive) &&
        (avail === "available" ? r.isAvailable : avail === "unavailable" ? !r.isAvailable : true),
    );
  }, [rows, q, cat, avail]);

  function toggle(r: Row, next: boolean) {
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, isAvailable: next } : x)));
    start(async () => {
      const res = await setProductAvailable(r.id, next);
      if (!res.ok) {
        setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, isAvailable: !next } : x)));
        toast.error("Not saved", res.error);
      } else toast.success(`${r.name}: ${res.message}`);
    });
  }

  return (
    <Panel>
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <label htmlFor="p-search" className="sr-only">
            Search products
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id="p-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className="h-11 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </div>
        <label className="sr-only" htmlFor="p-cat">
          Category
        </label>
        <select id="p-cat" value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="p-avail">
          Availability
        </label>
        <select id="p-avail" value={avail} onChange={(e) => setAvail(e.target.value as typeof avail)} className="h-11 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold">
          <option value="">All on menu</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
          <option value="deleted">Removed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No products found" description="Try a different search or filter." action={<LinkButton href="/admin/products/new">Add product</LinkButton>} />
      ) : (
        <TableWrap>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Product</th>
                <th className={th}>Category</th>
                <th className={th}>Price</th>
                <th className={th}>Available</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-cream">
                        {r.image && <Image src={r.image} alt="" fill sizes="48px" className="object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/admin/products/${r.id}`} className="font-semibold hover:text-brand-deep">
                          {r.name}
                        </Link>
                        <span className="block text-xs text-ink-muted">/{r.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} text-ink-soft`}>{r.categoryName}</td>
                  <td className={`${td} font-semibold whitespace-nowrap tabular-nums`}>
                    {r.minPrice === r.maxPrice ? formatPaise(r.minPrice) : `${formatPaise(r.minPrice)} – ${formatPaise(r.maxPrice)}`}
                  </td>
                  <td className={td}>
                    {r.isActive ? (
                      <Switch checked={r.isAvailable} onChange={(v) => toggle(r, v)} label={`${r.name} available`} />
                    ) : (
                      <Badge tone="neutral">Removed</Badge>
                    )}
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {r.isActive ? (
                      <>
                        <LinkButton href={`/admin/products/${r.id}`} size="sm" variant="ghost" aria-label={`Edit ${r.name}`}>
                          <Pencil className="size-4" aria-hidden /> Edit
                        </LinkButton>
                        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirm(r)} aria-label={`Delete ${r.name}`}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await restoreProduct(r.id);
                            if (res.ok) {
                              setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, isActive: true, isAvailable: false } : x)));
                              toast.success(res.message ?? "Restored");
                            } else toast.error("Not restored", res.error);
                          })
                        }
                      >
                        <RotateCcw className="size-4" aria-hidden /> Restore
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Remove product?"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={pending}
              onClick={() => {
                const r = confirm;
                if (!r) return;
                start(async () => {
                  const res = await deleteProduct(r.id);
                  if (res.ok) {
                    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, isActive: false, isAvailable: false } : x)));
                    toast.success(res.message ?? "Removed");
                    setConfirm(null);
                    router.refresh();
                  } else toast.error("Not removed", res.error);
                });
              }}
            >
              Remove
            </Button>
          </div>
        }
      >
        <p className="text-ink-soft">
          <strong className="text-ink">{confirm?.name}</strong> will disappear from the menu. Past orders keep their details, and you can restore it later from the “Removed” filter.
        </p>
      </Modal>
    </Panel>
  );
}
