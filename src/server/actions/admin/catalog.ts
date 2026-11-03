"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";
import { saveImage, UploadError } from "@/server/storage";
import { slugify } from "@/lib/utils";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";

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
      const removed = await tx.productVariant.findMany({
        where: { productId: product.id, size: { notIn: sizes } },
        select: { id: true, _count: { select: { batches: true, quotationItems: true } } },
      });
      for (const r of removed) {
        if (r._count.batches || r._count.quotationItems) {
          await tx.productVariant.update({ where: { id: r.id }, data: { isAvailable: false, wholesaleEnabled: false } });
        } else {
          await tx.productVariant.delete({ where: { id: r.id } });
        }
      }
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

// ───────────────────────── Wholesale settings per product ─────────────────────────

const tierSchema = z.object({
  minQuantity: z.number().int().min(2, "Tier quantity must be at least 2").max(1_000_000),
  discountBps: z.number().int().min(1, "Discount must be above 0%").max(9000, "Discount can't exceed 90%"),
});

const wholesaleSchema = z.object({
  productId: z.string().min(1),
  gstRateBps: z.union([z.literal(0), z.literal(500), z.literal(1200), z.literal(1800), z.literal(2800)]),
  hsnCode: z
    .string()
    .trim()
    .regex(/^(\d{4}|\d{6}|\d{8})?$/, "HSN codes are 4, 6 or 8 digits")
    .optional()
    .default(""),
  variants: z
    .array(
      z
        .object({
          variantId: z.string().min(1),
          wholesaleEnabled: z.boolean(),
          wholesalePrice: z.number().int().min(1, "Enter a wholesale price").max(100_000_000).nullable(),
          moq: z.number().int().min(1, "MOQ must be at least 1").max(1_000_000),
          packSize: z.number().int().min(1, "Pack size must be at least 1").max(10_000),
          packaging: z.string().trim().max(60).optional().default(""),
          tiers: z
            .array(tierSchema)
            .max(6)
            .refine((t) => new Set(t.map((x) => x.minQuantity)).size === t.length, "Each tier needs a different quantity")
            .default([]),
        })
        .superRefine((v, ctx) => {
          if (v.wholesaleEnabled && v.wholesalePrice === null) ctx.addIssue({ code: "custom", path: ["wholesalePrice"], message: "Enter a wholesale price" });
          if (v.moq % v.packSize !== 0) ctx.addIssue({ code: "custom", path: ["moq"], message: "MOQ must be a whole number of packs" });
        }),
    )
    .max(3),
});

export type ProductWholesaleInput = z.input<typeof wholesaleSchema>;

export async function saveProductWholesale(input: ProductWholesaleInput) {
  return adminAction("products", async (staff) => {
    const parsed = wholesaleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please fix the form", fieldErrors: fieldErrors(parsed.error) };
    const w = parsed.data;
    const product = await db.product.findUnique({ where: { id: w.productId }, select: { name: true, variants: { select: { id: true } } } });
    if (!product) return { ok: false, error: "Product not found" };
    const own = new Set(product.variants.map((v) => v.id));
    if (w.variants.some((v) => !own.has(v.variantId))) return { ok: false, error: "Invalid size" };

    await db.$transaction(async (tx) => {
      await tx.product.update({ where: { id: w.productId }, data: { gstRateBps: w.gstRateBps, hsnCode: w.hsnCode || null } });
      for (const v of w.variants) {
        await tx.productVariant.update({
          where: { id: v.variantId },
          data: { wholesaleEnabled: v.wholesaleEnabled, wholesalePrice: v.wholesalePrice, moq: v.moq, packSize: v.packSize, packaging: v.packaging || null },
        });
        await tx.volumePriceTier.deleteMany({ where: { variantId: v.variantId } });
        if (v.tiers.length) await tx.volumePriceTier.createMany({ data: v.tiers.map((t) => ({ variantId: v.variantId, ...t })) });
      }
      await audit({ staffId: staff.id }, { action: "product.wholesale", entityType: "Product", entityId: w.productId, summary: `Updated wholesale pricing for ${product.name}` }, tx);
    });
    revalidatePath(`/admin/products/${w.productId}`);
    revalidatePath("/business", "layout");
    return { ok: true, message: "Wholesale settings saved" };
  });
}
