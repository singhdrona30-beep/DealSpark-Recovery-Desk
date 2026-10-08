# DealSpark Backend Build Plan

The public GitHub Pages site is the customer-facing demo layer. GitHub Pages is static, so the production backend must run separately.

## Production data model
- businesses: account, plan, business name, phone, timezone, hours
- users: login, role, business_id
- leads: business_id, name, phone, email, service, intent, status, source, created_at
- conversations: business_id, lead_id, messages, channel, timestamps
- appointments: business_id, lead_id, rep_id, start, end, status
- reps: business_id, skills, working hours, travel buffer
- events: audit trail for calls, chats, SMS, email and booking
- outreach: prospect, channel, sent_at, status, reply, suppression flag

## API contract
POST /api/leads
POST /api/conversations
POST /api/appointments
GET /api/dashboard
GET /api/leads
PATCH /api/leads/:id
POST /api/webhooks/twilio
POST /api/webhooks/email

## Security
Never put AI, Twilio, Outlook, email-provider, database or payment secrets in GitHub Pages JavaScript. Store credentials in server-side environment variables/secrets.

## Build order
1. Persistent database + authentication
2. Lead API
3. Chatbot -> Lead API
4. Recovery Desk -> Lead API
5. Twilio webhook -> Lead API
6. Appointment engine
7. Customer accounts / multi-tenancy
8. Billing
9. Production monitoring

This file is the implementation contract; it does not claim the backend is live.
