# DealSpark Website Chatbot

A self-contained, embeddable chatbot product built for DealSpark.

## What it does
- Greets website visitors 24/7
- Handles common service, quote, appointment and human-handoff intents
- Captures name, contact information and service request
- Writes captured leads to the same Recovery Desk local data store
- Works with zero third-party API cost for the demo
- Can be upgraded to an LLM backend without changing the customer-facing widget

## Demo
Open `chatbot.html`.

## Embedding
For a customer deployment, copy the chatbot UI assets into the customer's site or load them as a widget. Keep business-specific settings (services, hours, booking URL and contact routing) in a customer configuration object rather than hard-coding them.

## Important architecture note
GitHub Pages is static hosting. It can serve this frontend, but it cannot run a private server-side AI API or store shared customer data. For a production multi-business SaaS, put the API/database behind a serverless or managed backend and keep API keys there, never in browser JavaScript.