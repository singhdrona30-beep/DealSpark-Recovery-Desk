# DealSpark Phone Gateway — current status and connection steps

## Current status

- A Cloudflare Worker named `dealspark-phone-gateway` has been deployed.
- Its public health endpoint is `https://dealspark-phone-gateway.singhdrona30.workers.dev/health`.
- Its demo voice webhook is `https://dealspark-phone-gateway.singhdrona30.workers.dev/voice`.
- `GET /voice` returns TwiML that asks a compatible telephony provider to say: “Hi, this is DealSpark. We are testing our new phone system. This is an automated test greeting.”
- The Worker itself does **not** place calls, send SMS, connect to Fongo, or use AI. A real call requires a programmable voice provider and a number that provider controls or supports.
- The Worker webhook currently has no provider signature validation and must not be treated as production-ready until signature validation and abuse controls are added.

## Fongo limitation

Fongo Works support says it does not provide SIP credentials for a custom PBX. Do not try to extract credentials or bypass the provider. Use the official Fongo Works app for the existing number, or choose a programmable carrier that supports webhooks.

## Zero-upfront test path

1. Sign in to the existing programmable voice account (Twilio was previously started).
2. Complete the provider's email/account verification, if still pending.
3. Verify the Fongo number as an allowed test recipient if the provider requires verified recipients.
4. Check the provider console for trial balance and an available voice-enabled trial number. Do not upgrade or purchase a number without explicit approval.
5. Configure the provider's inbound voice webhook to `https://dealspark-phone-gateway.singhdrona30.workers.dev/voice` using the provider's documented method.
6. Place one short test call only after the account shows a usable trial balance and the destination is verified. Trial providers may play their own trial notice and restrict destinations, call length, or caller ID.
7. Confirm the greeting is heard on the real phone. Then add provider signature validation, call logging, failure handling, and owner notifications before any tender or customer-facing claim.

## Trial-cost reality

A free trial can be useful for a controlled proof-of-concept, but it is not unlimited service. Phone numbers, call minutes, international routes, SMS, and AI speech/LLM services may incur charges after trial allowances or when the account is upgraded.

## Security

- Never put provider auth tokens, API keys, account SIDs, or personal verification codes in GitHub source files or public pages.
- Store provider credentials only in server-side secrets.
- Keep outbound dialing disabled until the number, consent/lead source, opt-out handling, and test call are verified.
- Do not advertise a live AI receptionist until an actual incoming call has been answered end-to-end and the lead/notification flow has been tested.
