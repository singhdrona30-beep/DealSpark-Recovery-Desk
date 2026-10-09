# DealSpark: free phone provider recommendation

Checked: 2026-10-08

## Recommendation to test first: Bandwidth Build

Official signup: https://www.bandwidth.com/build-sign-up/
Official voice quick start: https://dev.bandwidth.com/docs/voice/programmable-voice/quickStart/

Bandwidth Build is the strongest next trial to test because its official signup page advertises:
- 3,000 preloaded trial credits for Voice API usage
- One US local phone number included
- No credit card and no sales call required to start
- Voice API and SIP trunking access

Important limits:
- The included number is a US number, not a Canadian local number.
- Trial calls are limited to the account's verified mobile number; the trial has call/concurrency limits.
- The 3,000 credits are trial usage, not unlimited calling or SMS. A payment method/additional credits are needed after they are used.
- Do not assume Canadian number provisioning, worldwide PSTN access, or SMS is free under this developer trial. Confirm in the signup dashboard before investing setup time.
- This is a candidate for a controlled proof-of-concept, not yet a production/tender-ready phone service.

## Why not self-host only?

Open-source software such as FreePBX or Fonoster can provide PBX/API software, but it does not by itself provide telephone numbers or carrier interconnect. Reaching ordinary mobile/landline numbers still requires a carrier or SIP trunk, which may cost money.

## DealSpark next steps

1. Sign up for Bandwidth Build using the official link above; do not enter payment details unless you explicitly decide to.
2. Confirm the trial provisions the US number and displays available credits.
3. Confirm your Canadian mobile/Fongo number can be used as the verified test destination. Do not share verification codes or account secrets in GitHub.
4. Only after the account is active, connect its documented voice webhook to the DealSpark gateway. The current gateway returns Twilio-style TwiML, so it must be adapted to Bandwidth XML (BXML) before connecting Bandwidth; do not point Bandwidth at the current /voice endpoint yet.
5. Run a short test and verify the greeting is heard on a real phone.
6. Before customer use, add provider webhook signature verification, logging, consent/opt-out handling, and owner notifications.

## Sources

- Bandwidth Build free signup and limits: https://www.bandwidth.com/build-sign-up/
- Bandwidth Voice API quick start: https://dev.bandwidth.com/docs/voice/programmable-voice/quickStart/
- Bandwidth Programmable Voice API: https://dev.bandwidth.com/docs/voice/programmable-voice/
- Open-source Fonoster project and its scope: https://github.com/fonoster/fonoster
