import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { categories, ingredients, reviews } from "./seed-data";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const rupees = (r: number) => Math.round(r * 100);

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const VOLUMES = { SMALL: 250, MEDIUM: 350, LARGE: 500 } as const;

async function main() {
  console.log("Seeding Cool Kick…");

  // ── Shop settings (dummy contact details – update from /admin/settings) ──
  const openingHours = Object.fromEntries(
    DAYS.map((d) => [d, { open: "10:00", close: "23:00", closed: false }]),
  );
  await db.shopSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName: "Cool Kick",
      tagline: "Chilled juices, made fresh.",
      phone: process.env.NEXT_PUBLIC_SHOP_PHONE ?? "+919876543210",
      whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919876543210",
      email: "hello@coolkick.in",
      address: "Shop No. 12, Sunshine Arcade, FC Road, Shivajinagar, Pune, Maharashtra 411005",
      mapEmbedUrl:
        "https://www.google.com/maps?q=FC+Road+Shivajinagar+Pune&output=embed",
      mapLink: "https://maps.google.com/?q=FC+Road+Shivajinagar+Pune",
      openingHours,
      minOrderAmount: rupees(99),
      estimatedPrepMins: 20,
      instagramUrl: "https://instagram.com/",
      facebookUrl: "https://facebook.com/",
    },
  });

  // ── Ingredients ──
  const ingredientIds = new Map<string, string>();
  for (const ing of ingredients) {
    const row = await db.ingredient.upsert({
      where: { name: ing.name },
      update: {},
      create: {
        name: ing.name,
        unit: ing.unit,
        currentStock: ing.stock,
        lowStockThreshold: ing.low,
      },
    });
    ingredientIds.set(ing.name, row.id);
  }

  // ── Categories, products, variants, recipes ──
  const productIdsBySlug = new Map<string, string>();
  for (const [ci, cat] of categories.entries()) {
    const category = await db.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        image: `/images/categories/${cat.slug}.webp`,
        sortOrder: ci,
      },
    });

    for (const [pi, p] of cat.products.entries()) {
      const slug = slugify(p.name);
      const existing = await db.product.findUnique({ where: { slug } });
      if (existing) {
        productIdsBySlug.set(slug, existing.id);
        continue;
      }
      const sizes = ["SMALL", "MEDIUM", "LARGE"] as const;
      const product = await db.product.create({
        data: {
          name: p.name,
          slug,
          description: p.description,
          image: `/images/products/${slug}.webp`,
          categoryId: category.id,
          ingredients: p.ingredients,
          tags: p.tags ?? [],
          sortOrder: pi,
          allowSugarChoice: p.sugar ?? true,
          allowIceChoice: p.ice ?? true,
          variants: {
            create: sizes.map((size, i) => ({
              size,
              volumeMl: VOLUMES[size],
              price: rupees(p.prices[i]),
            })),
          },
          recipe: {
            create: Object.entries(p.recipe ?? {}).map(([name, qty]) => {
              const ingredientId = ingredientIds.get(name);
              if (!ingredientId) throw new Error(`Unknown recipe ingredient "${name}" in ${p.name}`);
              return { ingredientId, quantityPerUnit: qty };
            }),
          },
        },
      });
      productIdsBySlug.set(slug, product.id);
    }
  }

  // ── Delivery zones ──
  if ((await db.deliveryZone.count()) === 0) {
    await db.deliveryZone.createMany({
      data: [
        {
          name: "Nearby (within 3 km)",
          pincodes: ["411004", "411005", "411016"],
          deliveryFee: rupees(20),
          freeDeliveryAbove: rupees(299),
        },
        {
          name: "City (3–7 km)",
          pincodes: ["411001", "411007", "411030", "411038"],
          deliveryFee: rupees(40),
          freeDeliveryAbove: rupees(499),
        },
      ],
    });
  }

  // ── Coupons ──
  const now = new Date();
  const inSixMonths = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 180);
  const coupons = [
    {
      code: "JUICY10",
      description: "10% off on orders above ₹200 (up to ₹50)",
      type: "PERCENT" as const,
      value: 10,
      minOrderAmount: rupees(200),
      maxDiscount: rupees(50),
    },
    {
      code: "FLAT30",
      description: "Flat ₹30 off on orders above ₹250",
      type: "FLAT" as const,
      value: rupees(30),
      minOrderAmount: rupees(250),
    },
    {
      code: "BUY2GET1",
      description: "Buy 2 drinks, get the cheapest one free",
      type: "BUY_X_GET_Y" as const,
      value: 0,
      minOrderAmount: 0,
      buyQuantity: 2,
      getQuantity: 1,
    },
  ];
  for (const c of coupons) {
    await db.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: { ...c, validFrom: now, validTo: inSixMonths },
    });
  }

  // ── Reviews ──
  if ((await db.review.count()) === 0) {
    const featured = ["blue-lagoon-ice-juice", "mango-mastani", "watermelon-mojito", "masala-shikanji", "royal-rose-falooda", "cold-coffee"];
    await db.review.createMany({
      data: reviews.map((r, i) => ({
        ...r,
        productId: productIdsBySlug.get(featured[i]) ?? null,
        isApproved: true,
        createdAt: new Date(now.getTime() - i * 1000 * 60 * 60 * 30),
      })),
    });
  }

  // ── Owner account ──
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set – skipping owner account.");
  } else {
    await db.staffUser.upsert({
      where: { email },
      update: {},
      create: {
        name: "Shop Owner",
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: "OWNER",
      },
    });
    console.log(`Owner account: ${email}`);
  }

  await seedWholesale();

  const counts = {
    businesses: await db.business.count(),
    wholesaleVariants: await db.productVariant.count({ where: { wholesaleEnabled: true } }),
    categories: await db.category.count(),
    products: await db.product.count(),
    variants: await db.productVariant.count(),
    ingredients: await db.ingredient.count(),
    recipes: await db.productIngredient.count(),
    zones: await db.deliveryZone.count(),
    coupons: await db.coupon.count(),
    reviews: await db.review.count(),
    staff: await db.staffUser.count(),
  };
  console.table(counts);
}

/**
 * Wholesale (B2B) sample data. Only fills in what is missing, so re-running the seed never
 * overwrites prices or settings changed in the admin panel.
 */
async function seedWholesale() {
  // Shop GST details (placeholders – update in Admin → Settings → Wholesale & GST).
  const settings = await db.shopSettings.findUniqueOrThrow({ where: { id: 1 } });
  if (!settings.gstin) {
    await db.shopSettings.update({
      where: { id: 1 },
      data: {
        legalName: "Cool Kick Beverages",
        gstin: "27ABCDE1234F1Z0", // dummy, valid format
        stateCode: "27",
        wholesaleMinOrder: rupees(2000),
        bankDetails: "Cool Kick Beverages · A/c 000000000000 · IFSC ABCD0000000 · UPI coolkick@upi (placeholder)",
        invoiceTerms: "Goods once delivered will not be taken back. Please pay by the due date. Subject to Pune jurisdiction.",
      },
    });
  }

  // Price lists and customer groups.
  const retailList = await db.priceList.upsert({
    where: { name: "Retail partners" },
    update: {},
    create: { name: "Retail partners", description: "Standard trade prices for shops and cafés", discountBps: 0 },
  });
  const distributorList = await db.priceList.upsert({
    where: { name: "Distributors" },
    update: {},
    create: { name: "Distributors", description: "8% below trade price for distributors", discountBps: 800 },
  });
  await db.customerGroup.upsert({
    where: { name: "Retailers" },
    update: {},
    create: { name: "Retailers", description: "Shops, cafés, canteens", priceListId: retailList.id },
  });
  await db.customerGroup.upsert({
    where: { name: "Distributors" },
    update: {},
    create: { name: "Distributors", description: "Resell to other shops", priceListId: distributorList.id },
  });

  // Wholesale on the Medium (350 ml) and Large (500 ml) sizes: ~60% of retail, sold by the case.
  const variants = await db.productVariant.findMany({
    where: { size: { in: ["MEDIUM", "LARGE"] }, wholesalePrice: null },
    include: { product: { select: { id: true, hsnCode: true, category: { select: { slug: true } } } } },
  });
  for (const v of variants) {
    const pack = v.size === "MEDIUM" ? 24 : 12;
    await db.productVariant.update({
      where: { id: v.id },
      data: {
        wholesaleEnabled: true,
        wholesalePrice: Math.round((v.price * 0.6) / 100) * 100,
        packSize: pack,
        moq: pack * 2,
        packaging: `Case of ${pack} bottles`,
        tiers: {
          create: [
            { minQuantity: pack * 5, discountBps: 300 },
            { minQuantity: pack * 10, discountBps: 600 },
          ],
        },
      },
    });
    if (!v.product.hsnCode) {
      const juice = /juice/.test(v.product.category.slug);
      await db.product.update({ where: { id: v.product.id }, data: { hsnCode: juice ? "2009" : "2202", gstRateBps: 1200 } });
    }
  }

  // A few finished-goods batches so stock shows up in the catalogue.
  if ((await db.batch.count()) === 0) {
    const stockVariants = await db.productVariant.findMany({ where: { wholesaleEnabled: true, size: "LARGE" }, take: 6, orderBy: { id: "asc" } });
    const day = 86_400_000;
    for (const [i, v] of stockVariants.entries()) {
      const qty = 120 + i * 24;
      const batch = await db.batch.create({
        data: {
          batchNumber: `B-SEED-${String(i + 1).padStart(3, "0")}`,
          variantId: v.id,
          manufacturedAt: new Date(Date.now() - day),
          expiresAt: new Date(Date.now() + (i === 0 ? 2 : 10) * day),
          quantityProduced: qty,
          quantityRemaining: qty,
          costPerUnit: Math.round((v.wholesalePrice ?? 0) * 0.55),
          note: "Seed batch",
        },
      });
      await db.batchMovement.create({ data: { batchId: batch.id, change: qty, reason: "PRODUCTION", note: "Seed batch" } });
    }
  }

  // Demo approved retailer – only when a password is provided (never in production by accident).
  const demoPassword = process.env.SEED_DEMO_BUSINESS_PASSWORD;
  if (demoPassword) {
    const group = await db.customerGroup.findUniqueOrThrow({ where: { name: "Retailers" } });
    const exists = await db.business.findUnique({ where: { phone: "9000000001" } });
    if (!exists) {
      await db.business.create({
        data: {
          legalName: "Sunrise Mart Private Limited",
          tradeName: "Sunrise Mart",
          type: "RETAILER",
          status: "APPROVED",
          approvedAt: new Date(),
          contactName: "Priya Kulkarni",
          phone: "9000000001",
          email: "orders@sunrisemart.example",
          passwordHash: await bcrypt.hash(demoPassword, 12),
          gstin: "27AAPFU0939F1ZV", // GST portal sample format
          pan: "AAPFU0939F",
          stateCode: "27",
          groupId: group.id,
          credit: { create: { isActive: true, creditLimit: rupees(50000), creditDays: 15 } },
          addresses: {
            create: {
              label: "Sunrise Mart, FC Road",
              contactName: "Priya Kulkarni",
              phone: "9000000001",
              line1: "Shop 4, Deccan Plaza, FC Road",
              area: "Shivajinagar",
              city: "Pune",
              state: "Maharashtra",
              pincode: "411005",
              isDefault: true,
            },
          },
        },
      });
      console.log("Demo business: 9000000001 (password from SEED_DEMO_BUSINESS_PASSWORD)");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
