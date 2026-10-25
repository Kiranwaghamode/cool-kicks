# Deploying Cool Kick

Two supported options:

- **A. Vercel + managed Postgres** (Neon, Supabase or Railway) – easiest, no server to look after.
- **B. A VPS with Docker** (DigitalOcean, Hetzner, AWS Lightsail…) – one small machine runs everything, including image uploads.

Both use the same environment variables and database steps.

---

## 1. Environment variables

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/coolkick?schema=public&sslmode=require` | From your Postgres provider. Use the **pooled** URL on Vercel (Neon: "pooled connection"; Supabase: port 6543 + `pgbouncer=true`). |
| `AUTH_SECRET` | 32+ random characters | Generate: `npx auth secret` or `openssl rand -base64 32`. Never reuse the dev one. |
| `AUTH_TRUST_HOST` | `true` | Needed behind Vercel/Caddy proxies. |
| `NEXT_PUBLIC_SITE_URL` | `https://coolkick.in` | Must be the final **https://** address. Used for SEO tags and sitemap. The server refuses to start in production if it isn't https. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `919876543210` | Digits only, with country code. |
| `NEXT_PUBLIC_SHOP_PHONE` | `+919876543210` | Shown on the site (also editable in Admin → Settings). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `owner@coolkick.in` / strong password | Only used once, when seeding the first owner account. |
| `STORAGE_DRIVER` | `local` / `cloudinary` / `s3` | See section 5. |

> `NEXT_PUBLIC_*` values are baked into the browser bundle at build time – rebuild after changing them.

---

## 2. Create the database (managed Postgres)

**Neon** (recommended for Vercel): create a project → region **Asia Pacific (Mumbai/Singapore)** → copy both the pooled and direct connection strings.

**Supabase**: New project → Settings → Database → copy the connection string (Transaction pooler, port 6543, for the app; Session/direct, port 5432, for migrations).

**Railway**: New → Database → PostgreSQL → Connect → copy `DATABASE_URL`.

## 3. Run migrations and seed the first owner

From your computer (or CI), pointing at the **direct** (non-pooled) URL:

```bash
# one time per deploy that changes the schema
DATABASE_URL="postgresql://…direct…" npx prisma migrate deploy

# one time only – creates categories, sample menu, zones, coupons and the OWNER login
DATABASE_URL="postgresql://…direct…" SEED_ADMIN_EMAIL="you@yourshop.in" SEED_ADMIN_PASSWORD="a-strong-password" npm run db:seed
```

On Windows PowerShell set variables first: `$env:DATABASE_URL="…"; npx prisma migrate deploy`.

The seed is safe to run again – it only adds what is missing. After the first login, **change the owner password** (Admin → Staff → Reset password) and replace the sample menu, prices, delivery pincodes, opening hours and the dummy phone/address in **Admin → Settings**.

> Want an empty menu instead of the samples? Delete categories/products from the admin, or edit `prisma/seed-data.ts` before seeding.

---

## 4A. Deploy to Vercel

1. Push the repository to GitHub/GitLab.
2. Vercel → **Add New Project** → import the repo. Framework is detected as Next.js.
3. Add all environment variables from section 1 (Production + Preview). Use the **pooled** `DATABASE_URL`.
4. Build command: `npm run build` (default). Install command: `npm install` (runs `prisma generate` automatically).
5. Deploy. Visit `https://<your-app>.vercel.app/api/health` – it should return `{"status":"ok","database":"ok"}`.
6. **Images:** Vercel's filesystem is read-only/temporary, so product photo uploads need `STORAGE_DRIVER=cloudinary` or `s3` (section 5) before staff upload photos.

**Custom domain:** Vercel → Project → Settings → Domains → add `coolkick.in` and `www.coolkick.in`. At your domain registrar add the DNS records Vercel shows (an `A` record `76.76.21.21` for the apex and a `CNAME` to `cname.vercel-dns.com` for `www`). HTTPS certificates are issued automatically. Then set `NEXT_PUBLIC_SITE_URL=https://coolkick.in` and redeploy.

## 4B. Deploy to a VPS with Docker

Requirements: Ubuntu 22.04+ with Docker and the compose plugin, ports 80/443 open, and a domain whose `A` record points to the server's IP.

```bash
git clone <your repo> coolkick && cd coolkick
cp .env.example .env.production
nano .env.production      # fill in every value; also add:
                          #   POSTGRES_PASSWORD=<strong password>
                          #   DOMAIN=coolkick.in
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# migrations + first owner account (safe to re-run; also run after schema changes)
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
```

What you get:
- **Caddy** terminates HTTPS with free, auto-renewing Let's Encrypt certificates for `DOMAIN` and redirects http → https.
- **Postgres 16** with data in the `db-data` volume.
- **Uploads** in the `uploads` volume (`STORAGE_DRIVER=local` works here).
- A container health check on `/api/health`.

Updating: `git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`, then run the `migrate` service again if the schema changed.

---

## 5. Image storage (Cloudinary / S3)

Uploads go through one helper: `src/server/storage.ts` → `saveImage()`. It already validates type/size and converts to WebP with sharp; only the final "write" step changes per driver.

**Cloudinary**
1. `npm install cloudinary` and add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
2. In the `case "cloudinary"` branch, upload the `output` buffer (`cloudinary.uploader.upload_stream({ folder: \`coolkick/${folder}\` })`) and return `result.secure_url`.
3. Add `{ protocol: "https", hostname: "res.cloudinary.com" }` to `images.remotePatterns` in `next.config.ts`, and `https://res.cloudinary.com` to `img-src` in the CSP there.
4. Set `STORAGE_DRIVER=cloudinary`.

**S3 / Cloudflare R2**
1. `npm install @aws-sdk/client-s3`, add `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`.
2. In `case "s3"`, `PutObjectCommand({ Bucket, Key: \`${folder}/${name}\`, Body: output, ContentType: "image/webp" })` and return `${S3_PUBLIC_URL}/${folder}/${name}`.
3. Add the public host to `images.remotePatterns` and the CSP `img-src`.
4. Set `STORAGE_DRIVER=s3`.

Existing images under `/images/...` (the placeholders) keep working because they ship with the app.

---

## 6. HTTPS checklist

- `NEXT_PUBLIC_SITE_URL` starts with `https://` (the server won't start otherwise).
- In production the app sends `Strict-Transport-Security`, a Content-Security-Policy, `X-Frame-Options: DENY` and other security headers (see `next.config.ts`).
- Auth cookies are `Secure` automatically on https.
- Vercel and Caddy both redirect http → https.

---

## 7. Daily database backups

**Managed Postgres:** Neon (paid plans keep point-in-time history), Supabase (daily backups on Pro) and Railway all have built-in backups – turn them on in the provider dashboard. Still keep an off-site copy weekly using the script below.

**VPS:** add a nightly `pg_dump` with cron (keeps 14 days):

```bash
sudo mkdir -p /var/backups/coolkick
sudo crontab -e
# add this line (runs 03:30 every day):
30 3 * * * cd /home/ubuntu/coolkick && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U coolkick -Fc coolkick > /var/backups/coolkick/coolkick-$(date +\%F).dump && find /var/backups/coolkick -name '*.dump' -mtime +14 -delete
```

Copy `/var/backups/coolkick` off the server (e.g. `rclone` to Google Drive/S3) and back up the `uploads` volume the same way.

**Restore:** `docker compose -f docker-compose.prod.yml exec -T db pg_restore -U coolkick -d coolkick --clean < coolkick-2026-10-25.dump`

---

## 8. After going live

- Monitor `https://<domain>/api/health` with a free uptime checker (UptimeRobot, Better Stack).
- Have the owner review prices, delivery zones, opening hours and the **draft** policy pages (`/privacy`, `/terms`, `/refund-policy`).
- Replace the placeholder photos: upload real ones in Admin → Products, or put files in `public/images/products/<slug>.webp`.
- Submit `https://<domain>/sitemap.xml` in Google Search Console and set up a Google Business Profile with the same address/phone.
