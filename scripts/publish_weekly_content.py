#!/usr/bin/env python3
"""Publish one useful, pre-reviewed DealSpark resource per scheduled run.

This intentionally publishes from an editorial queue rather than generating thin,
unverified pages from search snippets. Each run publishes at most one new page.
The weekly job refreshes the resource hub, validates every draft, deploys Pages directly, and leaves an audit trail in Git history. It also preserves the existing sitemap and analytics build behavior.
"""
from __future__ import annotations
import html
import json
from pathlib import Path

BASE = "https://singhdrona30-beep.github.io/DealSpark-Recovery-Desk/"
OUT = Path(".")
CONTENT = [
    {
        "slug": "missed-call-follow-up-script.html",
        "title": "Missed-Call Follow-Up Scripts for Service Businesses",
        "description": "Free, practical missed-call follow-up scripts for HVAC, plumbing, cleaning, roofing and other service businesses, plus a simple callback checklist.",
        "intro": "A missed call is not automatically a lost sale. The next step is to follow up quickly, identify what the caller needed, and make it easy for them to reply. Use these adaptable scripts as a starting point and keep the message honest about what your team can do.",
        "sections": [
            {"heading": "1. A simple callback text", "paragraph": "Hi [First name], this is [Name] from [Business]. Sorry we missed your call. What service can we help you with? Reply here or call us at [Business phone]. If you prefer, tell us a good time to call you back."},
            {"heading": "2. A voicemail script", "paragraph": "Hi [First name], this is [Name] calling from [Business] returning your call. I wanted to find out what you need help with and see how we can assist. You can reach us at [Business phone]. Again, this is [Name] from [Business]. Thanks."},
            {"heading": "3. A follow-up email", "paragraph": "Subject: Following up on your call to [Business]\n\nHi [First name], we saw that you tried to reach us. If you still need help with [service, if known], reply with a few details and your preferred callback time. We will confirm availability before booking anything. Thank you, [Name], [Business]."},
            {"heading": "A five-point callback checklist", "items": ["Use the caller's name only if they provided it.", "Mention the business clearly and explain why you are contacting them.", "Ask one useful question instead of sending a long sales pitch.", "Never claim an appointment, price or technician is confirmed unless it is.", "Respect opt-outs and the customer's preferred contact channel."]},
            {"heading": "When automation helps", "paragraph": "A receptionist workflow can capture the reason for the call, contact details the caller chooses to provide, and a preferred callback window. Staff should review unusual, urgent or sensitive requests and confirm real availability. DealSpark's public demos use sample data; live phone routing and messaging require separate setup and authorization."}
        ],
        "faqs": [
            ["How quickly should we follow up?", "As soon as practical during your business hours. Choose a realistic response target for your team and measure whether it is met."],
            ["Should we text every missed caller?", "Only when you have an appropriate legal basis and the channel is permitted. Follow applicable consent, privacy and opt-out requirements."],
            ["Can DealSpark automatically book appointments?", "The demos illustrate workflows. Live calendar access and booking must be configured, authorized and tested before you promise real appointments."]
        ]
    },
    {
        "slug": "after-hours-call-answering-checklist.html",
        "title": "After-Hours Call Answering Checklist for Small Businesses",
        "description": "A practical checklist for deciding what happens when customers call after hours, including urgent-call routing, lead capture and next-day follow-up.",
        "intro": "After-hours coverage works best when callers get a clear next step and your team receives a useful message. Before selecting a live answering service or AI receptionist, document the rules your business actually follows.",
        "sections": [
            {"heading": "Define the calls you receive", "items": ["New service or estimate requests.", "Existing-customer updates and rescheduling.", "Urgent requests that require a human response.", "Supplier, sales and non-customer calls.", "Calls that should go to voicemail or a separate on-call number."]},
            {"heading": "Write the approved answers", "paragraph": "Document your service area, business hours, services offered, callback expectations and any prices you are comfortable sharing. Do not let an automated system invent availability, guarantee a quote or claim a technician is dispatched when that has not happened."},
            {"heading": "Build a safe escalation path", "items": ["Name the person or team responsible for urgent calls.", "Define what the receptionist must never attempt to diagnose or advise on.", "Provide an emergency or human handoff path appropriate to your industry.", "Test transfers, fallback numbers and what happens when nobody answers.", "Review call records and fix confusing answers."]},
            {"heading": "Measure whether it works", "paragraph": "Track missed calls, successfully captured requests, qualified leads, callbacks completed and appointments actually confirmed. A high call-answer rate alone is not proof of more sales; compare outcomes and avoid counting test calls as real customers."}
        ],
        "faqs": [
            ["Should every call be transferred?", "No. Route based on the business's approved rules, urgency and caller needs. Make the fallback clear when nobody can answer."],
            ["Can we advertise 24/7 service if staff are not available?", "Only describe the coverage you really provide. Be clear whether calls are captured for later follow-up or a person is available immediately."],
            ["What should we test before launch?", "Test business hours, caller details, transfers, failed transfers, emergency routing, privacy notices and the follow-up queue."]
        ]
    },
    {
        "slug": "small-business-lead-follow-up-template.html",
        "title": "Small-Business Lead Follow-Up Template and Tracking Sheet",
        "description": "A free lead follow-up framework with simple statuses, timing rules and metrics to help small businesses turn inquiries into real conversations.",
        "intro": "A lead list is useful only when it helps the team take the next action. Start with a small set of statuses and a clear owner for every inquiry instead of creating a complicated CRM process.",
        "sections": [
            {"heading": "Use five simple lead statuses", "items": ["New — received but not reviewed.", "Contact attempted — a legitimate contact attempt was made.", "Connected — a two-way conversation occurred.", "Qualified — need, service area and next step are understood.", "Won / Lost / Not now — record the actual outcome and a short reason."]},
            {"heading": "Capture only useful details", "paragraph": "Record the business or customer's name, the inquiry source, the service requested, the next action, who owns it, and when it is due. Avoid collecting sensitive details that are not needed. Keep access limited and follow your retention policy."},
            {"heading": "Set a follow-up cadence your team can meet", "items": ["First response: as soon as practical within your stated service hours.", "If there is no response: make one appropriate follow-up using a permitted channel.", "If the customer asks for more time: record the requested date.", "If the customer opts out: suppress further marketing messages.", "Review open leads each workday and close records with a real outcome."]},
            {"heading": "Track the numbers that matter", "paragraph": "Measure new inquiries, response time, two-way conversations, qualified leads, confirmed appointments, completed jobs and sales. Calculate conversion rates from actual outcomes. Do not treat page views, clicks or unconfirmed bookings as revenue."}
        ],
        "faqs": [
            ["How many times should we follow up?", "There is no universal number. Use a respectful, channel-appropriate cadence and stop when the person opts out or further contact is not appropriate."],
            ["Can AI prioritize leads?", "AI can help summarize and rank records using explicit criteria, but a person should review high-impact or ambiguous cases and verify that the source information is correct."],
            ["What is the simplest first step?", "Give every new inquiry an owner, a status and a next-action date. Review overdue items consistently."]
        ]
    },
    {
        "slug": "ai-receptionist-buying-checklist.html",
        "title": "AI Receptionist Buying Checklist: Questions to Ask Before You Pay",
        "description": "Compare AI receptionist options with a practical checklist covering call handling, integrations, privacy, reliability, pricing and real-world testing.",
        "intro": "An AI receptionist should solve a specific customer-service problem, not just sound impressive in a demo. Use this checklist to compare vendors and avoid paying for capabilities that have not been demonstrated.",
        "sections": [
            {"heading": "Call handling and handoff", "items": ["Can it answer the common questions your customers actually ask?", "Can it capture the reason for a call and a preferred callback time?", "What happens when a caller asks for a person?", "How does it handle silence, unclear speech, interruptions and failed transfers?", "Can you review and correct its approved answers?"]},
            {"heading": "Integrations and proof", "items": ["Which phone provider and calendar are supported today?", "Is the integration live or only shown in a demo?", "Who authorizes access and where are credentials stored?", "Can the vendor demonstrate a successful end-to-end test?", "What happens if the API, internet connection or calendar is unavailable?"]},
            {"heading": "Privacy, reliability and cost", "paragraph": "Ask what call data is stored, how long it is retained, who can access it, how deletion works and whether call recording or transcription requires notice or consent in your jurisdiction. Compare setup fees, usage limits, overages, cancellation terms and support response times—not just the headline monthly price."},
            {"heading": "Run a small pilot", "paragraph": "Test a representative set of calls before routing real customers. Include routine questions, a request for a human, an out-of-area caller, an unavailable appointment slot and a failed transfer. Score accuracy, caller experience, safe escalation and staff workload. Expand only after the results meet your criteria."}
        ],
        "faqs": [
            ["Should we trust a demo video?", "Treat it as a product illustration, not proof that your own phone, calendar or CRM is connected. Ask for a live test using your approved workflow."],
            ["What should we compare first?", "Start with call types, human handoff, integration requirements, total cost and what happens during failures."],
            ["How do we estimate value?", "Use your own call volume, average job value and observed conversion rates. Treat calculators as estimates, not guaranteed revenue."]
        ]
    }
]

def render(item: dict) -> str:
    title = html.escape(item["title"])
    description = html.escape(item["description"])
    intro = html.escape(item["intro"])
    sections = []
    for section in item["sections"]:
        sections.append("<section class=\"panel\"><h2>" + html.escape(section["heading"]) + "</h2>")
        if "paragraph" in section:
            sections.append("<p>" + html.escape(section["paragraph"]).replace("\n", "<br>") + "</p>")
        if "items" in section:
            sections.append("<ul>" + "".join("<li>" + html.escape(x) + "</li>" for x in section["items"]) + "</ul>")
        sections.append("</section>")
    faq_html = "".join("<details><summary>" + html.escape(q) + "</summary><p>" + html.escape(a) + "</p></details>" for q, a in item["faqs"])
    schema = {"@context":"https://schema.org","@type":"Article","headline":item["title"],"description":item["description"],"author":{"@type":"Organization","name":"DealSpark"},"publisher":{"@type":"Organization","name":"DealSpark"},"mainEntityOfPage":BASE + item["slug"]}
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} | DealSpark</title><meta name="description" content="{description}"><meta name="robots" content="index,follow">
<link rel="canonical" href="{BASE + item['slug']}"><meta property="og:title" content="{title}"><meta property="og:description" content="{description}"><meta property="og:type" content="article">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
<style>*{{box-sizing:border-box}}body{{margin:0;background:#f7f9fc;color:#172338;font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}}main{{max-width:900px;margin:auto;padding:24px 20px 60px}}nav{{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:12px 0 24px}}a{{color:#2457d6}}.hero,.panel{{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:clamp(20px,4vw,34px);margin:18px 0}}.eyebrow{{color:#2457d6;font-size:.8rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}}h1{{font-size:clamp(2.2rem,6vw,3.4rem);line-height:1.08;letter-spacing:-.05em;margin:12px 0}}h2{{line-height:1.2;letter-spacing:-.025em}}p,li{{color:#4b5b70}}li{{margin:9px 0}}.btn{{display:inline-block;background:#172338;color:#fff;text-decoration:none;font-weight:800;border-radius:9px;padding:11px 15px;margin:8px 8px 0 0}}details{{border-top:1px solid #e2e8f0;padding:14px 0}}summary{{font-weight:800;cursor:pointer}}footer{{border-top:1px solid #e2e8f0;margin-top:30px;padding-top:20px;font-size:.9rem}}</style></head>
<body><main><nav><a href="./">DealSpark home</a><a href="resources.html">All free tools and guides</a></nav>
<header class="hero"><span class="eyebrow">Free practical guide</span><h1>{title}</h1><p>{intro}</p><a class="btn" href="index.html#pricing">See plans and pricing</a><a class="btn" href="chatbot.html">Explore sample demo</a></header>
{''.join(sections)}
<section class="panel"><h2>Frequently asked questions</h2>{faq_html}</section>
<section class="panel"><h2>Try the workflow before committing</h2><p>DealSpark's public demos use sample data. Live phone routing, calendar access and external integrations require separate configuration, authorization and testing. Confirm the features, privacy terms and total cost that matter to your business before buying.</p><a class="btn" href="index.html#resources">Explore free tools</a><a class="btn" href="index.html#pricing">View current plans</a></section>
<footer>DealSpark · <a href="./">Home</a> · <a href="resources.html">Resources</a></footer></main></body></html>"""

def main() -> None:
    target = next((item for item in CONTENT if not (OUT / item["slug"]).exists()), None)
    published = []
    for item in CONTENT:
        if (OUT / item["slug"]).exists():
            published.append(item)
    if target:
        (OUT / target["slug"]).write_text(render(target), encoding="utf-8")
        published.append(target)
        print(f"Published one new guide: {target['slug']}")
    else:
        print("Content queue is complete; no new guide published.")
    links = [
        ("Missed-call revenue calculator", "tools/missed-call-revenue-calculator.html", "Estimate the potential value of missed calls."),
        ("AI receptionist cost calculator", "tools/ai-receptionist-cost-calculator.html", "Compare estimated answering-service costs."),
        ("Answering service ROI calculator", "tools/answering-service-roi-calculator.html", "Estimate potential return from capturing calls."),
        ("AI receptionist for small business", "faq/ai-receptionist-for-small-business.html", "Questions to consider before choosing a service."),
        ("AI receptionist vs. answering service", "faq/ai-receptionist-vs-answering-service.html", "Compare different approaches to call coverage."),
    ]
    for item in published:
        links.append((item["title"], item["slug"], item["description"]))
    cards = "".join(f'<article><h2><a href="{html.escape(url, quote=True)}">{html.escape(title)}</a></h2><p>{html.escape(desc)}</p></article>' for title, url, desc in links)
    hub = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Free Business Tools and Guides | DealSpark</title><meta name="description" content="Free calculators, checklists and practical guides for missed calls, AI receptionists and small-business lead follow-up."><meta name="robots" content="index,follow"><link rel="canonical" href="{BASE}resources.html"><style>*{{box-sizing:border-box}}body{{margin:0;background:#f7f9fc;color:#172338;font:16px/1.6 system-ui,sans-serif}}main{{max-width:1050px;margin:auto;padding:28px 20px 60px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}}article{{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px}}a{{color:#2457d6}}p{{color:#526177}}.hero{{padding:28px 0}}h1{{font-size:clamp(2.1rem,5vw,3.2rem);line-height:1.1;letter-spacing:-.04em}}.btn{{display:inline-block;background:#172338;color:#fff;text-decoration:none;padding:11px 15px;border-radius:9px}}</style></head><body><main><p><a href="./">← DealSpark home</a></p><header class="hero"><h1>Free tools and practical business guides</h1><p>Estimate missed-call opportunities, compare answering options, and use checklists your team can put to work. Guides are added gradually and link back to current DealSpark plans and demos.</p><a class="btn" href="index.html#pricing">Explore DealSpark plans</a></header><div class="grid">{cards}</div></main></body></html>"""
    (OUT / "resources.html").write_text(hub, encoding="utf-8")
    print(f"Resource hub updated with {len(links)} links.")

if __name__ == "__main__":
    main()
