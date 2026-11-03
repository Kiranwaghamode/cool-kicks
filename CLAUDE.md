@AGENTS.md

# Cool Kick – ice juice shop website

Online ordering site + admin dashboard for **Cool Kick**, an ice juice shop, with a wholesale (B2B) portal for retailers and distributors. Build plans: `PLAN.md` (retail), `PLAN2.md` (B2B).

## Tech stack
- Next.js 16 (App Router, TypeScript, `src/`), React 19. **Cache Components is OFF** (`cacheComponents: false`) – we use the classic model: DB pages render on request (`dynamic = "force-dynamic"` on layouts) and admin mutations call `revalidatePath()`.
- Middleware is called **proxy** in Next 16 → `src/proxy.ts`.
- Tailwind CSS v4 (tokens in `src/app/globals.css` via `@theme`)
- PostgreSQL 16 (Docker, port **5433**) + Prisma 7 (`prisma-client` generator → `src/generated/prisma`, driver adapter `@prisma/adapter-pg`, config in `prisma.config.ts`). Import the client from `@/lib/db`.
- Auth.js v5 (credentials, JWT sessions, bcrypt), Zod 4, React Hook Form, Zustand (cart, persisted to localStorage)
- Motion + GSAP ScrollTrigger + Lenis for animations (customer site only)
- Vitest (`tests/unit`) and Playwright (`tests/e2e`)
- Design source: Google Stitch screens **Mobile-Home** and **Desktop-Home** only. Every other page is derived from that design system.

## Folder structure
```
src/app/(shop)/...      customer pages
src/app/(shop)/business  wholesale landing, register, login; (portal)/ = logged-in business pages
src/app/(documents)/... printable business invoices / statements (no shop chrome)
src/app/admin/...       admin pages
src/app/api/...         route handlers (only where server actions don't fit)
src/components/ui/      shared UI primitives
src/components/shop/    customer components
src/components/admin/   admin components
src/lib/                db client, auth, validation schemas, pricing, utils (shared/client-safe unless marked server-only)
src/server/             server-only data access and actions
prisma/                 schema, migrations, seed
tests/unit, tests/e2e   Vitest, Playwright
```

## Conventions
- Server components by default; `"use client"` only where interaction needs it.
- Server actions for mutations. Every server input is validated with **Zod**.
- **Never trust client prices.** Totals are always recalculated on the server with `src/lib/pricing.ts` (retail) and `src/lib/wholesale-pricing.ts` (wholesale, GST).
- **Money is integer paise** everywhere (₹80 = `8000`). Use `src/lib/money.ts` to format/convert.
- Every admin server action and data function calls `requireRole()` – the proxy check is only a first line.
- Shop timezone: `Asia/Kolkata`.
- Order numbers look like `CK-20431`; quotations `QT-1001`; GST invoices `CK/26-27/00001` (per financial year; URL form `CK-26-27-00001`).

## Business rules
1. All money is stored as integer paise. Never floats.
2. Prices and totals are always recalculated on the server when an order is placed.
3. Order totals: `subtotal − discount + deliveryFee = total`.
4. Delivery only for pincodes in active delivery zones. Each zone has its own fee and optional free-delivery threshold.
5. A minimum order amount is enforced on the server.
6. Orders cannot be placed when the shop is closed (outside opening hours or temporary closure mode).
7. Unavailable products cannot be added to the cart or ordered.
8. Each order gets a readable order number and is protected against duplicate submission (idempotency key).
9. Order tracking requires order number + phone number together.
10. An order is marked Paid only by an authorized staff member (no gateway yet).
11. Reports show Gross Sales, Discounts, Refunds, Net Sales. Revenue is never labelled profit. Cancelled/rejected orders are excluded from sales.
12. Customer phone numbers and addresses are visible only to logged-in staff.

### Wholesale (B2B) rules
13. Business customers (retailers / distributors) register with phone + password and stay `PENDING` until OWNER/MANAGER approve them. Wholesale prices are shown only to `APPROVED` accounts; `SUSPENDED`/`REJECTED` can log in but not order.
14. Business sessions are separate from staff Auth.js (`src/server/business-auth.ts`, cookie `ck_business`, DB-hashed tokens). Business pages call `requireBusiness()`, business actions `businessAction()`, and every query filters by the session's business id.
15. Wholesale prices exclude GST. Unit price = customer price › price-list override › base − price-list %, then the best volume tier (not on customer prices). Quantities must meet the MOQ and be whole packs.
16. Wholesale totals: `subtotal − discount + deliveryFee + GST = total`. CGST+SGST when the place of supply (delivery state, else buyer's state) equals the shop state, IGST otherwise. Delivery is taxed at the order's highest item rate. GST is never revenue: reports and the dashboard exclude `taxTotal`.
17. Credit orders are blocked when outstanding + order total > credit limit (credit row locked during checkout). Outstanding is always calculated from orders and payments, never stored.
18. Wholesale orders add a `PACKED` step; on CONFIRMED they take finished stock from batches (earliest expiry first, never expired); cancellation returns it and cancels the invoice. Advance (`BANK_TRANSFER`) orders can't be dispatched until fully paid.
19. GST invoices are issued on dispatch (or manually), numbered per financial year, and store an immutable snapshot. Payments (advance / partial / multiple / refunds) are `Payment` rows; `Order.amountPaid` is updated with guarded SQL.
20. Important admin and business actions are written to `AuditLog` via `audit()`.

### Order statuses
`PLACED → CONFIRMED → PREPARING → READY_FOR_PICKUP (pickup) | OUT_FOR_DELIVERY (delivery) → DELIVERED`,
plus `CANCELLED` (from any status before DELIVERED) and `REJECTED` (from PLACED only). Wholesale orders: `… PREPARING → PACKED → handoff …`. Transitions live in `src/lib/order-status.ts` (pass the channel) and are enforced on the server.

### Payment
- `paymentMethod`: `CASH_ON_DELIVERY` (delivery only), `PAY_AT_SHOP` (pickup only), wholesale also `CREDIT` and `BANK_TRANSFER` (advance); later `ONLINE`
- `paymentStatus`: `PENDING`, `PARTIALLY_PAID`, `PAID`, `FAILED`, `REFUNDED`
- `paymentProvider`, `paymentReference`: nullable, reserved for a future gateway

### Staff roles
- **OWNER**: everything, including staff, reports, settings
- **MANAGER**: products, inventory, orders, coupons, delivery zones, reviews, reports
- **STAFF**: view and update orders (status, mark paid, record wholesale payments, invoices, deliveries) only. Refunds are OWNER/MANAGER.
- Wholesale areas (businesses, credit, pricing, quotations, batches) are OWNER/MANAGER; the audit log is OWNER only.

## Design rules
- Match the Stitch Home screens closely (layout, spacing, colors, fonts) using the shared tokens.
- Reusable components, not copied markup. Mobile first; desktop at `md:`/`lg:`.
- Every page needs loading, empty, error and disabled states in the same style.
- Placeholder images live in `public/images/`.

## Gotchas (learned while building)
- `next/image`: `priority` is deprecated in Next 16 – use `loading="eager" fetchPriority="high"` for the LCP image.
- Motion runs under `<LazyMotion features={domAnimation} strict>` – use `m.div`, never `motion.div` (strict mode throws). No `layout` animations (needs domMax).
- Don't branch markup on `useReducedMotion()` (hydration mismatch); `MotionConfig reducedMotion="user"` handles it.
- The `(shop)/template.tsx` fade is opacity-only: transforms on that wrapper break `position: fixed` sticky bars.
- Text colours are tuned for WCAG AA: `--brand` (#4a7f1c) for white-text fills, `--brand-bright` (Stitch lime) only for decoration; `text-tangerine`, `bg-melon-deep`, `bg-whatsapp` for text/badges.
- Uploads are written to `/uploads` (not `public/`) and served by `src/app/uploads/[...path]/route.ts` – Next only serves `public/` files that existed at build time.
- Server actions must call `adminAction(area, …)` / `requireRole(area)`; areas are defined in `src/lib/permissions.ts`.
- E2E tests (`tests/e2e`) open the shop 24/7 and clear rate limits in global setup, and restore settings in teardown. `b2b.spec.ts` runs on the desktop project only and leaves its test businesses in the DB.
- Zod 4: `.omit()`/`.pick()` throw on schemas with refinements – keep a plain base schema (e.g. `wholesaleCheckoutBase`) and refine a copy.
- Files in a `"use server"` module may only export async functions (and types).
- Pure helpers used by unit tests live in `src/lib` (e.g. `credit.ts`, `gst.ts`); `src/server/*` imports `server-only` and can't be loaded by Vitest.
- Business verification documents are stored as bytes in `BusinessDocument` and streamed by auth-checked routes (`/admin/documents/[id]`, `/business/documents/[id]`) – never put them in `/uploads`.

## Commands
```
npm run db:up        # start Postgres (Docker)
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed sample data + owner account (+ demo retailer 9000000001 if SEED_DEMO_BUSINESS_PASSWORD is set)
npm run dev          # http://localhost:3000
npm test             # Vitest
npm run test:e2e     # Playwright
```
