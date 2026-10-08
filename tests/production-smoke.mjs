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

  await browser.close();
  console.log("DealSpark production smoke test: PASS");
} finally {
  server.kill("SIGTERM");
}
