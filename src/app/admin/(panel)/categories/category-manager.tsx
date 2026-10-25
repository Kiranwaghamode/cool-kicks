"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { Panel } from "@/components/admin/ui";
import { ImageUpload } from "@/components/admin/image-upload";
import { reorderCategories, saveCategory, setCategoryActive } from "@/server/actions/admin/catalog";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Cat = { id: string; name: string; slug: string; description: string; image: string; isActive: boolean; productCount: number };
type Draft = Omit<Cat, "productCount" | "id"> & { id?: string };

const EMPTY: Draft = { name: "", slug: "", description: "", image: "", isActive: true };

export function CategoryManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [list, setList] = useState(categories);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
    start(async () => {
      const res = await reorderCategories(next.map((c) => c.id));
      if (!res.ok) {
        toast.error("Order not saved", res.error);
        setList(list);
      }
    });
  }

  return (
    <Panel
      action={
        <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="size-4" aria-hidden /> Add category
        </Button>
      }
      title={`${list.length} categories`}
    >
      <ol className="space-y-2">
        {list.map((c, i) => (
          <li key={c.id} className={cn("flex items-center gap-3 rounded-2xl border border-line p-3", !c.isActive && "opacity-60")}>
            <div className="flex flex-col">
              <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0 || pending} onClick={() => move(i, -1)} className="rounded-lg p-1 hover:bg-cream disabled:opacity-30">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" aria-label={`Move ${c.name} down`} disabled={i === list.length - 1 || pending} onClick={() => move(i, 1)} className="rounded-lg p-1 hover:bg-cream disabled:opacity-30">
                <ArrowDown className="size-4" />
              </button>
            </div>
            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-cream">{c.image && <Image src={c.image} alt="" fill sizes="48px" className="object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-ink-muted">
                /menu/{c.slug} · {c.productCount} product{c.productCount === 1 ? "" : "s"}
              </p>
            </div>
            <Switch
              checked={c.isActive}
              label={`${c.name} visible`}
              onChange={(v) => {
                setList((l) => l.map((x) => (x.id === c.id ? { ...x, isActive: v } : x)));
                start(async () => {
                  const res = await setCategoryActive(c.id, v);
                  if (res.ok) toast.success(res.message ?? "Saved");
                  else {
                    setList((l) => l.map((x) => (x.id === c.id ? { ...x, isActive: !v } : x)));
                    toast.error("Not saved", res.error);
                  }
                });
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => setDraft({ id: c.id, name: c.name, slug: c.slug, description: c.description, image: c.image, isActive: c.isActive })}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Button>
          </li>
        ))}
      </ol>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit category" : "Add category"}>
        {draft && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await saveCategory(draft);
                if (res.ok) {
                  toast.success(res.message ?? "Saved");
                  setDraft(null);
                  setErrors({});
                  router.refresh();
                } else {
                  setErrors(res.fieldErrors ?? {});
                  toast.error("Not saved", res.error);
                }
              });
            }}
          >
            <Field label="Name" htmlFor="c-name" error={errors.name} required>
              <Input id="c-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.id ? draft.slug : slugify(e.target.value) })} />
            </Field>
            <Field label="Slug" htmlFor="c-slug" error={errors.slug} hint={`/menu/${draft.slug || "…"}`} required>
              <Input id="c-slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
            </Field>
            <Field label="Description" htmlFor="c-desc">
              <Textarea id="c-desc" value={draft.description} maxLength={300} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <ImageUpload value={draft.image} onChange={(url) => setDraft({ ...draft, image: url })} folder="categories" label="Category image" />
            <label className="flex items-center justify-between font-semibold">
              Visible on the menu
              <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Visible on the menu" />
            </label>
            <Button type="submit" className="w-full" loading={pending}>
              Save category
            </Button>
          </form>
        )}
      </Modal>
    </Panel>
  );
}
