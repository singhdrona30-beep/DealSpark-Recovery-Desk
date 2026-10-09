import { chromium } from "playwright";
import { spawn } from "node:child_process";

const server = spawn("python3", ["-m", "http.server", "8787"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  await sleep(800);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Product 1: website AI receptionist; mock the live API so tests never create production leads.
  let chatLeadPayloads = [];
  const chatCorsHeaders = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,x-dealspark-site-key" };
  await page.route("https://dealspark-api.singhdrona30.workers.dev/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: chatCorsHeaders });
    if (route.request().method() === "POST" && route.request().url().endsWith("/api/leads")) {
      chatLeadPayloads.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: "application/json", headers: chatCorsHeaders, body: JSON.stringify({ ok: true, id: "smoke-chat-lead-" + chatLeadPayloads.length }) });
    }
    return route.fallback();
  });
  await page.goto("http://127.0.0.1:8787/chatbot.html", { waitUntil: "networkidle" });
  if (await page.locator("#messages .msg").count() < 1) throw new Error("Chatbot greeting failed");
  await page.locator("#chatInput").fill("I need a plumber");
  await page.getByRole("button", { name: "Get a quote" }).click();
  await page.locator("#chatInput").fill("Test Customer");
  await page.locator("#chatForm button").click();
  await page.locator("#chatInput").fill("555-0199");
  await page.locator("#chatForm button").click();
  await page.waitForFunction(() => document.getElementById("messages").innerText.includes("sent your request"));
  const chatText = await page.locator("#messages").innerText();
  if (!/follow up|thank/i.test(chatText)) throw new Error("Chatbot lead capture confirmation failed");
  if (chatLeadPayloads.length !== 1 || chatLeadPayloads[0].status !== "New" || chatLeadPayloads[0].source !== "website-chatbot" || chatLeadPayloads[0].intent !== "quote") {
    throw new Error("Chatbot did not submit a new, unbooked lead to the active API");
  }

  await page.getByRole("button", { name: "Start another request" }).click();
  await page.getByRole("button", { name: "Book an appointment" }).click();
  await page.locator("#chatInput").fill("plumber");
  await page.locator("#chatForm button").click();
  await page.locator("#chatInput").fill("tomorrow");
  await page.locator("#chatForm button").click();
  await page.locator("#chatInput").fill("2 PM");
  await page.locator("#chatForm button").click();
  await page.locator("#chatInput").fill("Appointment Test Customer");
  await page.locator("#chatForm button").click();
  await page.locator("#chatInput").fill("555-0101");
  await page.locator("#chatForm button").click();
  await page.waitForFunction(() => document.getElementById("messages").innerText.includes("not a confirmed booking"));
  if (chatLeadPayloads.length !== 2 || chatLeadPayloads[1].status !== "New" || chatLeadPayloads[1].intent !== "appointment") {
    throw new Error("Chatbot incorrectly treated an appointment request as a confirmed booking");
  }

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
  const corsHeaders = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "x-dealspark-key,authorization,content-type" };
  await page.route("https://dealspark-test-api.pages.dev/api/account", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: corsHeaders,
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
      return route.fulfill({ status: 200, contentType: "application/json", headers: corsHeaders, body: JSON.stringify({ ok: true, items: mockItems }) });
    }
    const body = route.request().postDataJSON();
    const item = { id: "created-item", product: body.product, item: body.item, issue: body.issue, status: "needs_review", created_at: new Date().toISOString() };
    mockItems.unshift(item);
    return route.fulfill({ status: 200, contentType: "application/json", headers: corsHeaders, body: JSON.stringify({ ok: true, id: item.id }) });
  });
  await page.route(/https:\/\/dealspark-test-api\.pages\.dev\/api\/items\/[^/]+\/(approve|dismiss)$/, async route => {
    const action = route.request().url().endsWith("/approve") ? "approve" : "dismiss";
    const id = route.request().url().split("/").slice(-2)[0];
    mockItems = mockItems.map(item => item.id === id ? { ...item, status: action === "approve" ? "approved" : "dismissed" } : item);
    return route.fulfill({ status: 200, contentType: "application/json", headers: corsHeaders, body: JSON.stringify({ ok: true, id, status: action === "approve" ? "approved" : "dismissed", external_action_executed: false }) });
  });
  await page.route("https://dealspark-test-api.pages.dev/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
    return route.fallback();
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
  await page.waitForFunction(() => document.getElementById("opsItems").innerText().includes("approved"));
  if (!(await page.locator("#opsItems").innerText()).includes("approved")) throw new Error("Operations queue approval flow failed");

  // Onboarding form: make sure every field is sent, including fields whose names clash with window globals.
  let onboardingPayload = null;
  await page.route("https://dealspark-test-api.pages.dev/api/onboarding", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          business: { name: "Smoke Test Business", phone: "+14165550123" },
          subscription: { plan: "ai_virtual_receptionist", status: "active", current_period_end: null },
          config: { service_area: "", notification_email: "", services: "", opening_time: "08:00", closing_time: "18:00", greeting: "", forwarding_number: "", phone_connection_method: "not_decided", current_carrier: "" },
          phone_connection_status: "not_connected"
        })
      });
    }
    onboardingPayload = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, configuration_saved: true, activated: false, phone_connection_status: "not_connected" })
    });
  });
  const onboardingPage = await page.goto("http://127.0.0.1:8787/onboarding.html", { waitUntil: "domcontentloaded" });
  if (!onboardingPage?.ok()) throw new Error("Onboarding page failed to load for form test");
  await page.locator("#status").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.getElementById("status").textContent.includes("Payment active"));
  await page.locator("#name").fill("Smoke Test HVAC");
  await page.locator("#phone").fill("+14165550123");
  await page.locator("#area").fill("Toronto");
  await page.locator("#notify").fill("qa@example.com");
  await page.locator("#services").fill("HVAC repairs");
  await page.locator("#open").fill("07:00");
  await page.locator("#close").fill("19:00");
  await page.locator("#greeting").fill("Thanks for calling our HVAC team.");
  await page.locator("#forwarding").fill("+12402314013");
  await page.locator("#connection").selectOption("call_forwarding");
  await page.locator("#carrier").fill("Smoke Test Carrier");
  await page.locator("#setup button[type=submit]").click();
  await page.waitForFunction(() => document.getElementById("msg").textContent.includes("Business information saved"));
  if (!onboardingPayload || onboardingPayload.business_name !== "Smoke Test HVAC" || onboardingPayload.opening_time !== "07:00" || onboardingPayload.closing_time !== "19:00" || onboardingPayload.phone_connection_method !== "call_forwarding" || onboardingPayload.current_carrier !== "Smoke Test Carrier") {
    throw new Error("Onboarding did not submit all business and phone-routing fields correctly");
  }
  if (onboardingPayload.activated === true) throw new Error("Onboarding must not claim phone routing is activated");

  await browser.close();
  console.log("DealSpark product UI smoke test: PASS (chat, recovery desk, 10 product demo pages, phone demo disclosure, product suite tabs, and onboarding safeguards)");
} finally {
  server.kill("SIGTERM");
}
