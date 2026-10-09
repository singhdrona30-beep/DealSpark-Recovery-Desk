# DealSpark Product Readiness Audit

Audit date: 2026-10-09
Scope: GitHub repository, Cloudflare Pages/Workers configuration, D1 lead and notification records, recent GitHub Actions results, LiveKit/telephony documentation.

## Executive decision

**Do not sell DealSpark as a fully live, unattended business phone and automation service yet.** The core voice agent has saved real test-call leads, but email notifications failed with Resend HTTP 403, business phone routing is not automatically provisioned, the payment webhook secret is blank in the Cloudflare Pages project configuration, and most non-voice product actions are recorded in an internal queue rather than executed against external business systems.

## Verified state

- LiveKit agent deployment workflow: recent deployment completed successfully.
- Real test calls: D1 contains saved voice leads, including caller details and service requests.
- Notification tracking: D1 recorded three failed email attempts with error `resend_http_403`, including after the User-Agent change. Resend API logs show the exact cause: the account is in testing mode and can only send to its own verified account email (`singhdrona@yahoo.ca`); sending to `dealspark@agentmail.to` is rejected until a domain is verified and the `from` address uses that domain. This is an account restriction, not a request-header problem. No successful production notification has been verified.
- Backend deployment: GitHub Actions deployed the `dealspark-api` Worker successfully for commit `2a5f942`.
- Voice simulation test: the transcript contains `[call] save_call_lead(...)` and a successful lead-save tool result, but the LiveKit CLI's LLM summary incorrectly reported that no tool call occurred. The workflow was updated to verify transcript evidence directly.
- Business onboarding: settings can be saved, but the form does not create or verify a phone carrier route. It must never mark phone service active merely because settings were saved.
- Stripe webhook: `functions/api/stripe-webhook.js` rejects events when `STRIPE_WEBHOOK_SECRET` is missing. Cloudflare Pages production configuration currently shows this secret as an empty value. The connected Stripe live account has an endpoint configured, but its signing secret is not available in the Pages configuration. D1 currently shows one `starter/setup` subscription and zero active subscriptions. Payment activation is not considered verified until the signing secret is configured and a test checkout/webhook succeeds.
- Product action API: `functions/api/items/[id]/[action].js` explicitly returns `external_action_executed:false`. Approving an item creates an internal action-queue record; it does not itself pay a bill, change inventory, schedule a worker, send a review request, or update a third-party platform.
- Customer acquisition workflow: `customer-engine.yml` searches public GitHub repositories and drafts outreach. That is not equivalent to finding verified local businesses or sending emails; the send step is intentionally gated until a real provider integration is configured.
- Deployment pipeline: Cloudflare Pages had been skipping API updates because its path filter was misconfigured. The filter now explicitly lists the `functions/` routes, and the updated onboarding function deployment completed successfully for commit `e3787e0`. The Pages health route responds with `ok:true` and `database:connected`; the protected onboarding endpoint returns HTTP 401 when no business key is supplied, as expected.
- UI smoke test: the expanded production smoke suite passed on commit `378a3ac`. It verifies the chat/recovery pages, all ten individual product demo pages, the phone demo disclosure, suite tabs, and onboarding safeguards. It is a UI smoke test, not proof that each external business integration works.

## Product-by-product readiness

| Product / capability | Current evidence | Status |
|---|---|---|
| AI Virtual Receptionist | LiveKit agent is deployed; test calls saved lead records | **Partially working; not production-ready** |
| Lead notifications | Resend request previously failed with HTTP 403; retry after code change still required | **Blocked** |
| Business phone onboarding | Saves business data and preferred connection method; does not configure carrier routing | **Not connected** |
| Recovery Desk | D1-backed lead APIs and status workflow exist; end-to-end tenant isolation and production browser testing still required | **Partial; verify before sale** |
| Website/chat lead capture | Public API routes and chatbot UI exist; run production end-to-end test and verify tenant routing | **Unverified in production** |
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
| Stripe subscriptions | Webhook code exists but production signing secret is empty in Cloudflare Pages config | **Payment activation unverified** |

## Existing-number strategy

A customer should not have to change or publicly replace their main business number. The intended supported connection methods are:

1. **Conditional call forwarding** from the existing number to a dedicated DealSpark inbound destination. The customer keeps their main number, but carrier forwarding charges may apply. A separate destination per business is needed unless the carrier sends reliable business-specific routing metadata.
2. **SIP trunk / BYOC** from the customer's carrier or PBX into LiveKit. This is the preferred route for customers with compatible phone systems because routing can preserve business identity without porting the public number.
3. **Programmable voice provider** with a tenant-specific inbound route and signed webhooks.

Do not instruct a customer to enable forwarding until DealSpark has provisioned a dedicated destination and tested the full route. A single shared inbound number cannot safely identify multiple customers when forwarded calls do not carry the originally dialed business number.

LiveKit's native Phone Numbers service currently offers US local/toll-free numbers; Canadian businesses need a compatible third-party carrier/SIP route or another supported arrangement. See the official LiveKit telephony docs: https://docs.livekit.io/telephony/ and https://docs.livekit.io/telephony/start/sip-trunk-setup/.

## Cost reality

- LiveKit's published Build tier is $0/month and includes one US local number, 50 inbound US-local minutes, 1,000 agent-session minutes, and inference credits. Those are limited test allowances, not unlimited commercial capacity.
- Published usage-based example pricing is approximately $0.0479/minute for the selected example stack; actual cost changes with the chosen model, observability, telephony provider, and call route. Extra US numbers and usage can add charges.
- Third-party SIP/voice provider numbers, forwarding minutes, and international/Canadian call routes can incur separate charges.
- Production email delivery needs a working authorized sender/provider. The current Resend setup has no verified domain, and delivery has not been proven.
- No customer-facing plan should promise unlimited calls or unlimited automation until unit costs and usage caps are set.

Official pricing reference: https://livekit.com/pricing

## Release gates before accepting paying phone customers

- [ ] Confirm the updated Pages onboarding function is deployed and returns `phone_connection_status: not_connected` until a route is actually tested.
- [ ] Verify a real inbound call reaches the correct tenant-specific agent through the proposed customer-number path.
- [ ] Confirm the lead is saved with the correct business ID and that notification delivery succeeds; test and log failure handling.
- [ ] Verify Stripe test checkout, signature verification, subscription provisioning, renewal, and cancellation after setting the correct webhook secret in Cloudflare.
- [ ] Add tenant-specific phone route provisioning, status checks, and rollback instructions.
- [ ] Replace misleading demo-only statuses with explicit demo labels; keep external actions disabled until their provider integrations are implemented and tested.
- [ ] Run browser tests against the deployed website and Pages API, not only local static files.
- [ ] Establish data retention, customer consent, caller disclosure, escalation, privacy, and support procedures before launch.

## Current safe claim

DealSpark has a working voice-agent prototype that can save test-call lead records. It is **not yet a verified turnkey phone system or a set of fully integrated business automations**.
