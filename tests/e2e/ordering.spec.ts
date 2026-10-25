import { expect, test } from "@playwright/test";
import { addFromProductPage, checkoutPickup, randomPhone, submitCheckout } from "./helpers";
import { clearRateLimits, setTemporarilyClosed } from "./db";

test.beforeEach(async () => {
  await clearRateLimits();
});

test("browse menu → options → coupon → pickup checkout → confirmation → tracking", async ({ page }) => {
  await page.goto("/menu", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Full Menu" })).toBeVisible();
  await page.getByRole("link", { name: "Mojitos", exact: true }).click();
  await expect(page).toHaveURL(/\/menu\/mojitos/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Mojitos" })).toBeVisible();

  // Large, less sugar, no ice, 2 × ₹110 = ₹220
  await addFromProductPage(page, "virgin-mint-mojito", { size: "Large", sugar: "Less", ice: "None", qty: 2, note: "No straw" });

  await page.goto("/cart");
  await expect(page.getByText("Virgin Mint Mojito").first()).toBeVisible();
  await expect(page.getByText(/Large · Less sugar · No ice/)).toBeVisible();
  await page.getByLabel("Coupon code").fill("JUICY10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("You save ₹22")).toBeVisible();
  await expect(page.getByLabel("Order summary")).toContainText("₹198");

  const phone = randomPhone();
  const orderNumber = await checkoutPickup(page, phone);
  await expect(page.getByRole("heading", { name: "Order placed!" })).toBeVisible();
  await expect(page.getByText(orderNumber).first()).toBeVisible();
  await expect(page.locator("main")).toContainText("₹198");

  await page.locator("main").getByRole("link", { name: "Track order" }).click();
  await expect(page).toHaveURL(/\/track\?order=CK-/);
  await expect(page.getByText("Order placed").first()).toBeVisible();
  await expect(page.getByText("Ready for pickup")).toBeVisible();
});

test("delivery order: invalid pincode is rejected, valid pincode works", async ({ page }) => {
  await addFromProductPage(page, "mango-mastani", { size: "Large", qty: 2 }); // ₹320 → free delivery in zone 1
  await page.goto("/checkout");
  await page.getByLabel(/^Name/).fill("E2E Delivery");
  await page.getByLabel(/^Mobile number/).fill(randomPhone());
  await page.getByText("Home Delivery", { exact: true }).click();

  await page.getByLabel(/^Pincode/).fill("999999");
  await expect(page.getByText(/we don.t deliver here yet/i)).toBeVisible();
  await expect(page.locator("button[type=submit]:visible").first()).toBeDisabled();

  await page.getByLabel(/^Pincode/).fill("411005");
  await expect(page.getByText(/We deliver here/).first()).toBeVisible();
  await page.getByLabel(/^House/).fill("Flat 7, Test Residency");
  await page.getByLabel(/^Area/).fill("Shivajinagar");
  await submitCheckout(page);
  await expect(page.getByRole("heading", { name: "Order placed!" })).toBeVisible();
  await expect(page.getByText("FREE")).toBeVisible();
  await expect(page.locator("main")).toContainText("Cash on Delivery");
});

test("ordering is blocked while the shop is closed", async ({ page }) => {
  await addFromProductPage(page, "fresh-orange-juice", { size: "Large", qty: 2 });
  await setTemporarilyClosed(true);
  try {
    await page.goto("/cart");
    await expect(page.getByText(/temporarily closed/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /checkout/i }).first()).toBeDisabled();
    await page.goto("/checkout");
    await page.getByLabel(/^Name/).fill("E2E Closed");
    await page.getByLabel(/^Mobile number/).fill(randomPhone());
    await expect(page.locator("button[type=submit]:visible").first()).toBeDisabled();
  } finally {
    await setTemporarilyClosed(false);
  }
});

test("tracking needs the right phone number", async ({ page }) => {
  await addFromProductPage(page, "watermelon-juice", { size: "Large", qty: 3 });
  const phone = randomPhone();
  const orderNumber = await checkoutPickup(page, phone);
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto("/track");
  await page.getByLabel("Order number").fill(orderNumber);
  await page.getByLabel("Phone number").fill(phone === "9000000000" ? "9111111111" : "9000000000");
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.getByText(/find an order with that number/)).toBeVisible();
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.getByText("Order placed").first()).toBeVisible();
});
