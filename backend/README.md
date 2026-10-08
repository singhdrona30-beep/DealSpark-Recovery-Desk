# DealSpark Production Backend

The public GitHub Pages site is the customer-facing layer. The production API is a Cloudflare Worker backed by Cloudflare D1.

## What is implemented

- D1 schema for businesses, users, leads, conversations, appointments, reps and events.
- Public lead-ingest API for the website chatbot.
- Admin-protected lead listing, dashboard metrics and lead updates.
- Secured business bootstrap endpoint.
- Twilio webhook with Twilio signature verification.
- Conversation and appointment endpoints.
- CORS handling for the GitHub Pages frontend.
- GitHub Actions deployment workflow.
- Chatbot frontend now sends leads to the API when `DEALSPARK_API_BASE` and `DEALSPARK_SITE_KEY` are configured; it still keeps local demo storage as a fallback.

## API

- GET `/health`
- POST `/api/bootstrap` — admin only; creates a business and returns its public site key.
- POST `/api/leads` — public site-key protected lead ingestion.
- GET `/api/leads` — admin only.
- PATCH `/api/leads/:id` — admin only.
- GET `/api/dashboard` — admin only.
- POST `/api/conversations`
- POST `/api/appointments`
- POST `/api/webhooks/twilio`
- POST `/api/webhooks/email` — admin protected until a provider-specific signature validator is added.

## One-time Cloudflare setup

1. Create a Cloudflare account.
2. Create a D1 database named `dealspark-prod`.
3. Copy the D1 database ID.
4. Create a Cloudflare API token with permission to deploy Workers.
5. In the GitHub repository, add Actions secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_DATABASE_ID`
6. Add Worker secrets after the first deployment:
   - `ADMIN_TOKEN`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_SITE_KEY`
7. Pushing backend changes to `main` will run the deployment workflow.

## Security

Never place `ADMIN_TOKEN`, `TWILIO_AUTH_TOKEN`, Cloudflare credentials, AI keys, email-provider keys or payment secrets in GitHub Pages JavaScript.

Twilio request validation uses HMAC signing in the Worker.

## Current status

**Code:** built.

**Public frontend:** live on GitHub Pages.

**Production API:** ready to deploy, but not claimed live until the Cloudflare account, database and credentials are actually connected.

Once deployed, the next integration is to put the Worker URL and business public key into the chatbot configuration, then connect the Recovery Desk and Twilio webhook to the same API.
