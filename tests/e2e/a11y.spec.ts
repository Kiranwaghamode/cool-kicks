import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated WCAG 2.1 AA checks on the main customer pages (desktop project only to keep runs short).
const PAGES = ["/", "/menu", "/product/mango-mastani", "/cart", "/checkout", "/track", "/contact", "/offers", "/faq", "/privacy", "/admin/login"];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Runs on desktop only");
    await page.goto(path, { waitUntil: "networkidle" });
    await page.waitForTimeout(700); // let entrance animations finish
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("iframe") // Google Maps embed
      .exclude("nextjs-portal") // dev-only overlay
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
    ).toEqual([]);
  });
}

test("no serious accessibility violations on admin pages", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Runs on desktop only");
  const { adminLogin } = await import("./helpers");
  const { OWNER, clearRateLimits } = await import("./db");
  await clearRateLimits();
  await adminLogin(page, OWNER.email, OWNER.password);
  const problems: string[] = [];
  for (const path of ["/admin", "/admin/orders", "/admin/products", "/admin/inventory", "/admin/reports", "/admin/coupons", "/admin/settings"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("nextjs-portal").analyze();
    for (const v of results.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
      problems.push(`${path} ${v.id} → ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    }
  }
  expect(problems).toEqual([]);
});
