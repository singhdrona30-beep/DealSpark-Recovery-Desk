# DealSpark Product Readiness Audit

Audit date: 2026-10-09
Scope: GitHub repository, Cloudflare Pages/Workers configuration, D1 lead and notification records, recent GitHub Actions results, LiveKit/telephony documentation.

## Executive decision

**Do not sell DealSpark as a fully live, unattended business phone and automation service yet.** The core voice agent has saved real test-call leads, but customer email notifications remain blocked by Resend testing-mode restrictions, per-customer phone destinations are not automatically provisioned, live subscription activation has not been verified with a checkout, and most non-voice product actions are recorded in an internal queue rather than executed against external business systems.

## Verified state

- LiveKit agent deployment workflow: recent deployment completed successfully.
- Real test calls before the tenant-routing change saved lead records. After the change, the LiveKit agent deployment and synthetic route-handoff workflow succeeded: the configured demo dialed number resolves to the demo tenant, and a phone call with no dialed number is rejected with HTTP 422. This is a route/API simulation, not a fresh real-phone call after the routing change.
- Notification tracking: D1 shows eight failed email attempts, zero successful sends: seven `resend_http_403` failures and one `missing_business_notification_email`. Resend's response confirms the account is in testing mode and restricts delivery to its own verified account address. There is no verified sending domain, so notifications to a customer's business inbox are not production-ready. The User-Agent change alone did not fix this.
- Backend deployment: GitHub Actions deployed the `dealspark-api` Worker successfully with tenant-safe phone routing and notification error classification.
- Voice simulation test: the transcript contains `[call] save_call_lead(...)` and a successful lead-save tool result, but the LiveKit CLI's LLM summary incorrectly reported that no tool call occurred. The workflow was updated to verify transcript evidence directly.
- Business onboarding: saving settings does not connect a carrier route and never marks phone service active. A double-escaped regular expression that previously prevented proper phone-number normalization was fixed; the shared helper is now covered by smoke assertions for formatted North American and E.164-style numbers. The API also rejects self-forwarding loops and phone numbers already assigned to another business. The voice backend resolves SIP calls by the dialed number and rejects missing or ambiguous routes rather than falling back to the demo tenant. The current demo destination must not be reused for customer tenants.
- Stripe webhook: the live account had a webhook endpoint whose signing secret was not configured in Pages. A new live endpoint was created for the same URL, its signing secret was added to Cloudflare Pages, and the updated Pages function deployed successfully; the old endpoint was disabled. The Pages API hides secret values on read-back, so the environment value cannot be independently displayed. No paid checkout was run because that would create a real subscription charge. D1 currently shows one `starter/setup` subscription and zero active subscriptions, so payment activation still needs a controlled end-to-end checkout test before customers are accepted.
- Product action API: `functions/api/items/[id]/[action].js` explicitly returns `external_action_executed:false`. The dashboard now exposes the persistent operations queue for the ten standalone tools and bundles, with create, approve, and dismiss actions. Approving an item creates an internal action-queue record; it does not itself pay a bill, change inventory, schedule a worker, send a review request, or update a third-party platform.
- Product-suite plan access: the product-state API originally mapped only the legacy `starter/growth/pro/business` plans, so individual product and bundle subscriptions could be blocked from the suite. A plan-to-feature map for all current individual products and bundles has now been added and deployed. The public Product Suite's DealSpark Complete savings text was also corrected to match the published price list ($130/month savings).
- Customer acquisition workflow: `customer-engine.yml` searches public GitHub repositories and drafts outreach. That is not equivalent to finding verified local businesses or sending emails; the send step is intentionally gated until a real provider integration is configured.
- Deployment pipeline: the Cloudflare Pages workflow now explicitly includes the `functions/` API routes and the onboarding smoke test is triggered when `functions/api/onboarding.js` changes. The latest Pages deployment completed successfully on commit `3c7a4ab`; the Pages health route reports `database:connected`, and the protected onboarding endpoint rejects missing business keys.
- UI smoke test: the latest production smoke workflow passed on commit `3c7a4ab` for chat/recovery, all ten product demo pages, phone-demo disclosures, suite tabs, onboarding safeguards, chatbot submission, non-booking appointment requests, dashboard queue create/approve, and phone normalization. The run recorded zero browser console errors after core pages and all ten demos were moved to the shared credential-free analytics script. These are local browser/API-mock tests, not proof that external business integrations work.

## Product-by-product readiness

| Product / capability | Current evidence | Status |
|---|---|---|
| AI Virtual Receptionist | LiveKit agent is deployed; test calls saved lead records | **Partially working; not production-ready** |
| Lead notifications | Eight failed delivery attempts, zero successful sends; Resend test-mode restriction confirmed | **Blocked** |
| Business phone onboarding | Normalizes numbers, rejects duplicate/self-forwarding routes, saves settings; does not provision a carrier route | **Not connected** |
| Recovery Desk | D1-backed lead APIs and status workflow exist; end-to-end tenant isolation and production browser testing still required | **Partial; verify before sale** |
| Website/chat lead capture | Chatbot now targets the active Worker, waits for API confirmation, and does not mark appointment requests as booked; browser regression test is pending | **Code fixed; test pending** |
| QuoteFlow / QuotePilot | Quote requests can be queued; external quoting/CRM action is not implemented as a verified integration | **Demo / internal workflow** |
| Reactivate | Win-back opportunities can be queued; no verified consent-aware SMS/email campaign execution | **Demo / internal workflow** |
| ScheduleFlow | Scheduling demo and appointment data structures exist; live calendar availability and booking authorization are not verified | **Demo / internal workflow** |
| DispatchDesk | Operational queue exists; no verified dispatch-system integration | **Demo / internal workflow** |
| AssetCare | Operational queue exists; no verified asset/maintenance system integration | **Demo / internal workflow** |
| BillGuard | Operational queue exists; no verified accounting/payment integration | **Demo / internal workflow** |
| StockWatch | Operational queue exists; no verified inventory/POS integration | **Demo / internal workflow** |
| StaffDesk | Operational queue exists; no verified payroll/HR/calendar integration | **Demo / internal workflow** |
| ReviewShield | Operational queue exists; no verified review-platform integration | **Demo / internal workflow** |
| OpsVault | Operational queue exists; no verified external operations integration | **Demo / internal workflow** |
| LeadFlow | Leads can be stored/queued; verified external CRM sync and automated outreach are not established | **Demo / internal workflow** |
| Lead Radar / Sales Agent | Product UI exists; automated prospecting is not yet a verified, compliant outbound sales system | **Partial / draft-only** |
| Stripe subscriptions | Live webhook endpoint and signing secret were refreshed and deployed; no paid checkout test has been run | **Payment activation unverified** |

## Existing-number strategy

A customer should not have to change or publicly replace their main business number. The intended supported connection methods are:

1. **Conditional call forwarding** from the existing number to a dedicated DealSpark inbound destination. The customer keeps their main number, but carrier forwarding charges may apply. A separate destination per business is needed unless the carrier sends reliable business-specific routing metadata.
2. **SIP trunk / BYOC** from the customer's carrier or PBX into LiveKit. This is the preferred route for customers with compatible phone systems because routing can preserve business identity without porting the public number.
3. **Programmable voice provider** with a tenant-specific inbound route and signed webhooks.

Do not instruct a customer to enable forwarding until DealSpark has provisioned a dedicated destination and tested the full route. A single shared inbound number cannot safely identify multiple customers when forwarded calls do not carry the originally dialed business number.

LiveKit's native Phone Numbers service currently offers US local/toll-free numbers; Canadian businesses need a compatible third-party carrier/SIP route or another supported arrangement. See the official LiveKit telephony docs: https://docs.livekit.io/telephony/ and https://docs.livekit.io/telephony/start/sip-trunk-setup/.

## Cost reality

- LiveKit's published Build tier is $0/month and includes one US local number, 50 inbound US-local minutes, 1,000 agent-session minutes, and $2.50 of inference credits. Ship starts at $50/month and includes one US local number, 100 inbound minutes, 5,000 agent-session minutes, and $5 of inference credits; additional US local numbers are $1/month each and usage can add charges.
- Using the current agent's published model selections (Gemma 4 31B, Deepgram Nova-3, Cartesia Sonic 3) plus LiveKit's listed agent-session, telephony, and observability rates, a rough post-allowance estimate is about $0.0662/minute. Actual charges depend on plan allowances and the call route; Canadian carrier/SIP fees may be additional.
- Third-party SIP/voice provider numbers, forwarding minutes, and international/Canadian call routes can incur separate charges.
- Production email delivery needs a working authorized sender/provider. The current Resend setup has no verified domain, and delivery has not been proven.
- No customer-facing plan should promise unlimited calls or unlimited automation until unit costs and usage caps are set.

Official pricing reference: https://livekit.com/pricing

## Release gates before accepting paying phone customers

- [x] Updated Pages onboarding function is deployed; it does not claim phone activation merely because settings are saved.
- [ ] Verify a real inbound call reaches the correct tenant-specific agent through the proposed customer-number path.
- [ ] Confirm the lead is saved with the correct business ID and that notification delivery succeeds; test and log failure handling.
- [ ] Verify Stripe test checkout, signature verification, subscription provisioning, renewal, and cancellation with a controlled test-mode checkout.
- [ ] Add tenant-specific phone route provisioning, status checks, and rollback instructions.
- [x] All ten individual product demo pages clearly label demo/sample mode; external actions remain disabled until provider integrations are implemented and tested.
- [ ] Run a live interactive test against the deployed website and Pages API with a controlled test tenant; current Playwright smoke tests use mocked APIs.
- [ ] Establish data retention, customer consent, caller disclosure, escalation, privacy, and support procedures before launch.

## Current safe claim

DealSpark has a working voice-agent prototype that can save test-call lead records. It is **not yet a verified turnkey phone system or a set of fully integrated business automations**.

## Latest follow-up after the initial audit

- Shared analytics: migrated the main product pages and all ten standalone product demos away from the old credentialed beacon, which caused browser CORS errors and duplicate page-view records. The latest smoke run had zero browser console errors.
- Phone onboarding safety: fixed number normalization, added collision protection for business phone routes, rejected a call-forwarding destination that equals the public number, and changed the button label to “Save configuration” so saving cannot be mistaken for live activation.
- Live checks: both the Worker health endpoint and Pages API health endpoint respond successfully; the Pages API reports its database connected. The current UI smoke test passed. No real customer carrier route has been provisioned or retested with a live call after tenant-specific routing was introduced.
- Billing: Stripe has 15 active live-mode payment links with matching product-plan metadata and recurring USD prices. No checkout was run because that would create a real charge; there are zero active subscriptions in D1 and one setup subscription. Treat payment activation as unverified.
- Notification count at last D1 check: 0 sent, 8 failed. The current sender cannot deliver production alerts to customer inboxes until a verified sending domain/provider is configured.

## Existing-number implementation cost estimate

- Do not port a customer's public number as the default. Preferred MVP is conditional forwarding from the existing number to a dedicated inbound destination per customer; compatible carriers/PBXs may instead use SIP/BYOC while retaining the public number.
- LiveKit's Build plan is listed at $0/month with one US local number, 50 US-local inbound minutes, 1,000 agent-session minutes, $2.50 of inference credits, and 1,000 third-party SIP minutes. Ship starts at $50/month and increases the included allowances; additional US local numbers are listed at $1/month. Usage outside allowances is extra. Official pricing: https://livekit.com/pricing
- Twilio's Canada SIP trunking page lists local inbound origination starting at $0.0045/min and a local number at $1.15/month, before LiveKit usage/model charges or the customer's carrier forwarding fees. Official pricing: https://www.twilio.com/en-us/sip-trunking/pricing/ca
- The currently configured voice models are estimated at roughly $0.0662 per connected minute after allowances, before any separate Canadian carrier costs. The actual margin needs to be measured against real call lengths and plan allowances.
- Production email: budget for a domain the business controls (price varies by registrar) and verify it in Resend, or implement and test a different authorized mail provider. No domain has been purchased by this audit.
- No number, domain, plan upgrade, or other paid service was purchased during this work.
