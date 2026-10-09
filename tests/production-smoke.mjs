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
  if (await page.title() !== "DealSpark AI Lead Recovery | Follow-Up & Conversion") throw new Error("Recovery Desk title failed");
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

  await browser.close();
  console.log("DealSpark product UI smoke test: PASS (chat, recovery desk, 10 product demo pages, phone demo disclosure, product suite tabs, and onboarding safeguards)");
} finally {
  server.kill("SIGTERM");
}
