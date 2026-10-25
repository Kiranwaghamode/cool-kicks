import { expect, type Page } from "@playwright/test";

export const randomPhone = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;

/** Add a drink from its product page with chosen options. */
export async function addFromProductPage(
  page: Page,
  slug: string,
  opts: { size?: "Small" | "Medium" | "Large"; sugar?: string; ice?: string; qty?: number; note?: string } = {},
) {
  await page.goto(`/product/${slug}`);
  const main = page.locator("main");
  if (opts.size) await main.getByRole("radiogroup", { name: "Size" }).getByText(opts.size, { exact: true }).click();
  if (opts.sugar) await main.getByRole("radiogroup", { name: "Sugar level" }).getByText(opts.sugar, { exact: true }).click();
  if (opts.ice) await main.getByRole("radiogroup", { name: "Ice level" }).getByText(opts.ice, { exact: true }).click();
  if (opts.note) await main.getByLabel(/Special instructions/).fill(opts.note);
  for (let i = 1; i < (opts.qty ?? 1); i++) await main.getByRole("button", { name: "Increase quantity" }).click();
  await main.locator("[data-add-to-cart]").click();
  await expect(page.getByText("Added to cart").first()).toBeVisible();
}

/** Fill the checkout form for pickup and place the order. Returns the order number. */
export async function checkoutPickup(page: Page, phone: string, name = "E2E Pickup") {
  await page.goto("/checkout");
  await page.getByLabel(/^Name/).fill(name);
  await page.getByLabel(/^Mobile number/).fill(phone);
  await page.getByText("Pickup", { exact: true }).first().click();
  await submitCheckout(page);
  return orderNumberFromUrl(page);
}

export async function submitCheckout(page: Page) {
  const review = page.locator("button[type=submit]:visible").first();
  await expect(review).toBeEnabled({ timeout: 15_000 });
  await review.click();
  await page.locator("[data-place-order]").click();
  await page.waitForURL(/\/order\/CK-\d+\/confirmed/, { timeout: 30_000 });
}

export function orderNumberFromUrl(page: Page) {
  const m = page.url().match(/CK-\d+/);
  if (!m) throw new Error(`No order number in ${page.url()}`);
  return m[0];
}

export async function adminLogin(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\/)?$/);
}
