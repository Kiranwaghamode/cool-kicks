// Dev helper: node scripts/shot.mjs <path> <outfile> [width] [fullPage=1]
import { chromium } from "@playwright/test";
const [, , path = "/", out = "shot.png", width = "1440", full = "1"] = process.argv;
const browser = await chromium.launch();
const w = Number(width);
const page = await browser.newPage({ viewport: { width: w, height: w < 500 ? 812 : 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://localhost:3000/" + path.replace(/^[/]+/, ""), { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: full === "1" });
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
