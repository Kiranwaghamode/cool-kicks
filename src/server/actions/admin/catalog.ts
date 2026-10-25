"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";
import { saveImage, UploadError } from "@/server/storage";
import { slugify } from "@/lib/utils";
import { Prisma } from "@/generated/prisma/client";

/** All shop pages read live data; this refreshes any cached RSC payloads. */
function refreshShop() {
  revalidatePath("/", "layout");
}

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".")] ??= i.message;
  return out;
}

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug is too short")
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

// ───────────────────────── Images ─────────────────────────

export async function uploadImage(formData: FormData) {
  return adminAction<{ url: string }>("products", async () => {
    const file = formData.get("file");
    const folder = formData.get("folder") === "categories" ? "categories" : "products";
    try {
      const url = await saveImage(file as File, folder);
      return { ok: true, data: { url } };
    } catch (e) {
      if (e instanceof UploadError) return { ok: false, error: e.message };
      throw e;
    }
  });
}

// ───────────────────────── Products ─────────────────────────

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter a name").max(80),
  slug,
  categoryId: z.string().min(1, "Choose a category"),
  description: z.string().trim().max(500).optional().default(""),
  image: z.string().trim().max(300).optional().default(""),
  ingredients: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  tags: z.array(z.enum(["BESTSELLER", "NEW", "SEASONAL"])).default([]),
  allowSugarChoice: z.boolean(),
  allowIceChoice: z.boolean(),
  isAvailable: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  variants: z
    .array(
      z.object({
        size: z.enum(["SMALL", "MEDIUM", "LARGE"]),
        volumeMl: z.number().int().min(50, "Too small").max(2000),
        price: z.number().int().min(100, "Price must be at least ₹1").max(1_000_000),
        isAvailable: z.boolean(),
      }),
    )
    .min(1, "Add at least one size")
    .refine((v) => new Set(v.map((x) => x.size)).size === v.length, "Each size can only appear once"),
  recipe: z
    .array(z.object({ ingredientId: z.string().min(1), quantityPerUnit: z.number().positive().max(100000) }))
    .max(30)
    .refine((r) => new Set(r.map((x) => x.ingredientId)).size === r.length, "Each ingredient can only appear once")
    .default([]),
});

export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: ProductInput) {
  return adminAction<{ id: string }>("products", async () => {
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const p = parsed.data;
    const clash = await db.product.findFirst({ where: { slug: p.slug, ...(p.id ? { id: { not: p.id } } : {}) }, select: { id: true } });
    if (clash) return { ok: false, error: "Another product already uses that slug.", fieldErrors: { slug: "Already in use" } };

    const data = {
      name: p.name,
      slug: p.slug,
      categoryId: p.categoryId,
      description: p.description || null,
      image: p.image || null,
      ingredients: p.ingredients,
      tags: p.tags,
      allowSugarChoice: p.allowSugarChoice,
      allowIceChoice: p.allowIceChoice,
      isAvailable: p.isAvailable,
      sortOrder: p.sortOrder,
    };

    const id = await db.$transaction(async (tx) => {
      const product = p.id
        ? await tx.product.update({ where: { id: p.id }, data })
        : await tx.product.create({ data: { ...data, isActive: true } });

      // Variants: upsert by size, remove sizes no longer offered.
      const sizes = p.variants.map((v) => v.size);
      await tx.productVariant.deleteMany({ where: { productId: product.id, size: { notIn: sizes } } });
      for (const v of p.variants) {
        await tx.productVariant.upsert({
          where: { productId_size: { productId: product.id, size: v.size } },
          create: { productId: product.id, ...v },
          update: { volumeMl: v.volumeMl, price: v.price, isAvailable: v.isAvailable },
        });
      }
      // Recipe: replace.
      await tx.productIngredient.deleteMany({ where: { productId: product.id } });
      if (p.recipe.length) {
        await tx.productIngredient.createMany({
          data: p.recipe.map((r) => ({ productId: product.id, ingredientId: r.ingredientId, quantityPerUnit: new Prisma.Decimal(r.quantityPerUnit) })),
        });
      }
      return product.id;
    });

    refreshShop();
    revalidatePath("/admin/products");
    return { ok: true, message: p.id ? "Product updated" : "Product created", data: { id } };
  });
}

export async function setProductAvailable(id: string, available: boolean) {
  return adminAction("products", async () => {
    await db.product.update({ where: { id }, data: { isAvailable: available } });
    refreshShop();
    revalidatePath("/admin/products");
    return { ok: true, message: available ? "Marked available" : "Marked unavailable" };
  });
}

/** Soft delete – past orders keep working. */
export async function deleteProduct(id: string) {
  return adminAction("products", async () => {
    await db.product.update({ where: { id }, data: { isActive: false, isAvailable: false } });
    refreshShop();
    revalidatePath("/admin/products");
    return { ok: true, message: "Product removed from the menu" };
  });
}

export async function restoreProduct(id: string) {
  return adminAction("products", async () => {
    await db.product.update({ where: { id }, data: { isActive: true } });
    refreshShop();
    revalidatePath("/admin/products");
    return { ok: true, message: "Product restored (still marked unavailable)" };
  });
}

// ───────────────────────── Categories ─────────────────────────

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter a name").max(60),
  slug,
  description: z.string().trim().max(300).optional().default(""),
  image: z.string().trim().max(300).optional().default(""),
  isActive: z.boolean(),
});

export type CategoryInput = z.input<typeof categorySchema>;

export async function saveCategory(input: CategoryInput) {
  return adminAction("categories", async () => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const c = parsed.data;
    const clash = await db.category.findFirst({ where: { slug: c.slug, ...(c.id ? { id: { not: c.id } } : {}) }, select: { id: true } });
    if (clash) return { ok: false, error: "Another category already uses that slug.", fieldErrors: { slug: "Already in use" } };
    const data = { name: c.name, slug: c.slug, description: c.description || null, image: c.image || null, isActive: c.isActive };
    if (c.id) await db.category.update({ where: { id: c.id }, data });
    else {
      const max = await db.category.aggregate({ _max: { sortOrder: true } });
      await db.category.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    }
    refreshShop();
    revalidatePath("/admin/categories");
    return { ok: true, message: c.id ? "Category updated" : "Category added" };
  });
}

export async function setCategoryActive(id: string, active: boolean) {
  return adminAction("categories", async () => {
    await db.category.update({ where: { id }, data: { isActive: active } });
    refreshShop();
    revalidatePath("/admin/categories");
    return { ok: true, message: active ? "Category visible on the menu" : "Category hidden from the menu" };
  });
}

/** Save a new category order (array of ids, top first). */
export async function reorderCategories(ids: string[]) {
  return adminAction("categories", async () => {
    const parsed = z.array(z.string().min(1)).max(200).safeParse(ids);
    if (!parsed.success) return { ok: false, error: "Invalid order" };
    await db.$transaction(parsed.data.map((id, i) => db.category.update({ where: { id }, data: { sortOrder: i } })));
    refreshShop();
    revalidatePath("/admin/categories");
    return { ok: true, message: "Order saved" };
  });
}

export async function suggestSlug(name: string) {
  return slugify(name);
}
