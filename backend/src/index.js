const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,x-dealspark-site-key,x-twilio-signature"
};

function withCors(response) {
  const h = new Headers(response.headers);
  for (const [k,v] of Object.entries(cors)) h.set(k,v);
  return new Response(response.body, { status: response.status, headers: h });
}

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

function now() { return new Date().toISOString(); }

async function publicBusiness(env, siteKey) {
  if (!siteKey) return null;
  return env.DB.prepare(
    "SELECT id, name, timezone FROM businesses WHERE public_key = ?1 LIMIT 1"
  ).bind(siteKey).first();
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  return !!env.ADMIN_TOKEN && auth === `Bearer ${env.ADMIN_TOKEN}`;
}

async function twilioSignatureValid(request, env, rawBody) {
  if (!env.TWILIO_AUTH_TOKEN) return false;
  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  const url = request.url;
  const params = new URLSearchParams(rawBody);
  const pairs = [...params.entries()].sort((a,b) => a[0].localeCompare(b[0]));
  const data = url + pairs.map(([k,v]) => k + v).join("");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.TWILIO_AUTH_TOKEN),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  let binary = "";
  for (const byte of new Uint8Array(mac)) binary += String.fromCharCode(byte);
  const expected = btoa(binary);
  return expected === signature;
}

async function sendVoiceLeadNotification(env, business, lead) {
  // A missing or rejected email integration must never undo a lead already saved to D1.
  if (!env.RESEND_API_KEY || !env.VOICE_NOTIFICATION_EMAIL) return "not_configured";

  const safe = (value) => String(value || "").trim();
  const subject = `New DealSpark phone lead: ${safe(lead.name) || "Caller"}`;
  const lines = [
    "A new phone lead was captured by the DealSpark AI receptionist.",
    "",
    `Business: ${safe(business.name) || "DealSpark"}`,
    `Lead ID: ${safe(lead.leadId)}`,
    `Received: ${safe(lead.created)}`,
    `Caller name: ${safe(lead.name) || "Not provided"}`,
    `Callback phone: ${safe(lead.phone) || "Not provided"}`,
    `Email: ${safe(lead.email) || "Not provided"}`,
    `Service/request: ${safe(lead.service) || "Not provided"}`,
    `Appointment preference: ${safe(lead.appointmentPreference) || "Not provided"}`,
    `Notes: ${safe(lead.notes) || "None"}`,
    "",
    "Note: an appointment preference is a request, not a confirmed booking."
  ];
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: "DealSpark Lead Alerts <onboarding@resend.dev>",
        to: [env.VOICE_NOTIFICATION_EMAIL],
        subject,
        text: lines.join("\n")
      })
    });
    if (!response.ok) {
      // Avoid logging secrets or full provider responses containing personal data.
      return "failed";
    }
    return "sent";
  } catch {
    return "failed";
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/bootstrap" && request.method === "POST") {
        if (!(await requireAdmin(request, env))) return withCors(json({ error: "Unauthorized" }, 401));
        const b = await body(request);
        const id = crypto.randomUUID();
        const publicKey = crypto.randomUUID() + crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO businesses (id,name,public_key,timezone,phone,created_at) VALUES (?1,?2,?3,?4,?5,?6)"
        ).bind(id,b.name || "DealSpark Demo Business",publicKey,b.timezone || "America/Toronto",b.phone || "",now()).run();
        return withCors(json({ ok: true, business_id: id, public_key: publicKey }));
      }

      if (path === "/health") {
        return withCors(json({ ok: true, service: "dealspark-api", time: now() }));
      }

      // Anonymous first-party traffic events; never store IPs, names, emails, or form contents.
      if (path === "/analytics" && request.method === "POST") {
        const b = await body(request);
        const event = String(b.event || "");
        const sessionId = String(b.session_id || "").slice(0, 80);
        const page = String(b.page || "/").slice(0, 300);
        const referrer = String(b.referrer || "").slice(0, 1000);
        const target = String(b.target || "").slice(0, 1000);
        if (!["page_view", "demo_click", "lead_click"].includes(event) || !sessionId || !page.startsWith("/")) {
          return withCors(json({ error: "Invalid analytics event" }, 400));
        }
        await env.DB.prepare(
          "INSERT INTO analytics_events (event,session_id,page,referrer,target,ts) VALUES (?1,?2,?3,?4,?5,?6)"
        ).bind(event, sessionId, page, referrer, target, now()).run();
        return withCors(json({ ok: true }));
      }

      if (path === "/report" && request.method === "GET") {
        const totals = await env.DB.prepare(
          "SELECT SUM(CASE WHEN event='page_view' THEN 1 ELSE 0 END) AS page_views, SUM(CASE WHEN event='demo_click' THEN 1 ELSE 0 END) AS demo_clicks, SUM(CASE WHEN event='lead_click' THEN 1 ELSE 0 END) AS lead_clicks, COUNT(DISTINCT session_id) AS unique_sessions FROM analytics_events"
        ).first();
        const recent = await env.DB.prepare(
          "SELECT ts, event, page FROM analytics_events ORDER BY id DESC LIMIT 30"
        ).all();
        return withCors(json({
          totals: {
            page_views: Number(totals?.page_views || 0),
            demo_clicks: Number(totals?.demo_clicks || 0),
            lead_clicks: Number(totals?.lead_clicks || 0),
            unique_sessions: Number(totals?.unique_sessions || 0)
          },
          recent: recent.results || []
        }));
      }

      if (path === "/api/leads" && request.method === "POST") {
        const business = await publicBusiness(env, request.headers.get("x-dealspark-site-key"));
        if (!business) return withCors(json({ error: "Invalid site key" }, 401));

        const b = await body(request);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO leads
           (id,business_id,name,phone,email,service,intent,status,source,notes,created_at,updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)`
        ).bind(
          id, business.id, b.name || "", b.phone || "", b.email || "",
          b.service || "", b.intent || "lead", b.status || "New",
          b.source || "chatbot", b.notes || "", now()
        ).run();

        await env.DB.prepare(
          "INSERT INTO events (id,business_id,lead_id,type,payload,created_at) VALUES (?1,?2,?3,?4,?5,?6)"
        ).bind(crypto.randomUUID(), business.id, id, "lead.created", JSON.stringify(b), now()).run();

        return withCors(json({ ok: true, id }));
      }

      // Trusted LiveKit agent ingestion. This route is separate from the public site-key API.
      if (path === "/api/voice-leads" && request.method === "POST") {
        const auth = request.headers.get("authorization") || "";
        if (!env.VOICE_AGENT_TOKEN || auth !== `Bearer ${env.VOICE_AGENT_TOKEN}`) {
          return withCors(json({ error: "Unauthorized voice agent" }, 401));
        }
        const b = await body(request);
        const businessId = String(b.business_id || "").trim();
        if (!businessId) return withCors(json({ error: "business_id is required" }, 400));
        const business = await env.DB.prepare(
          "SELECT id, name FROM businesses WHERE id = ?1 LIMIT 1"
        ).bind(businessId).first();
        if (!business) return withCors(json({ error: "Unknown business" }, 404));

        const safe = (value, max = 1000) => String(value || "").trim().slice(0, max);
        const leadId = crypto.randomUUID();
        const created = now();
        const name = safe(b.name, 160);
        const phone = safe(b.phone, 80);
        const email = safe(b.email, 254);
        const service = safe(b.service, 500);
        const notes = safe(b.notes, 3000);
        const appointmentPreference = safe(b.appointment_preference, 500);
        const intent = safe(b.intent || "call", 80);
        await env.DB.prepare(
          `INSERT INTO leads
           (id,business_id,name,phone,email,service,intent,status,source,notes,created_at,updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,'New','livekit_voice',?8,?9,?9)`
        ).bind(leadId,business.id,name,phone,email,service,intent,
          [notes, appointmentPreference ? `Appointment preference: ${appointmentPreference}` : ""].filter(Boolean).join("\\n"),
          created).run();

        await env.DB.prepare(
          "INSERT INTO events (id,business_id,lead_id,type,payload,created_at) VALUES (?1,?2,?3,'voice.lead.created',?4,?5)"
        ).bind(crypto.randomUUID(),business.id,leadId,JSON.stringify({
          source: "livekit_voice", name, phone, email, service, intent, appointment_preference: appointmentPreference
        }),created).run();

        const notificationStatus = await sendVoiceLeadNotification(env, business, {
          leadId, name, phone, email, service, notes, appointmentPreference, created
        });

        return withCors(json({
          ok: true,
          lead_id: leadId,
          business_id: business.id,
          notification_status: notificationStatus
        }, 201));
      }

      if (path.startsWith("/api/leads/") && request.method === "PATCH") {
        const business = await publicBusiness(env, request.headers.get("x-dealspark-site-key"));
        if (!business) return withCors(json({ error: "Invalid site key" }, 401));
        const id = path.split("/").pop();
        const b = await body(request);
        await env.DB.prepare(
          `UPDATE leads SET
           status=COALESCE(?1,status), name=COALESCE(?2,name), phone=COALESCE(?3,phone),
           email=COALESCE(?4,email), service=COALESCE(?5,service), notes=COALESCE(?6,notes),
           updated_at=?7 WHERE id=?8 AND business_id=?9`
        ).bind(b.status ?? null,b.name ?? null,b.phone ?? null,b.email ?? null,b.service ?? null,b.notes ?? null,now(),id,business.id).run();
        return withCors(json({ ok: true, id }));
      }

      if (path === "/api/leads" && request.method === "GET") {
        const business = await publicBusiness(env, request.headers.get("x-dealspark-site-key"));
        if (!business) return withCors(json({ error: "Invalid site key" }, 401));
        const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
        const rows = await env.DB.prepare(
          "SELECT * FROM leads WHERE business_id = ?1 ORDER BY created_at DESC LIMIT ?2"
        ).bind(business.id, limit).all();
        return withCors(json({ ok: true, leads: rows.results || [] }));
      }

      if (path === "/api/dashboard" && request.method === "GET") {
        const business = await publicBusiness(env, request.headers.get("x-dealspark-site-key"));
        if (!business) return withCors(json({ error: "Invalid site key" }, 401));
        const rows = await env.DB.prepare(
          "SELECT status, COUNT(*) AS count FROM leads WHERE business_id = ?1 GROUP BY status"
        ).bind(business.id).all();
        return withCors(json({ ok: true, metrics: rows.results || [] }));
      }

      if (path === "/api/conversations" && request.method === "POST") {
        const business = await publicBusiness(env, request.headers.get("x-dealspark-site-key"));
        if (!business) return withCors(json({ error: "Invalid site key" }, 401));
        const b = await body(request);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO conversations (id,business_id,lead_id,channel,messages,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?6)"
        ).bind(id,business.id,b.lead_id || null,b.channel || "chatbot",JSON.stringify(b.messages || []),now()).run();
        return withCors(json({ ok: true, id }));
      }

      if (path === "/api/appointments" && request.method === "POST") {
        const business = await publicBusiness(env, request.headers.get("x-dealspark-site-key"));
        if (!business) return withCors(json({ error: "Invalid site key" }, 401));
        const b = await body(request);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO appointments (id,business_id,lead_id,rep_id,start_at,end_at,status,notes,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)"
        ).bind(id,business.id,b.lead_id || null,b.rep_id || null,b.start_at || "",b.end_at || "",b.status || "Booked",b.notes || "",now()).run();
        return withCors(json({ ok: true, id }));
      }

      if (path === "/api/webhooks/twilio" && request.method === "POST") {
        const raw = await request.text();
        if (!(await twilioSignatureValid(request, env, raw))) return withCors(json({ error: "Invalid Twilio signature" }, 403));
        const p = new URLSearchParams(raw);
        const siteKey = env.TWILIO_SITE_KEY;
        const business = await publicBusiness(env, siteKey);
        if (!business) return withCors(json({ error: "Twilio business not configured" }, 500));

        const leadId = crypto.randomUUID();
        const notes = `CallSid=${p.get("CallSid") || ""}; CallStatus=${p.get("CallStatus") || ""}; Direction=${p.get("Direction") || ""}`;
        await env.DB.prepare(
          `INSERT INTO leads (id,business_id,name,phone,email,service,intent,status,source,notes,created_at,updated_at)
           VALUES (?1,?2,?3,?4,'','','call','New','twilio',?5,?6,?6)`
        ).bind(leadId,business.id,p.get("Caller") || "Phone caller",p.get("From") || "",notes,now()).run();

        await env.DB.prepare(
          "INSERT INTO events (id,business_id,lead_id,type,payload,created_at) VALUES (?1,?2,?3,'twilio.call',?4,?5)"
        ).bind(crypto.randomUUID(),business.id,leadId,JSON.stringify(Object.fromEntries(p)),now()).run();

        return withCors(json({ ok: true, lead_id: leadId }));
      }

      if (path === "/api/webhooks/email" && request.method === "POST") {
        if (!(await requireAdmin(request, env))) return withCors(json({ error: "Unauthorized" }, 401));
        const b = await body(request);
        await env.DB.prepare(
          "INSERT INTO events (id,business_id,type,payload,created_at) VALUES (?1,?2,'email.webhook',?3,?4)"
        ).bind(crypto.randomUUID(),b.business_id || "dealspark",JSON.stringify(b),now()).run();
        return withCors(json({ ok: true }));
      }

      return withCors(json({ error: "Not found" }, 404));
    } catch (error) {
      return withCors(json({ error: "Server error", detail: String(error?.message || error) }, 500));
    }
  }
};
