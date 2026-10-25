# Ice Juice Website – Build Plan for Claude Code

This plan is a list of prompts you paste into Claude Code **one at a time, in order**. Each prompt is one step. After each step: run the app, check the result, then commit before moving on.

> Replace `[BRAND NAME]` with your shop's name before starting.

---

## 1. Key Decisions

| Area | Choice |
|---|---|
| Framework | Next.js (latest, App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM | Prisma |
| Admin auth | Auth.js (NextAuth) with email + password (bcrypt), role-based |
| Validation | Zod (shared between forms and server) |
| Forms | React Hook Form |
| Cart state | Zustand, persisted to localStorage |
| Animations | Motion (Framer Motion) + GSAP ScrollTrigger + Lenis |
| Images | `next/image`; uploads stored locally in dev, behind a storage helper so it can move to Cloudinary/S3 later |
| Testing | Vitest (pricing and business logic) + Playwright (end-to-end order flow) |
| Local DB | PostgreSQL in Docker |
| Hosting (later) | Vercel + managed Postgres (Neon / Supabase / Railway), or a VPS |
| Design source | Google Stitch screens, provided to Claude Code through the Stitch MCP |

### Out of scope for now
- **Online payment gateway (Razorpay, UPI intent, cards).** For now, payment is **Cash on Delivery** and **Pay at Shop** (cash or UPI scanned at the counter). Staff mark orders as paid manually in the admin dashboard. The data model includes payment fields so a gateway can be added later without restructuring (see Phase 16).
- Customer accounts with OTP login (needs an SMS provider). MVP uses guest checkout.
- Automated WhatsApp/SMS notifications (needs WhatsApp Business API). MVP uses click-to-chat WhatsApp links.

---

## 2. Core Business Rules (Claude Code must follow these)

1. **All money is stored as integer paise** (₹80 = `8000`). Never use floats for money.
2. **Prices and totals are always recalculated on the server** when an order is placed. Never trust prices sent by the browser.
3. Order totals: `subtotal − discount + deliveryFee = total`.
4. Delivery is only allowed for **pincodes in the configured delivery zones**. Each zone has its own delivery fee and optional free-delivery threshold.
5. A **minimum order amount** is enforced on the server.
6. Orders cannot be placed when the shop is **closed** (outside opening hours or in temporary closure mode).
7. Unavailable products cannot be added to the cart or ordered.
8. Each order gets a readable **order number** (e.g. `IJ-20431`) and is protected against **duplicate submission** (idempotency key).
9. Order tracking requires **order number + phone number** together, so strangers can't look up other people's orders.
10. An order is marked **Paid** only by an authorized staff member (until a gateway is added).
11. Reports show **Gross Sales, Discounts, Refunds, Net Sales**. Revenue is never labelled profit. Cancelled orders are excluded from sales.
12. Customer phone numbers and addresses are visible only to logged-in staff.

### Order statuses
`PLACED → CONFIRMED → PREPARING → READY_FOR_PICKUP | OUT_FOR_DELIVERY → DELIVERED`, plus `CANCELLED` (from any status before DELIVERED) and `REJECTED` (from PLACED).

### Payment
- `paymentMethod`: `CASH_ON_DELIVERY`, `PAY_AT_SHOP` (later: `ONLINE`)
- `paymentStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`
- `paymentProvider`, `paymentReference`: nullable, reserved for the future gateway

### Staff roles
- **OWNER**: everything, including staff management, reports and settings
- **MANAGER**: products, inventory, orders, coupons, reports
- **STAFF**: view and update orders only

---

## 3. How to Hand Designs to Claude Code

The Stitch designs come through the **Stitch MCP**. For each UI step, tell Claude Code which Stitch screens to use.

> **Note:** Only the Home page exists in Stitch, as two screens: **Mobile-Home** and **Desktop-Home**. Every other page is designed by Claude Code using the design system taken from these two screens (colors, fonts, buttons, cards, spacing). Wherever a prompt names another Stitch screen, use Mobile-Home/Desktop-Home as the style reference instead. Every UI prompt below contains this line:

> "Fetch the Stitch screens **[screen names]** (mobile and desktop) through the Stitch MCP and implement them faithfully."

Rules for implementing designs (also written into `CLAUDE.md` in Phase 0):
- Match layout, spacing, colors, fonts and components closely, using Tailwind and the shared design tokens.
- Build reusable components rather than copying markup per page.
- Mobile first; use the desktop screen for `md:` and `lg:` breakpoints.
- If a design is missing a state (loading, empty, error, disabled), create one in the same style.
- Use placeholder images in `public/images/` until real product photos are ready.

---

## 4. Build Phases and Prompts

### Phase 0 – Project setup

```
Set up a new project for "[BRAND NAME]", an ice juice shop website with online ordering and an admin dashboard.

Tech stack:
- Next.js (latest, App Router, TypeScript, src/ directory)
- Tailwind CSS
- PostgreSQL with Prisma
- Zod, React Hook Form, Zustand
- ESLint + Prettier
- Vitest for unit tests, Playwright for end-to-end tests

Tasks:
1. Create the Next.js app and install the dependencies above.
2. Add a docker-compose.yml with PostgreSQL 16 for local development, and a .env.example with DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_WHATSAPP_NUMBER, NEXT_PUBLIC_SHOP_PHONE. Make sure .env is gitignored.
3. Folder structure:
   src/app/(shop)/...      customer pages
   src/app/admin/...       admin pages
   src/app/api/...         route handlers (only where server actions don't fit)
   src/components/ui/      shared UI primitives
   src/components/shop/    customer components
   src/components/admin/   admin components
   src/lib/                db client, auth, validation schemas, pricing, utils
   src/server/             server-only data access and actions
   prisma/                 schema, migrations, seed
4. Add a money helper (src/lib/money.ts) that stores money as integer paise and formats it as ₹ in the en-IN locale.
5. Create a CLAUDE.md at the project root that records the tech stack, folder structure, the business rules and order statuses from PLAN.md sections 2 and 3, and these conventions: server components by default, server actions for mutations, Zod validation on every server input, never trust client prices, money in paise.
6. Add npm scripts: dev, build, lint, test, test:e2e, db:migrate, db:seed, db:studio.
7. Initialize git and make the first commit.

Show me how to start Postgres and run the app when done.
```

### Phase 1 – Database schema and seed data

```
Create the Prisma schema for the ice juice shop, following the business rules in CLAUDE.md.

Models:
- Category: id, name, slug, description, image, sortOrder, isActive
- Product: id, name, slug, description, image, categoryId, ingredients (string[]), tags (BESTSELLER, NEW, SEASONAL), isAvailable, isActive, sortOrder, allowSugarChoice, allowIceChoice, createdAt, updatedAt
- ProductVariant: id, productId, size (SMALL, MEDIUM, LARGE), volumeMl, price (int paise), isAvailable
- Ingredient: id, name, unit (KG, LITRE, PIECE, GRAM, ML), currentStock (decimal), lowStockThreshold, updatedAt
- ProductIngredient: productId, ingredientId, quantityPerUnit (recipe: how much one drink uses)
- StockMovement: id, ingredientId, change, reason (PURCHASE, USAGE, WASTAGE, ADJUSTMENT), note, orderId?, staffId?, createdAt
- Order: id, orderNumber (unique, e.g. IJ-20431), idempotencyKey (unique), customerName, customerPhone, customerEmail?, fulfilment (PICKUP, DELIVERY), address fields (line1, line2, landmark, area, pincode), deliveryZoneId?, subtotal, discount, deliveryFee, total (all int paise), couponCode?, paymentMethod, paymentStatus, paymentProvider?, paymentReference?, status, notes?, cancelReason?, createdAt, updatedAt
- OrderItem: id, orderId, productId, productName (snapshot), size, unitPrice (snapshot), quantity, sugarLevel (NONE, LESS, REGULAR, EXTRA), iceLevel (NONE, LESS, REGULAR, EXTRA), instructions?, lineTotal
- OrderStatusHistory: id, orderId, fromStatus, toStatus, changedById?, note, createdAt
- Coupon: id, code (unique, uppercase), description, type (PERCENT, FLAT, BUY_X_GET_Y), value, minOrderAmount, maxDiscount?, buyQuantity?, getQuantity?, validFrom, validTo, usageLimit?, usedCount, isActive
- DeliveryZone: id, name, pincodes (string[]), deliveryFee, freeDeliveryAbove?, isActive
- ShopSettings (single row): shopName, phone, whatsappNumber, email, address, mapEmbedUrl, mapLink, openingHours (JSON per weekday), isTemporarilyClosed, closureMessage, minOrderAmount, pickupEnabled, deliveryEnabled, codEnabled, payAtShopEnabled
- Review: id, customerName, rating (1-5), comment, productId?, isApproved, createdAt
- StaffUser: id, name, email (unique), passwordHash, role (OWNER, MANAGER, STAFF), isActive, lastLoginAt
- Expense (optional, for reports): id, title, amount, category, date

Add sensible indexes (orderNumber, customerPhone, status, createdAt, product slug, category slug).

Then write prisma/seed.ts with:
- All categories: Fresh Fruit Juices, Ice Juices, Mango Juice, Orange Juice, Watermelon Juice, Pineapple Juice, Grape Juice, Lemon Juice, Mojitos, Milkshakes, Smoothies, Falooda, Seasonal Specials, Combos & Offers
- 3-4 realistic products per category with Small/Medium/Large prices in paise (typical Indian juice bar prices, ₹40–₹180)
- Ingredients with stock and recipes for the main products
- Two delivery zones with sample pincodes and fees
- Sample coupons: JUICY10 (10% off, max ₹50, min ₹200), FLAT30 (₹30 off above ₹250), and a Buy 2 Get 1 offer
- ShopSettings with sample hours (10:00–23:00 daily)
- A few approved reviews
- One OWNER account whose email and password come from SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env variables (add them to .env.example)

Run the migration and the seed, and confirm the data is there.
```

### Phase 2 – Design system from Stitch

```
Fetch my Google Stitch project through the Stitch MCP and build the design system from it.

1. Read the Home screen (mobile and desktop) and the other screens to extract: colors, font families, font sizes, border radius, shadows, spacing and button styles.
2. Put these into Tailwind as theme tokens (CSS variables in globals.css + Tailwind theme), and load the fonts with next/font.
3. Build reusable UI components in src/components/ui/ matching the Stitch style: Button (primary, secondary, outline, ghost; sizes; loading and disabled states), Badge, Card, Input, Textarea, Select, SegmentedControl, QuantityStepper, Chip, Modal/BottomSheet, Drawer, Tabs, Toast, Skeleton, EmptyState.
4. Create a /dev/ui page (development only) that shows every component and state so I can check it against the design.

Don't build any pages yet. Show me the /dev/ui page when done.
```

### Phase 3 – Shop layout and Home page

```
Fetch the Stitch "Home" screens (mobile and desktop) through the Stitch MCP and implement them faithfully.

1. Shop layout for all customer pages, in src/app/(shop)/layout.tsx:
   - Header: logo, nav links (desktop), search, cart icon with live item count, Order Now button
   - Mobile sticky bottom navigation: Home, Menu, Cart, Orders, Account/Help, with a cart badge
   - Floating WhatsApp button (wa.me link using NEXT_PUBLIC_WHATSAPP_NUMBER with a friendly pre-filled message)
   - Footer: links to About, Contact, Offers, FAQ, Privacy, Terms, Refund Policy; social icons; shop contact
   - Open/closed banner driven by ShopSettings opening hours and closure mode
2. Home page sections, using real data from the database (server components):
   Hero with Order Now button, categories carousel, most popular / bestseller products, special offers (active coupons), why choose us, customer reviews (approved), shop location with map embed, call and WhatsApp buttons.
3. A reusable ProductCard used across the site, with an "Unavailable" state.
4. SEO: metadata, Open Graph tags, and LocalBusiness JSON-LD from ShopSettings.

No animations yet (Phase 14). Make it fully responsive and check it at 375px, 768px and 1440px.
```

### Phase 4 – Menu and Product Details

```
Fetch the Stitch "Menu" and "Product Details" screens (mobile and desktop) through the Stitch MCP and implement them faithfully.

Menu page (/menu):
- Search box, sticky category filter chips, sort (Popular, Price low-high, Price high-low)
- Filters and search kept in the URL (?category=mojitos&q=mint&sort=price-asc) so links are shareable
- Product grid: 2 columns mobile, 3 tablet, 4 desktop
- Unavailable products shown greyed out with a disabled button
- Empty state when nothing matches
- Also /menu/[categorySlug] pages

Product details (/product/[slug]):
- Image, name, rating, availability badge, description, ingredients chips
- Size selector (price per size from ProductVariant), sugar and ice segmented controls (only if the product allows them), special instructions, quantity stepper
- Sticky bottom bar with live total and Add to Cart
- "You may also like" from the same category
- On mobile, tapping a product card on the menu may open this as a bottom sheet; the full page must still work for direct links
- Generate metadata per product

Add to Cart is wired up in the next phase; for now leave a clear TODO hook.
```

### Phase 5 – Cart

```
Fetch the Stitch "Cart" screens (mobile and desktop) through the Stitch MCP and implement them faithfully.

1. Cart store with Zustand persisted to localStorage. A cart line is identified by productId + size + sugar + ice + instructions, so the same drink with different options is a separate line.
2. Wire up Add to Cart from product cards (default: Medium, regular sugar, regular ice) and from the product page (chosen options). Show a toast and update the header and bottom-nav badges.
3. Cart page (/cart): line items with options, quantity stepper, remove, "add more items", pickup vs delivery toggle, coupon code field, bill summary (subtotal, discount, delivery fee, total), "add ₹X more for free delivery" hint, minimum order warning, empty-cart state.
4. Create ONE shared pricing module in src/lib/pricing.ts: calculateOrderTotals({ items, coupon, fulfilment, deliveryZone, settings }). It must handle percent, flat and buy-X-get-Y coupons (cheapest items free), max discount caps, minimum order amounts and free-delivery thresholds. All values in paise.
5. A server action validateCart that takes the cart, loads current prices and availability from the database, and returns the correct totals plus any problems (product unavailable, price changed, coupon invalid). The cart page calls it to show accurate numbers; the browser's numbers are never trusted.
6. Write Vitest unit tests for pricing.ts covering every coupon type and edge case.
```

### Phase 6 – Checkout and order placement

```
Fetch the Stitch "Checkout" and "Order Confirmation" screens (mobile and desktop) through the Stitch MCP and implement them faithfully.

Checkout (/checkout):
- Customer details: name, Indian mobile number (10 digits, validated), optional email
- Fulfilment: Pickup or Home Delivery (respect ShopSettings toggles)
- Delivery address (only for delivery): line1, line2, landmark, area, pincode. Check the pincode against DeliveryZone as soon as it's entered and show "Sorry, we don't deliver here yet" if unsupported.
- Payment method: Cash on Delivery (delivery only) and Pay at Shop (pickup only) — show only those enabled in ShopSettings. Show a small note "Online payment coming soon". NO payment gateway.
- Order summary with server-validated totals
- Review step / confirm before submitting
- Place Order button with loading state, disabled while submitting

placeOrder server action:
- Validate everything with Zod
- Reject if the shop is closed, a product is unavailable, the pincode is outside delivery zones, or the minimum order isn't met
- Recalculate totals on the server with pricing.ts
- Use an idempotency key generated when the checkout page loads, so double-clicks or retries never create two orders
- Generate a unique readable order number (IJ-XXXXX)
- Save Order, OrderItems (with name and price snapshots) and the first OrderStatusHistory row in one database transaction
- Increment coupon usedCount
- Add basic rate limiting on this action (per IP / phone)
- Return friendly error messages

Order confirmation (/order/[orderNumber]/confirmed):
- Success screen, order number with copy button, estimated time, payment method and status, items and total
- Buttons: Track Order, Send order on WhatsApp (wa.me link with the order summary pre-filled), Back to Home
- Clear the cart after a successful order
- Save the order number + phone in localStorage so "My Orders" can list recent orders on this device

Handle network errors and failed submissions gracefully, keeping the form data.
```

### Phase 7 – Order tracking and My Orders

```
Fetch the Stitch "Order Tracking" and "My Orders" screens (mobile and desktop) through the Stitch MCP and implement them faithfully.

Order tracking (/track):
- Form asking for order number AND phone number; only show the order if both match
- Order card: number, date/time, items, total, payment method and status
- Vertical status timeline from OrderStatusHistory with timestamps; current step highlighted; separate Cancelled/Rejected state
- Pickup orders show "Ready for Pickup"; delivery orders show "Out for Delivery"
- Auto-refresh the status every 30 seconds while the order is active
- "Need help? Chat on WhatsApp" button prefilled with the order number
- "Reorder" button that adds the same items back into the cart (skipping unavailable ones, with a message)

My Orders (/orders):
- No login for now. List the orders saved on this device (from localStorage), fetching their live status from the server using order number + phone.
- Tabs: Active, Past, Cancelled
- Also a "Find an order" link to /track
```

### Phase 8 – Content pages

```
Fetch the Stitch "About", "Contact", "Offers" and "Policy" screens (mobile and desktop) through the Stitch MCP and implement them faithfully.

- /about: brand story, photos, stats, call to action
- /contact: phone, WhatsApp and email cards, Google Map embed and directions link from ShopSettings, opening hours table, contact form (saves to a new ContactMessage table, rate-limited, with honeypot spam protection), FAQ accordion
- /offers: active coupons with copy-code buttons, combos, conditions and validity
- /faq: FAQ page (content in a typed data file so it's easy to edit)
- /privacy, /terms, /refund-policy: one shared policy layout with table of contents and last-updated date. Write sensible draft text for an Indian juice shop with pickup and delivery, cash payment, and clear cancellation/refund rules, marked clearly as a draft for the owner to review.
- 404 and error pages in the brand style
- sitemap.xml and robots.txt (exclude /admin)
```

### Phase 9 – Admin authentication and layout

```
Fetch the Stitch "Admin Login" and "Admin Dashboard" screens through the Stitch MCP and implement the login page and admin layout.

1. Auth.js with a credentials provider against StaffUser (bcrypt password check). Only active users can log in. Update lastLoginAt.
2. Session includes user id, name and role.
3. Protect every /admin route (except /admin/login) in middleware AND check the session + role again inside every admin server action and data function. Unauthorized users get redirected or a 403.
4. A requireRole(['OWNER','MANAGER']) helper used everywhere.
5. Login rate limiting / lockout after repeated failures.
6. Admin layout: sidebar (Dashboard, Orders, Products, Categories, Inventory, Coupons, Delivery Zones, Reviews, Reports, Staff, Settings), top bar with order search and a "Shop Open" toggle, user menu with Logout. Hide links the user's role can't use. Sidebar collapses on mobile.
7. Staff management page (OWNER only): add staff, set role, deactivate, reset password.
8. Dashboard page: today's sales, today's orders, pending orders, average order value, cancelled orders, 7-day sales chart, latest new orders, best sellers, low-stock alerts. Use real data.
```

### Phase 10 – Product and category management

```
Fetch the Stitch "Product Management" screens through the Stitch MCP and implement them faithfully. (OWNER and MANAGER only.)

Products (/admin/products):
- Table/grid with image, name, category, price range, availability toggle (instant update), edit, delete
- Search, category filter, availability filter
- Add/Edit form: image upload with preview, name, slug (auto from name, editable), category, description, ingredients, tags, allowSugarChoice, allowIceChoice, size variants (Small/Medium/Large with volume and price in ₹, converted to paise), recipe (ingredients + quantity per drink), availability
- Delete = soft delete (isActive=false) so past orders keep working; confirmation dialog

Categories (/admin/categories): add, edit, reorder (drag or up/down), activate/deactivate, image.

Image uploads: validate type (jpg, png, webp) and size (max 3 MB), resize/convert to webp with sharp, store through a storage helper (src/server/storage.ts) that saves to public/uploads in development and can be switched to Cloudinary/S3 later via env.

After any change, revalidate the affected shop pages so customers see updates immediately.
```

### Phase 11 – Order management

```
Fetch the Stitch "Order Management" screens through the Stitch MCP and implement them faithfully.

/admin/orders:
- Status tabs with counts (New, Confirmed, Preparing, Ready, Out for Delivery, Delivered, Cancelled/Rejected)
- Search by order number or phone; date range filter; pagination
- Table: order #, customer, phone, items count, total, payment method and status, pickup/delivery, status, time
- New orders auto-refresh every 15 seconds with a sound + highlight for new incoming orders
- Order detail drawer: customer and address (with Google Maps link), items with size/sugar/ice/instructions, totals, coupon, status history
- Actions: Accept, Reject (with reason), move to next status (only valid transitions from CLAUDE.md), Cancel (with reason), Mark as Paid / Refunded (records who did it), Message customer on WhatsApp (wa.me link with status text), Print order slip (print-friendly KOT layout)
- Every status change writes an OrderStatusHistory row with the staff user
- STAFF role can update statuses and mark paid; only OWNER/MANAGER can refund

Enforce the status transition rules on the server, not just in the UI.
```

### Phase 12 – Inventory management

```
Fetch the Stitch "Inventory Management" screens through the Stitch MCP and implement them faithfully. (OWNER and MANAGER.)

/admin/inventory:
- Ingredient table: name, current stock, unit, low-stock threshold, status (In Stock / Low / Out), last updated
- Add/edit ingredients
- Update Stock modal: add or reduce, reason (Purchase, Usage, Wastage, Adjustment), note → writes a StockMovement row
- Stock movement history per ingredient
- When an order is CONFIRMED, deduct ingredient usage automatically using the product recipes (quantityPerUnit × quantity); restore it if that order is later cancelled
- Low-stock alert banner and dashboard widget
- For each out-of-stock ingredient, show which products use it with a one-click "Mark these products unavailable" action (don't auto-hide products without asking)

Do the deduction inside the same transaction as the status change.
```

### Phase 13 – Reports, coupons, delivery zones and settings

```
Fetch the Stitch "Sales Reports" screens through the Stitch MCP and implement them, then add the remaining admin settings pages.

Reports (/admin/reports, OWNER and MANAGER):
- Date range: Today, This Week, This Month, Custom
- Cards: Gross Sales, Discounts, Refunds, Net Sales, Total Orders, Cancelled Orders, Average Order Value. Label clearly that this is revenue, not profit. Exclude cancelled/rejected orders from sales.
- Optional Expenses section (add expenses) and a "Net Sales − Expenses" figure labelled "Estimated balance (not accounting profit)"
- Charts: daily sales bar chart, sales by category, sales by payment method, pickup vs delivery
- Best-selling products table (quantity and revenue)
- Export to CSV and Excel (.xlsx)
- All report queries run on the server and use the shop's timezone (Asia/Kolkata)

Coupons (/admin/coupons): create/edit/deactivate percent, flat and buy-X-get-Y coupons with validity, limits and minimum order.

Delivery zones (/admin/delivery-zones): name, pincodes, fee, free-delivery threshold, active.

Reviews (/admin/reviews): approve or hide reviews. Add a simple review form on the order tracking page for delivered orders (verified by order number + phone).

Settings (/admin/settings, OWNER): shop details, phone/WhatsApp, address and map link, opening hours per weekday, temporary closure mode with message, minimum order amount, enable/disable pickup, delivery, COD and Pay at Shop.
```

### Phase 14 – Animations and polish

```
Add animations and polish across the customer site, keeping it fast and accessible.

- Lenis smooth scrolling on customer pages (not admin)
- Hero: bottles float gently, juice splash and fruit slices parallax on scroll (GSAP ScrollTrigger), headline and stats fade/slide in
- Section reveals on scroll (Motion whileInView), staggered product cards
- Product cards: lift + image zoom on hover, squish on tap
- Add to Cart: button bounce, small fly-to-cart effect, cart badge pop
- Product details: bottom sheet slide-up on mobile, smooth size/option transitions, animated price changes
- Page transitions between shop pages
- Order confirmation: confetti/splash success animation
- Order tracking: pulsing current step
- Skeleton loading states everywhere data loads
- Respect prefers-reduced-motion (disable non-essential motion)
- Check performance: Lighthouse mobile score 90+ for performance and accessibility; lazy-load heavy animation code; optimize all images
```

### Phase 15 – Testing and hardening

```
Test and harden the whole application.

1. Playwright end-to-end tests:
   - Browse menu → add items with options → apply coupon → checkout with pickup → confirmation → track order
   - Delivery order with a valid pincode, and rejection for an invalid pincode
   - Ordering while the shop is closed is blocked
   - Admin login → accept order → move through statuses → mark paid → customer tracking shows updates
   - STAFF role can't access products, reports or settings
2. Run tests on mobile (Pixel and iPhone viewports) and desktop.
3. Security review: all admin actions check roles on the server; every input validated with Zod; no secrets in client code; customer data never exposed by public endpoints; tracking requires order number + phone; rate limits on order, login and contact form; security headers (CSP, HSTS, X-Frame-Options) in next.config.
4. Accessibility review: labels on all inputs, keyboard navigation, focus states, color contrast, alt text.
5. Fix everything you find and give me a summary.
```

### Phase 16 – Deployment

```
Prepare the app for production deployment.

1. Production build passes with no errors or lint warnings.
2. Write a DEPLOYMENT.md covering: managed Postgres setup (Neon, Supabase or Railway), environment variables, running prisma migrate deploy, seeding the first owner account, image storage switch to Cloudinary/S3, deploying to Vercel (or a VPS with Docker), connecting a custom domain with HTTPS, and daily database backups.
3. Add a health check route.
4. Make sure the production site uses HTTPS and the correct NEXT_PUBLIC_SITE_URL.
```

---

## 5. Later Versions (prompts to use when ready)

### Online payments (Razorpay with UPI, GPay, PhonePe, cards)

```
Add Razorpay online payments to the existing checkout.

- New payment method ONLINE, enabled from settings
- Create the Razorpay order on the server with the server-calculated total; keep the key secret only on the server
- Open Razorpay Checkout on the client (UPI, GPay, PhonePe, cards, netbanking)
- Verify the payment signature on the server, and add a Razorpay webhook (signature-verified) as the source of truth for payment.captured / payment.failed / refunds
- Mark the order PAID only after server-side verification; store paymentProvider and paymentReference
- Handle failed or abandoned payments: order stays PENDING payment, customer can retry
- Admin: refunds through the Razorpay API, payment details in the order drawer
- Never store card details, UPI PINs or passwords
- Update tests, reports (payment method breakdown) and the policy pages
```

### Customer accounts
```
Add optional customer accounts with phone number + OTP login (using an SMS provider such as MSG91 or Twilio), linking past guest orders by phone, saved addresses, full order history, one-tap reorder and favourites. Guest checkout must keep working.
```

### Automated notifications
```
Add automated order status notifications through the WhatsApp Business Cloud API (approved templates) and/or SMS, sent when an order is confirmed, ready, out for delivery and delivered. Make it configurable in settings and log every message sent.
```

### Loyalty program
```
Add a simple loyalty program: customers earn points per ₹ spent on delivered orders, redeem points as a discount at checkout, with settings for earn and redeem rates.
```

---

## 6. Tips for Working with Claude Code

- **One phase per conversation** works best. Start each with: *"Read CLAUDE.md and PLAN.md, then do Phase X."*
- **Commit after every phase** so you can roll back easily.
- **Check the UI after each phase** at mobile and desktop sizes. Give feedback like *"the hero heading is too big on mobile"* and include screenshots.
- If Claude drifts from the design, say: *"Fetch the Stitch screen again and compare it to the page."*
- Keep real product photos in `public/images/products/` with clear names (`mango-ice-juice.webp`).
- Before going live, have the owner review prices, delivery zones, opening hours and the policy pages.
