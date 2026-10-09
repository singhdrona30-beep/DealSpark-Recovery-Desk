# DealSpark + Fongo Free Number Gateway — Supported Design

Updated: 2026-10-08

## What we can build for free
- Keep the existing Cloudflare Worker as DealSpark's own application gateway for webhooks, routing logic, and future carrier integrations.
- Keep browser-to-browser WebRTC in Phone Lab for free internet audio demos (not public telephone-network calling).
- Use the Fongo Works free business number through Fongo's official companion app for manual inbound/outbound calling.
- Use Fongo's built-in automated receptionist and supported forwarding to a Canadian cellphone for real inbound calls.

## Important Fongo restriction
Fongo's official support says it does not provide SIP credentials for Fongo Works accounts:
https://support.fongo.com/hc/en-us/articles/4407853830292-Can-I-be-given-SIP-credentials-so-that-I-can-set-up-my-own-Fongo-Works-Pro-Device

Fongo's official product page lists a local number, automated receptionist, mobile app, voicemail, and forwarding to a cellphone in the free tier:
https://www.fongo.com/services/fongo-works/

Fongo also documents that its companion app can make outgoing calls using the Fongo Works business caller ID:
https://www.fongo.com/services/fongo-works/devices/fongo-works-companion-app/

Therefore, do not try to capture credentials, reverse engineer app traffic, impersonate Fongo's service, or route around its restrictions. Without a documented Fongo webhook/API or SIP access, the free Fongo number cannot be directly attached to our Cloudflare gateway as an automated carrier trunk.

## Supported initial setup
1. Configure the Fongo Works receptionist greeting in the Fongo dashboard.
2. Add the owner's Canadian mobile number as a supported forwarding destination if desired; test forwarding manually.
3. Install/log in to the official Fongo Works companion app and make an outbound test call from that app.
4. Use the Phone Lab's Fongo manual-call helper to copy the prospect number and compliant call script, then dial in Fongo.
5. Use the Phone Lab's browser-to-browser WebRTC feature only for internet audio demos. It is not a phone number or PSTN connection.
6. Keep the Cloudflare gateway disconnected from Fongo until Fongo publishes or explicitly grants a supported integration interface.

## Architecture
- Browser demo: Phone Lab -> WebRTC -> second browser (internet audio only)
- Free business number: caller -> Fongo's hosted receptionist -> Fongo app / supported cellphone forwarding
- DealSpark app gateway: Cloudflare Worker -> future supported voice API (not connected yet)

## Current status
- Cloudflare gateway exists, but is not connected to a carrier.
- Fongo number is not connected to Cloudflare.
- Phone Lab includes manual Fongo calling helper and a WebRTC browser-to-browser demo.
- No automated PSTN calls have been verified.

## Next test checklist
- [ ] In Fongo Works dashboard, verify the number is active.
- [ ] Call the Fongo number from a separate phone and confirm the greeting plays.
- [ ] Verify the official Fongo app can make an outbound call and shows the business caller ID.
- [ ] Test supported forwarding to the owner's Canadian mobile number, if wanted.
- [ ] Record the result and any error; never post passwords, verification codes, or API keys in GitHub.
