# Next free phone option to test: Voice Elements

Official free Voice API signup: https://www.voiceelements.com/signup-free-voice-api/
Official free SMS API signup: https://www.voiceelements.com/signup-free-sms-api/

## Why this is next
The official Voice Elements page advertises a provider-issued demo phone number, 100 free test minutes, voice-AI/call-flow support, and no credit card requirement. This is closer to the programmable carrier/API needed for DealSpark than a hosted receptionist.

## What is not confirmed
The public signup page does not clearly state whether account creation requires a personal phone number or whether Canadian account registration is supported. Do not claim this is verified until signup proves it. If the form asks for a US phone number, stop and do not enter a fake number.

## Alternative if we only need a Canadian number and live demo
1n1.ai advertises a Canadian phone number and AI receptionist for 7 days / 60 minutes with no card, but it requires text verification of an existing phone and is a hosted receptionist rather than a carrier API for our own backend:
https://1n1.ai/

## DealSpark integration caution
The existing Cloudflare gateway returns Twilio-style TwiML. It is not automatically compatible with Voice Elements. Before connecting the provider, inspect its API docs and adapt the webhook/API call flow. Keep keys in Cloudflare secrets, never in GitHub. Test one real call before making any tender or production claims.
