/**
 * Generates placeholder product + category images in public/images/.
 * Uses the Stitch design photos where a good match exists, otherwise draws an
 * illustrated glass in the category colour. Re-run any time: `npx tsx scripts/generate-placeholders.ts`
 * Real photos dropped into public/images/products/<slug>.webp should replace these.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { categories } from "../prisma/seed-data";

const root = path.resolve(__dirname, "..");
const designDir = path.join(root, "public/images/design");
const productDir = path.join(root, "public/images/products");
const categoryDir = path.join(root, "public/images/categories");
fs.mkdirSync(productDir, { recursive: true });
fs.mkdirSync(categoryDir, { recursive: true });

const SIZE = 800;

/** Product slug -> design photo to crop. */
const photoFor: Record<string, string> = {
  "alphonso-mango-juice": "mango-frost",
  "mango-ice-juice": "watermelon-chill",
  "mango-mastani": "mango-frost",
  "blue-lagoon-ice-juice": "blue-curacao",
  "blue-curacao-mojito": "blue-curacao",
  "watermelon-juice": "guava-ice",
  "watermelon-mint-cooler": "guava-ice",
  "royal-rose-falooda": "rose-falooda",
  "kesar-pista-falooda": "kesar-shake",
  "mango-falooda": "kesar-shake",
  "virgin-mint-mojito": "mojito-duo",
  "mojito-party-pack": "mojito-duo",
  "ice-juice-duo": "mojito-duo",
  "orange-ice-juice": "watermelon-chill",
};

function slugify(s: string) {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt), g = clamp(((n >> 8) & 255) + amt), b = clamp((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Simple illustrated glass: cream backdrop, sun circle, glass with juice, ice, straw, fruit slice. */
function glassSvg(color: string, variant: number) {
  const light = shade(color, 60);
  const dark = shade(color, -40);
  const straw = ["#ff4d6d", "#6ba32e", "#3a86ff", "#f7b733"][variant % 4];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6D9"/><stop offset="1" stop-color="#FFFBEF"/></linearGradient>
    <linearGradient id="juice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.1"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.45"/></linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <circle cx="400" cy="400" r="270" fill="#F7B733" opacity="0.85"/>
  <ellipse cx="400" cy="690" rx="190" ry="22" fill="#000" opacity="0.08"/>
  <rect x="470" y="120" width="22" height="300" rx="11" fill="${straw}" transform="rotate(14 480 270)"/>
  <path d="M270 230 L530 230 L500 670 Q498 690 478 690 L322 690 Q302 690 300 670 Z" fill="url(#juice)"/>
  <rect x="300" y="280" width="70" height="70" rx="14" fill="#fff" opacity="0.55" transform="rotate(-12 335 315)"/>
  <rect x="410" y="300" width="64" height="64" rx="14" fill="#fff" opacity="0.5" transform="rotate(18 442 332)"/>
  <rect x="350" y="380" width="58" height="58" rx="12" fill="#fff" opacity="0.4" transform="rotate(8 379 409)"/>
  <path d="M262 215 L538 215 L503 690 L297 690 Z" fill="url(#glass)" stroke="#ffffff" stroke-width="8" stroke-opacity="0.9"/>
  <circle cx="545" cy="235" r="62" fill="${light}" stroke="#ffffff" stroke-width="10"/>
  <g stroke="#ffffff" stroke-width="5" opacity="0.9"><line x1="545" y1="180" x2="545" y2="290"/><line x1="490" y1="235" x2="600" y2="235"/><line x1="506" y1="196" x2="584" y2="274"/><line x1="584" y1="196" x2="506" y2="274"/></g>
  <path d="M250 200 q30 -40 70 -10 q-30 30 -70 10z" fill="#6ba32e"/>
  <path d="M235 175 q40 -20 60 20 q-40 10 -60 -20z" fill="#7bc043"/>
  <circle cx="190" cy="560" r="10" fill="#fff" opacity="0.8"/><circle cx="620" cy="520" r="7" fill="#fff" opacity="0.8"/><circle cx="640" cy="420" r="5" fill="#fff" opacity="0.8"/>
</svg>`;
}

/** Photos whose top edge contains UI mockup chrome – crop from the bottom, zoomed in. */
const bottomCrop = new Set(["blue-curacao", "mojito-duo", "watermelon-chill"]);

async function cropPhoto(name: string, out: string) {
  const src = path.join(designDir, `${name}.webp`);
  const meta = await sharp(src).metadata();
  const w = meta.width!, h = meta.height!;
  const fromBottom = bottomCrop.has(name);
  const side = Math.round(Math.min(w, h) * (fromBottom ? 0.8 : 1));
  const top = fromBottom ? h - side : Math.round((h - side) / 2);
  await sharp(src)
    .extract({ left: Math.round((w - side) / 2), top, width: side, height: side })
    .resize(SIZE, SIZE)
    .webp({ quality: 80 })
    .toFile(out);
}

async function main() {
  let made = 0;
  for (const cat of categories) {
    for (const [i, p] of cat.products.entries()) {
      const slug = slugify(p.name);
      const out = path.join(productDir, `${slug}.webp`);
      if (photoFor[slug]) await cropPhoto(photoFor[slug], out);
      else await sharp(Buffer.from(glassSvg(cat.color, i))).webp({ quality: 85 }).toFile(out);
      made++;
    }
    const first = slugify(cat.products[0].name);
    await sharp(path.join(productDir, `${first}.webp`)).resize(400, 400).toFile(path.join(categoryDir, `${cat.slug}.webp`));
  }
  console.log(`Generated ${made} product images and ${categories.length} category images.`);
}

main();
