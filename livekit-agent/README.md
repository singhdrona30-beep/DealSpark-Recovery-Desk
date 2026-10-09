# DealSpark LiveKit receptionist

This is the voice-agent runtime for DealSpark. It uses LiveKit Inference for speech-to-text, language understanding, and speech generation.

## Important architecture note

The Cloudflare Worker is the phone gateway and status endpoint; it cannot host the long-running LiveKit Agents Python runtime. Deploy this folder as a LiveKit Cloud Agent, then connect a supported phone/SIP provider and configure inbound dispatch. The existing Cloudflare `/voice` route is only a demo XML greeting and is not connected to this agent.

## Deploy

1. Install the LiveKit CLI and authenticate with your LiveKit Cloud project.
2. From this folder, install dependencies (for example, `pip install -r requirements.txt`).
3. Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` as environment variables or in a local `.env.local` file. Never commit credentials.
4. Run a development test with `lk agent dev` from this folder.
5. Deploy the agent with the current LiveKit CLI deployment flow (`lk agent create` from the agent project directory), then confirm it appears in the LiveKit Cloud Agents dashboard.
6. Configure a phone number/SIP trunk to route inbound calls to the LiveKit project and dispatch this agent.

The API key and secret must be stored as secrets. If a key has been exposed in logs or a public location, rotate it before production use.

## Current limitations

- No carrier/phone number is connected by this source file alone.
- Appointment booking, lead storage, SMS, and owner notifications require separate integrations.
- Do not tell callers an appointment is confirmed or their information was delivered until those integrations report success.
