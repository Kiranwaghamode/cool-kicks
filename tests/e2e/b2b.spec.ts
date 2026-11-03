import { expect, test, type Page } from "@playwright/test";
import { adminLogin, randomPhone } from "./helpers";
import { clearRateLimits, OWNER } from "./db";

// Wholesale (B2B) flows. Desktop project only – the flows are long and cover server logic,
// which doesn't change between viewports.

const PRODUCT = "Mixed Fruit Juice";
const PASSWORD = "Wholesale2026";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "Runs on desktop only"));

const business = { name: `E2E Traders ${Date.now().toString().slice(-6)}`, phone: randomPhone() };
let orderNumber = "";

async function businessLogin(page: Page) {
  await page.goto("/business/login");
  await page.getByLabel("Mobile number").fill(business.phone);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/business/account");
}

/** Add the Large size of PRODUCT, `extraPacks` above the MOQ. */
async function addToBulkCart(page: Page, extraPacks: number) {
  await page.goto("/business/catalogue");
  const card = page.locator("li", { has: page.getByRole("heading", { name: PRODUCT, exact: true }) });
  const row = card.locator("li", { hasText: "Large · 500 ml" });
  for (let i = 0; i < extraPacks; i++) await row.getByRole("button", { name: "More" }).click();
  await row.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Added to bulk cart").first()).toBeVisible();
}

async function drawerStep(page: Page, name: string, expectText: RegExp) {
  await page.getByRole("dialog").getByRole("button", { name, exact: true }).click();
  await expect(page.getByText(expectText).first()).toBeVisible();
}

test.beforeAll(async () => {
  await clearRateLimits();
});

test("a retailer registers and waits for approval without seeing prices", async ({ page }) => {
  await page.goto("/business/register");
  await page.getByLabel("Registered business name").fill(business.name);
  await page.getByLabel("Full name").fill("Asha Patil");
  await page.locator("#r-phone").fill(business.phone);
  await page.locator("#r-line1").fill("12 Market Yard");
  await page.locator("#r-area").fill("Shivajinagar");
  await page.locator("#r-city").fill("Pune");
  await page.locator("#r-pincode").fill("411005");
  await page.locator("#r-password").fill(PASSWORD);
  await page.locator("#r-confirm").fill(PASSWORD);
  await page.locator("#r-acceptTerms").check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await page.waitForURL("**/business/account");
  await expect(page.getByRole("heading", { name: "Your application is under review" })).toBeVisible();

  // Wholesale pages are off-limits until approval.
  await page.goto("/business/catalogue");
  await page.waitForURL("**/business/account");
  await expect(page.getByText("Catalogue")).toHaveCount(0);
});

test("the owner approves the business and sets a small credit limit", async ({ page }) => {
  await adminLogin(page, OWNER.email, OWNER.password);
  await page.goto(`/admin/businesses?status=PENDING&q=${encodeURIComponent(business.name)}`);
  await page.getByRole("link", { name: business.name }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(/is now approved/).first()).toBeVisible();

  await page.getByRole("button", { name: "Edit", exact: true }).nth(1).click(); // credit panel
  const dialog = page.getByRole("dialog", { name: "Credit terms" });
  await dialog.getByRole("switch", { name: "Allow credit" }).click();
  await dialog.getByLabel("Credit limit (₹)").fill("2000");
  await dialog.getByRole("button", { name: "Save credit terms" }).click();
  await expect(page.getByText("Credit terms saved").first()).toBeVisible();

  // Make sure there is ready stock to confirm the order later.
  await page.goto("/admin/finished-stock");
  await page.getByRole("button", { name: "Add batch" }).click();
  const batch = page.getByRole("dialog", { name: "Add production batch" });
  await batch.getByLabel("Product").selectOption({ label: `${PRODUCT} · large (500 ml)` });
  await batch.getByLabel("Units produced").fill("120");
  await batch.getByRole("button", { name: "Add batch" }).click();
  await expect(page.getByText(/Batch .* added/).first()).toBeVisible();
});

test("the business orders in bulk; credit over the limit is blocked", async ({ page }) => {
  await businessLogin(page);
  await addToBulkCart(page, 1); // 36 units ≈ ₹2,420 with GST
  await page.goto("/business/cart");
  await expect(page.getByText("CGST")).toBeVisible();
  const checkout = page.getByRole("link", { name: /Checkout/ });
  await expect(checkout).not.toHaveAttribute("aria-disabled", "true");
  await checkout.click();
  await page.waitForURL("**/business/checkout");

  const credit = page.getByRole("radio", { name: /On credit/ });
  await expect(credit).toBeDisabled();
  await expect(page.getByText(/Over your available credit/)).toBeVisible();

  await page.getByText("Bank transfer / UPI in advance").click();
  await page.getByLabel("Your PO number").fill("PO/E2E/1");
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/business\/orders\/CK-\d+/);
  orderNumber = page.url().match(/CK-\d+/)![0];
  await expect(page.getByText("Order placed!")).toBeVisible();
  await expect(page.getByText("PO PO/E2E/1")).toBeVisible();
});

test("staff confirm from stock, can't dispatch unpaid advance orders, record payment and invoice", async ({ page }) => {
  await adminLogin(page, OWNER.email, OWNER.password);
  await page.goto(`/admin/orders?channel=WHOLESALE&q=${orderNumber}&open=${orderNumber}`);
  await expect(page.getByRole("dialog").getByText("B2B")).toBeVisible();
  await drawerStep(page, "Confirm & reserve stock", /→ Confirmed/);
  await drawerStep(page, "Start processing", /→ Preparing/);
  await drawerStep(page, "Mark packed", /→ Packed/);
  await page.getByRole("dialog").getByRole("button", { name: "Dispatch", exact: true }).click();
  await expect(page.getByText(/record the payment before dispatching/).first()).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
  const pay = page.getByRole("dialog", { name: "Record payment" });
  await pay.getByLabel("Reference").fill("UTR-E2E-1");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/fully paid/).first()).toBeVisible();

  await drawerStep(page, "Dispatch", /→ Out for delivery/);
  await expect(page.getByRole("dialog").getByRole("link", { name: /Invoice CK\/\d{2}-\d{2}\/\d+/ })).toBeVisible();
  await drawerStep(page, "Mark delivered", /→ Delivered/);
});

test("the business sees the invoice, statement and confirms receipt", async ({ page }) => {
  await businessLogin(page);
  await page.goto(`/business/orders/${orderNumber}`);
  await page.getByRole("button", { name: "Confirm goods received" }).click();
  await page.getByLabel("Received by").fill("Asha Patil");
  await page.getByRole("button", { name: "Confirm received" }).click();
  await expect(page.getByText(/Receipt confirmed by Asha Patil/)).toBeVisible();

  await page.goto("/business/invoices");
  await page.getByRole("link", { name: /CK\/\d{2}-\d{2}\/\d+/ }).first().click();
  await expect(page.getByText("TAX INVOICE")).toBeVisible();
  await expect(page.getByText(business.name)).toBeVisible();

  await page.goto("/business/statement");
  await expect(page.getByRole("cell", { name: "Invoice" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Payment" }).first()).toBeVisible();
});

test("quotation: request → staff quote → business accepts into an order", async ({ browser }) => {
  const biz = await browser.newPage();
  await businessLogin(biz);
  await addToBulkCart(biz, 0);
  await biz.goto("/business/cart");
  await biz.getByRole("button", { name: "Request a quotation instead" }).click();
  await biz.getByLabel("Anything we should know?").fill("Need 24 every week");
  await biz.getByRole("button", { name: "Send request" }).click();
  await biz.waitForURL(/\/business\/quotations\/QT-\d+/);
  const quote = biz.url().match(/QT-\d+/)![0];
  await expect(biz.getByText("We're preparing your quote")).toBeVisible();

  const admin = await browser.newPage();
  await adminLogin(admin, OWNER.email, OWNER.password);
  await admin.goto("/admin/quotations?tab=REQUESTED");
  await admin.getByRole("link", { name: quote }).click();
  await admin.getByLabel("Price per unit").first().fill("95");
  await admin.getByRole("button", { name: "Send quote" }).click();
  await expect(admin.getByText(/Quote sent/).first()).toBeVisible();

  await biz.reload();
  await expect(biz.getByText("₹95").first()).toBeVisible();
  await biz.getByRole("button", { name: "Accept & place order" }).click();
  await biz.getByRole("dialog").getByText("Bank transfer / UPI in advance").click();
  await biz.getByRole("dialog").getByRole("button", { name: /Place order/ }).click();
  await biz.waitForURL(/\/business\/orders\/CK-\d+/);
  await expect(biz.getByText(`from quotation ${quote}`)).toBeVisible();
});

test("business sessions can't open the admin and staff pages stay protected", async ({ page }) => {
  await businessLogin(page);
  await page.goto("/admin");
  await page.waitForURL(/\/admin\/login/);
  // Private documents need a staff session.
  const res = await page.request.get("/admin/documents/does-not-exist", { maxRedirects: 0 });
  expect([302, 307, 401, 403]).toContain(res.status());
});
