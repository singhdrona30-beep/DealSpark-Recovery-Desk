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
  await page.locator("#chatForm button").click();
  await page.locator("#chatInput").fill("Test Customer");
  await page.locator("#chatForm button").click();
  await page.locator("#chatInput").fill("555-0199");
  await page.locator("#chatForm button").click();
  await page.waitForTimeout(800);
  const chatText = await page.locator("#messages").innerText();
  if (!chatText.includes("captured") && !chatText.includes("follow up")) throw new Error("Chatbot lead capture flow failed");

  // Product 2: AI Lead Recovery Engine
  await page.goto("http://127.0.0.1:8787/lead-recovery.html", { waitUntil: "networkidle" });
  if (await page.title() !== "DealSpark — AI Lead Recovery Engine Demo") throw new Error("Recovery Desk title failed");
  if (await page.locator("#new").textContent() !== "1") throw new Error("Recovery Desk initial New count failed");
  if (await page.locator("#follow").textContent() !== "1") throw new Error("Recovery Desk initial Follow-up count failed");
  if (await page.locator("#qualified").textContent() !== "1") throw new Error("Recovery Desk initial Qualified count failed");
  if (await page.locator("#booked").textContent() !== "1") throw new Error("Recovery Desk initial Booked count failed");
  await page.locator('button[data-action="sms"]').first().click();
  await page.locator('button[data-action="email"]').first().click();
  await page.locator('button[data-action="call"]').first().click();
  await page.locator("#addLead").click();
  if (await page.locator(".lead").count() !== 5) throw new Error("Recovery Desk add-lead flow failed");

  // Product 3: QuoteFlow
  await page.goto("http://127.0.0.1:8787/quote-flow.html", { waitUntil: "networkidle" });
  if (!await page.title().then(t => t.includes("QuoteFlow"))) throw new Error("QuoteFlow title failed");
  await page.locator("#name").fill("Test Customer");
  await page.locator("#contact").fill("test@example.com");
  await page.locator("#quoteBtn").click();
  if (!await page.locator("#result").evaluate(el => el.classList.contains("show"))) throw new Error("QuoteFlow estimate failed");
  await page.locator("#bookBtn").click();
  if (!(await page.locator("#status").innerText()).includes("Appointment request created")) throw new Error("QuoteFlow booking flow failed");

  // Product 4: Reactivate
  await page.goto("http://127.0.0.1:8787/reactivate.html", { waitUntil: "networkidle" });
  if (!await page.title().then(t => t.includes("Reactivate"))) throw new Error("Reactivate title failed");
  await page.locator(".customer").first().click();
  await page.locator("#build").click();
  if (!(await page.locator("#preview").innerText()).includes("Suggested outreach")) throw new Error("Reactivate message build failed");
  await page.locator("#send").click();
  if (await page.locator("#contacted").innerText() !== "1") throw new Error("Reactivate send flow failed");
  await page.locator("#reply").click();
  if (!(await page.locator("#won").innerText()).includes("$720")) throw new Error("Reactivate revenue flow failed");

  await browser.close();
  console.log("DealSpark production smoke test: PASS");
} finally {
  server.kill("SIGTERM");
}
