# Cool Kick – Fresh & Chilled Juices

Online ordering website and admin dashboard for **Cool Kick**, an ice juice shop.
Customers browse the menu, customise drinks, and order for pickup or delivery (Cash on Delivery / Pay at Shop).
Staff manage orders, menu, stock, coupons, delivery zones and reports.

Built with Next.js 16, TypeScript, Tailwind CSS v4, PostgreSQL + Prisma 7, Auth.js, Zod, Zustand, Motion/GSAP/Lenis.
Design system from the Google Stitch "Mobile-Home" / "Desktop-Home" screens.

## Run it locally

Requirements: Node 20+ (24 recommended), Docker Desktop.

```bash
npm install
cp .env.example .env        # then edit SEED_ADMIN_PASSWORD and AUTH_SECRET
npm run db:up               # Postgres 16 in Docker (port 5433)
npm run db:migrate          # create tables
npm run db:seed             # sample menu, zones, coupons + owner login
npm run dev                 # http://localhost:3000
```

- Shop: http://localhost:3000
- Admin: http://localhost:3000/admin (log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- UI kit (dev only): http://localhost:3000/dev/ui

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Vitest unit tests (pricing, hours, status rules) |
| `npm run test:e2e` | Playwright end-to-end tests (desktop, Pixel, iPhone) + axe accessibility scans |
| `npm run db:migrate` · `db:seed` · `db:studio` | Prisma |

## Project docs

- `CLAUDE.md` – stack, folder structure, business rules and conventions
- `PLAN.md` – the phase-by-phase build plan
- `DEPLOYMENT.md` – Vercel / VPS deployment, domains, HTTPS, image storage, backups
