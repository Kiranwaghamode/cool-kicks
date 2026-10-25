"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { Panel } from "@/components/admin/ui";
import { ImageUpload } from "@/components/admin/image-upload";
import { saveProduct, type ProductInput } from "@/server/actions/admin/catalog";
import { paiseToRupees, rupeesToPaise } from "@/lib/money";
import { slugify } from "@/lib/utils";
import { SIZE_LABELS, TAG_LABELS, type ProductTag, type Size } from "@/lib/types";

type Variant = { size: Size; volumeMl: number; price: number; isAvailable: boolean };
type Initial = Omit<Required<ProductInput>, "variants" | "recipe" | "tags"> & {
  variants: Variant[];
  recipe: { ingredientId: string; quantityPerUnit: number }[];
  tags: ProductTag[];
};

const DEFAULT_VOLUME: Record<Size, number> = { SMALL: 250, MEDIUM: 350, LARGE: 500 };
const UNIT_LABEL = { KG: "kg", LITRE: "litre", PIECE: "pcs", GRAM: "g", ML: "ml" } as const;

export function ProductForm({
  initial,
  categories,
  ingredients,
}: {
  initial: Initial | null;
  categories: { id: string; name: string }[];
  ingredients: { id: string; name: string; unit: keyof typeof UNIT_LABEL }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [ingredientInput, setIngredientInput] = useState("");

  const [form, setForm] = useState(() => ({
    id: initial?.id,
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    categoryId: initial?.categoryId ?? categories[0]?.id ?? "",
    description: initial?.description ?? "",
    image: initial?.image ?? "",
    ingredients: initial?.ingredients ?? [],
    tags: initial?.tags ?? ([] as ProductTag[]),
    allowSugarChoice: initial?.allowSugarChoice ?? true,
    allowIceChoice: initial?.allowIceChoice ?? true,
    isAvailable: initial?.isAvailable ?? true,
    sortOrder: initial?.sortOrder ?? 0,
  }));
  // Prices are edited in rupees and converted to paise on save.
  const [sizes, setSizes] = useState(() =>
    (["SMALL", "MEDIUM", "LARGE"] as Size[]).map((size) => {
      const v = initial?.variants.find((x) => x.size === size);
      return {
        size,
        enabled: initial ? !!v : true,
        volumeMl: String(v?.volumeMl ?? DEFAULT_VOLUME[size]),
        price: v ? String(paiseToRupees(v.price)) : "",
        isAvailable: v?.isAvailable ?? true,
      };
    }),
  );
  const [recipe, setRecipe] = useState(() =>
    (initial?.recipe ?? []).map((r) => ({ ingredientId: r.ingredientId, qty: String(r.quantityPerUnit) })),
  );

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function addIngredientChip() {
    const v = ingredientInput.trim();
    if (v && !form.ingredients.includes(v)) set("ingredients", [...form.ingredients, v]);
    setIngredientInput("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const localErrors: Record<string, string> = {};
    const variants: Variant[] = [];
    sizes.forEach((s) => {
      if (!s.enabled) return;
      const price = Number(s.price);
      if (!s.price || !Number.isFinite(price) || price <= 0) localErrors[`size-${s.size}`] = "Enter a price";
      else variants.push({ size: s.size, volumeMl: Number(s.volumeMl) || DEFAULT_VOLUME[s.size], price: rupeesToPaise(price), isAvailable: s.isAvailable });
    });
    if (!sizes.some((s) => s.enabled)) localErrors.variants = "Enable at least one size";
    const recipeRows = recipe
      .filter((r) => r.ingredientId)
      .map((r) => ({ ingredientId: r.ingredientId, quantityPerUnit: Number(r.qty) }))
      .filter((r) => r.quantityPerUnit > 0);
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    start(async () => {
      const res = await saveProduct({ ...form, variants, recipe: recipeRows });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setErrors({});
        if (!form.id && res.data) router.replace(`/admin/products/${res.data.id}`);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error("Not saved", res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <Panel title="Details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" htmlFor="pf-name" error={errors.name} required>
              <Input
                id="pf-name"
                value={form.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!slugTouched) set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field label="URL slug" htmlFor="pf-slug" error={errors.slug} hint={`/product/${form.slug || "…"}`} required>
              <Input
                id="pf-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
              />
            </Field>
            <Field label="Category" htmlFor="pf-cat" error={errors.categoryId} required>
              <Select id="pf-cat" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sort order" htmlFor="pf-sort" hint="Lower numbers show first">
              <Input id="pf-sort" type="number" min={0} value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
            </Field>
            <Field label="Description" htmlFor="pf-desc" error={errors.description} className="md:col-span-2">
              <Textarea id="pf-desc" value={form.description} maxLength={500} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <label htmlFor="pf-ing" className="mb-1.5 block pl-1 text-sm font-semibold">
                Ingredients (shown to customers)
              </label>
              <div className="flex gap-2">
                <Input
                  id="pf-ing"
                  value={ingredientInput}
                  onChange={(e) => setIngredientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addIngredientChip();
                    }
                  }}
                  placeholder="Type and press Enter"
                />
                <Button type="button" variant="outline" onClick={addIngredientChip}>
                  Add
                </Button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {form.ingredients.map((i) => (
                  <li key={i} className="flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-sm font-semibold">
                    {i}
                    <button type="button" aria-label={`Remove ${i}`} onClick={() => set("ingredients", form.ingredients.filter((x) => x !== i))}>
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="Sizes & prices">
          {errors.variants && <p className="mb-3 text-sm font-medium text-danger">{errors.variants}</p>}
          <div className="space-y-3">
            {sizes.map((s, i) => (
              <div key={s.size} className="grid items-end gap-3 rounded-2xl bg-cream-50 p-3 sm:grid-cols-[120px_1fr_1fr_auto]">
                <label className="flex items-center gap-2 pb-3 font-bold">
                  <Checkbox checked={s.enabled} onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} />
                  {SIZE_LABELS[s.size]}
                </label>
                <Field label="Volume (ml)" htmlFor={`vol-${s.size}`}>
                  <Input id={`vol-${s.size}`} type="number" min={50} disabled={!s.enabled} value={s.volumeMl} onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, volumeMl: e.target.value } : x)))} />
                </Field>
                <Field label="Price (₹)" htmlFor={`price-${s.size}`} error={errors[`size-${s.size}`]}>
                  <Input
                    id={`price-${s.size}`}
                    type="number"
                    min={1}
                    step="0.5"
                    inputMode="decimal"
                    disabled={!s.enabled}
                    value={s.price}
                    onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                    aria-invalid={!!errors[`size-${s.size}`] || undefined}
                  />
                </Field>
                <label className="flex items-center gap-2 pb-3 text-sm font-semibold">
                  <Switch checked={s.isAvailable} disabled={!s.enabled} onChange={(v) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, isAvailable: v } : x)))} label={`${SIZE_LABELS[s.size]} available`} />
                  In stock
                </label>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Recipe (for automatic stock deduction)"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => setRecipe((r) => [...r, { ingredientId: "", qty: "" }])}>
              <Plus className="size-4" aria-hidden /> Add ingredient
            </Button>
          }
        >
          {recipe.length === 0 ? (
            <p className="text-sm text-ink-muted">No recipe yet. Add the ingredients one drink uses so stock is deducted when orders are confirmed.</p>
          ) : (
            <ul className="space-y-2">
              {recipe.map((r, i) => {
                const unit = ingredients.find((x) => x.id === r.ingredientId)?.unit;
                return (
                  <li key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_160px_auto]">
                    <label className="sr-only" htmlFor={`rec-ing-${i}`}>
                      Ingredient
                    </label>
                    <Select id={`rec-ing-${i}`} value={r.ingredientId} onChange={(e) => setRecipe((all) => all.map((x, j) => (j === i ? { ...x, ingredientId: e.target.value } : x)))}>
                      <option value="">Choose ingredient…</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id} disabled={recipe.some((x, j) => j !== i && x.ingredientId === ing.id)}>
                          {ing.name}
                        </option>
                      ))}
                    </Select>
                    <div className="relative">
                      <label className="sr-only" htmlFor={`rec-qty-${i}`}>
                        Quantity per drink
                      </label>
                      <Input id={`rec-qty-${i}`} type="number" step="0.001" min={0} value={r.qty} onChange={(e) => setRecipe((all) => all.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="Qty" className="pr-14" />
                      <span className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-xs text-ink-muted">{unit ? UNIT_LABEL[unit] : ""}</span>
                    </div>
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove ingredient" onClick={() => setRecipe((all) => all.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <Panel title="Photo">
          <ImageUpload value={form.image} onChange={(url) => set("image", url)} label="Product photo" />
        </Panel>
        <Panel title="Options">
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 font-semibold">
              Available to order
              <Switch checked={form.isAvailable} onChange={(v) => set("isAvailable", v)} label="Available to order" />
            </label>
            <label className="flex items-center justify-between gap-3 font-semibold">
              Customer can choose sugar
              <Switch checked={form.allowSugarChoice} onChange={(v) => set("allowSugarChoice", v)} label="Allow sugar choice" />
            </label>
            <label className="flex items-center justify-between gap-3 font-semibold">
              Customer can choose ice
              <Switch checked={form.allowIceChoice} onChange={(v) => set("allowIceChoice", v)} label="Allow ice choice" />
            </label>
            <fieldset>
              <legend className="mb-2 font-semibold">Tags</legend>
              <div className="flex flex-wrap gap-3">
                {(["BESTSELLER", "NEW", "SEASONAL"] as ProductTag[]).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={form.tags.includes(t)} onChange={(e) => set("tags", e.target.checked ? [...form.tags, t] : form.tags.filter((x) => x !== t))} />
                    {TAG_LABELS[t]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Panel>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          <Save className="size-5" aria-hidden /> {form.id ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
