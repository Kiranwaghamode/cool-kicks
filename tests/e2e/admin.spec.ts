import { expect, test } from "@playwright/test";
import { addFromProductPage, adminLogin, checkoutPickup, randomPhone } from "./helpers";
import { clearRateLimits, E2E_STAFF, OWNER } from "./db";

test.beforeEach(async () => {
  await clearRateLimits();
});

test("admin accepts an order, moves it through every status, marks paid – customer sees it", async ({ browser }) => {
  const customer = await browser.newPage();
  await addFromProductPage(customer, "cold-coffee", { size: "Large", qty: 1 });
  const phone = randomPhone();
  const orderNumber = await checkoutPickup(customer, phone, "E2E Admin Flow");

  const admin = await browser.newPage();
  await adminLogin(admin, OWNER.email, OWNER.password);
  await admin.goto(`/admin/orders?open=${orderNumber}`);
  const drawer = admin.getByRole("dialog", { name: `Order ${orderNumber}` });
  await expect(drawer.getByText("E2E Admin Flow")).toBeVisible();

  for (const action of ["Accept order", "Start preparing", "Ready for pickup", "Mark as paid", "Mark delivered"]) {
    const button = drawer.getByRole("button", { name: action });
    await button.click();
    await expect(button).toHaveCount(0);
  }
  await expect(drawer.getByText("Delivered").first()).toBeVisible();

  await customer.goto(`/track?order=${orderNumber}`);
  await expect(customer.getByText("Picked up").first()).toBeVisible();
  await expect(customer.getByText("Paid", { exact: true }).first()).toBeVisible();
  await expect(customer.getByText("How was your order?")).toBeVisible();
});

test("only valid next steps are offered for a new order", async ({ browser }) => {
  const customer = await browser.newPage();
  await addFromProductPage(customer, "fresh-lime-soda", { size: "Large", qty: 2 });
  const orderNumber = await checkoutPickup(customer, randomPhone());
  const admin = await browser.newPage();
  await adminLogin(admin, OWNER.email, OWNER.password);
  await admin.goto(`/admin/orders?open=${orderNumber}`);
  const drawer = admin.getByRole("dialog", { name: `Order ${orderNumber}` });
  await expect(drawer.getByRole("button", { name: "Accept order" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Reject" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Mark delivered" })).toHaveCount(0);
});

test("STAFF role cannot open products, reports or settings", async ({ page }) => {
  await adminLogin(page, E2E_STAFF.email, E2E_STAFF.password);
  const nav = page.getByRole("navigation", { name: "Admin" }).first();
  if (await nav.isVisible()) {
    await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Products" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Reports" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
  }
  for (const path of ["/admin/products", "/admin/reports", "/admin/settings", "/admin/staff", "/admin/inventory"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: /have access/ })).toBeVisible();
  }
  const res = await page.request.get("/admin/reports/export?format=csv&from=2026-01-01&to=2026-01-02");
  expect(res.status()).toBe(403);
});

test("logged-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);
  const res = await page.request.get("/admin/reports/export?format=csv", { maxRedirects: 0 });
  expect([302, 303, 307, 403]).toContain(res.status());
});
