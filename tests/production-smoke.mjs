import { chromium } from "playwright";
import { spawn } from "node:child_process";

const server = spawn("python3", ["-m", "http.server", "8787"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  await sleep(800);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Product 1: website AI receptionist
  await page.goto("http://127.0.0.1:8787/chatbot.html", { waitUntil: "networkidle" });
  if (await page.locator("#messages .msg").count() < 1) throw new Error("Chatbot greeting failed");
  await page.locator("#chatInput").fill("I need a plumber");
  await page.getByRole("button", { name: "Get a quote" }).click();
  await page.locator("#chatInput").fill("Test Customer");
  await page.locator("#chatForm button").click();
  await page.locator("#chatInput").fill("555-0199");
  await page.locator("#chatForm button").click();
  await page.waitForTimeout(800);
  const chatText = await page.locator("#messages").innerText();
  if (!/captured|follow up|saved|received|thank/i.test(chatText)) throw new Error("Chatbot lead capture flow failed");

  // Product 2: AI Lead Recovery Engine
  await page.goto("http://127.0.0.1:8787/lead-recovery.html", { waitUntil: "networkidle" });
  if (await page.title() !== "DealSpark Lead Recovery — Turn Missed Leads Into Customers") throw new Error("Recovery Desk title failed");
  if (await page.locator("#new").textContent() !== "1") throw new Error("Recovery Desk initial New count failed");
  if (await page.locator("#follow").textContent() !== "1") throw new Error("Recovery Desk initial Follow-up count failed");
  if (await page.locator("#qualified").textContent() !== "1") throw new Error("Recovery Desk initial Qualified count failed");
  if (await page.locator("#booked").textContent() !== "1") throw new Error("Recovery Desk initial Booked count failed");
  await page.locator('button[data-action="sms"]').first().click();
  await page.locator('button[data-action="email"]').first().click();
  await page.locator('button[data-action="call"]').first().click();
  await page.locator("#addLead").click();
  if (await page.locator(".lead").count() !== 5) throw new Error("Recovery Desk add-lead flow failed");

  // Verify the phone and product pages are actually present and render.
  const productDemos = [
    "ops-lab/leadflow-demo.html",
    "ops-lab/quotepilot-demo.html",
    "ops-lab/scheduleflow-demo.html",
    "ops-lab/dispatchdesk-demo.html",
    "ops-lab/assetcare-demo.html",
    "ops-lab/billguard-demo.html",
    "ops-lab/stockwatch-demo.html",
    "ops-lab/staffdesk-demo.html",
    "ops-lab/reviewshield-demo.html",
    "ops-lab/opsvault-demo.html"
  ];
  for (const path of productDemos) {
    const response = await page.goto("http://127.0.0.1:8787/" + path, { waitUntil: "domcontentloaded" });
    if (!response?.ok()) throw new Error("Product demo page failed to load: " + path);
    if (!(await page.title()).trim()) throw new Error("Product demo has no title: " + path);
  }

  const phoneResponse = await page.goto("http://127.0.0.1:8787/phone-agent.html", { waitUntil: "domcontentloaded" });
  if (!phoneResponse?.ok()) throw new Error("Phone agent demo page failed to load");
  const phoneText = await page.locator("body").innerText();
  if (!phoneText.includes("Demo mode") || !phoneText.includes("real phone number")) {
    throw new Error("Phone demo must clearly disclose that live carrier routing is not connected");
  }

  const suiteResponse = await page.request.get("http://127.0.0.1:8787/product-suite.html");
  if (!suiteResponse.ok()) throw new Error("Product suite page failed to load");
  const suiteHtml = await suiteResponse.text();
  for (const label of ["AI Receptionist", "Recovery Desk", "QuoteFlow", "Reactivate", "AI Phone Agent", "Lead Radar", "Sales Agent"]) {
    if (!suiteHtml.includes(label)) throw new Error("Product suite is missing tab: " + label);
  }

  const onboardingResponse = await page.request.get("http://127.0.0.1:8787/onboarding.html");
  if (!onboardingResponse.ok()) throw new Error("Business onboarding page failed to load");
  const onboardingHtml = await onboardingResponse.text();
  for (const label of ["Main public business number", "How should calls reach DealSpark?", "Do not change your phone settings yet"]) {
    if (!onboardingHtml.includes(label)) throw new Error("Onboarding is missing phone-connection safeguard: " + label);
  }

  // Product workspace: exercise the real dashboard UI against mocked API responses.
  let mockItems = [{
    id: "existing-item",
    product: "LeadFlow",
    item: "Missed inquiry",
    issue: "Call back the customer",
    status: "needs_review",
    created_at: new Date().toISOString()
  }];
  await page.addInitScript(() => {
    localStorage.setItem("dealspark_dashboard_key", "smoke-test-public-key");
    localStorage.setItem("ds_token", "smoke-test-session-token");
  });
  await page.route("https://dealspark-test-api.pages.dev/api/account", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      business: { name: "Smoke Test Business", phone: "+14165550123" },
      subscription: { plan: "leadflow", status: "active", current_period_end: null },
      effective_status: "active",
      locked: false,
      leads: []
    })
  }));
  await page.route("https://dealspark-test-api.pages.dev/api/items", async route => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, items: mockItems }) });
    }
    const body = route.request().postDataJSON();
    const item = { id: "created-item", product: body.product, item: body.item, issue: body.issue, status: "needs_review", created_at: new Date().toISOString() };
    mockItems.unshift(item);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: item.id }) });
  });
  await page.route(/https:\/\/dealspark-test-api\.pages\.dev\/api\/items\/[^/]+\/(approve|dismiss)$/, async route => {
    const action = route.request().url().endsWith("/approve") ? "approve" : "dismiss";
    const id = route.request().url().split("/").slice(-2)[0];
    mockItems = mockItems.map(item => item.id === id ? { ...item, status: action === "approve" ? "approved" : "dismissed" } : item);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id, status: action === "approve" ? "approved" : "dismissed", external_action_executed: false }) });
  });
  const dashboardResponse = await page.goto("http://127.0.0.1:8787/dashboard.html", { waitUntil: "domcontentloaded" });
  if (!dashboardResponse?.ok()) throw new Error("Dashboard failed to load");
  await page.locator("#opsSection").waitFor({ state: "visible" });
  if (await page.locator("#opsProduct option").count() !== 1) throw new Error("Standalone plan product scoping failed");
  await page.locator("#opsItem").fill("Smoke test lead");
  await page.locator("#opsIssue").fill("Call back and record the outcome");
  await page.locator("#opsForm button[type=submit]").click();
  await page.waitForFunction(() => document.getElementById("opsMsg").textContent.includes("Work item saved"));
  if (!(await page.locator("#opsItems").innerText()).includes("Smoke test lead")) throw new Error("Operations queue create/read flow failed");
  await page.locator('#opsItems button[data-ops-action="approve"]').first().click();
  await page.waitForFunction(() => document.getElementById("opsMsg").textContent.includes("No external system was changed"));
  if (!(await page.locator("#opsItems").innerText()).includes("approved")) throw new Error("Operations queue approval flow failed");

  await browser.close();
  console.log("DealSpark product UI smoke test: PASS (chat, recovery desk, 10 product demo pages, phone demo disclosure, product suite tabs, and onboarding safeguards)");
} finally {
  server.kill("SIGTERM");
}
