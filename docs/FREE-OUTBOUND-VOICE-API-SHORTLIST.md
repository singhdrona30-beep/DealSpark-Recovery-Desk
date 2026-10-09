# DealSpark — Free outbound voice API shortlist

Updated: 2026-10-08

## Best next test: Siptel Voice API
- Signup: https://siptel.ai/register
- Voice API overview and sample outbound call: https://siptel.ai/products/voice
- Public offer: €5 free credits, no credit card required; outbound REST API; coverage advertised in 60+ countries.
- Public API example uses POST https://api.siptel.ai/v1/voiceapi/call with a destination, caller ID, and webhook URL.
- Important: this is a limited trial credit, not unlimited free outbound calling. Confirm caller-ID requirements and that Canada is enabled in the account before integration. Do not assume a number is included for free.

## Free integration sandbox: Dollu
- Signup / sandbox request: https://dollu.com/developers
- Public offer: free sandbox, no card; request is reviewed/provisioned by a human, with key promised within one business day.
- Sandbox limits shown publicly: 50 calls/day, 2 concurrent, 5 minutes each. Calls to verified personal numbers receive real PSTN traffic; other destinations are simulated. Production requires KYC and prepaid top-up or approved credit terms.
- Good for building and testing the GitHub/Cloudflare webhook flow with our own verified number, but it is NOT a free production marketing dialer.

## Alternative: India-focused free test minutes
- MessageBot: https://messagebot.in/services/voice
- Public page advertises 100 free voice minutes without a credit card. Confirm country eligibility, KYC, outbound destinations, and whether the credits work for calls to Canadian numbers before relying on it.

## Recommendation
1. Create a Siptel account and confirm the dashboard shows the €5 credit and allows a call to a phone number we control.
2. If Siptel signup or destination permissions block the test, request Dollu sandbox and use only a verified personal number for real call testing.
3. Only after a real test succeeds, integrate provider-specific outbound call creation and signed webhook verification into the Cloudflare Worker. Do not put API keys in the public GitHub Pages Phone Lab or client-side code.
4. Keep marketing outreach compliant: identify DealSpark clearly, respect opt-outs, and don't make bulk automated calls without checking applicable consent/telemarketing rules.

## Existing DealSpark gateway
- Health: https://dealspark-phone-gateway.singhdrona30.workers.dev/health
- Voice webhook: https://dealspark-phone-gateway.singhdrona30.workers.dev/voice
- Current status: webhook-ready, not carrier-connected; live calling is not enabled.
