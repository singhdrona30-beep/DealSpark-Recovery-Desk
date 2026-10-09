const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,x-dealspark-key",
  "access-control-allow-methods": "GET,POST,OPTIONS"
};

function normalizePhone(value) {
  let digits = String(value ?? "").replace(/\\D/g, "");
  if (digits.length === 10) digits = "1" + digits; // North American local format.
  return digits;
}

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!["GET", "POST"].includes(request.method)) return respond({ error: "Method not allowed" }, 405);

  const key = request.headers.get("x-dealspark-key") || new URL(request.url).searchParams.get("key");
  if (!key) return respond({ error: "Missing DealSpark key" }, 401);

  const business = await env.DB.prepare(
    "SELECT id,name,phone,timezone FROM businesses WHERE public_key=? LIMIT 1"
  ).bind(key).first();
  if (!business) return respond({ error: "Invalid DealSpark key" }, 401);

  const subscription = await env.DB.prepare(
    "SELECT plan,status,current_period_end,updated_at FROM subscriptions WHERE business_id=? LIMIT 1"
  ).bind(business.id).first();

  const event = await env.DB.prepare(
    "SELECT payload FROM events WHERE business_id=? AND type=? ORDER BY created_at DESC LIMIT 1"
  ).bind(business.id, "onboarding_config").first();

  let savedConfig = null;
  try { savedConfig = event?.payload ? JSON.parse(event.payload) : null; } catch { savedConfig = null; }

  if (request.method === "GET") {
    return respond({
      business,
      subscription,
      config: savedConfig,
      phone_connection_status: savedConfig?.phone_connection_status || "not_connected"
    });
  }

  let input = {};
  try { input = await request.json(); } catch { return respond({ error: "Invalid JSON body" }, 400); }
  if (subscription?.status !== "active") {
    return respond({ error: "Subscription is not active yet" }, 402);
  }

  const clean = (value, max = 1000) => String(value ?? "").trim().slice(0, max);
  const businessName = clean(input.business_name || business.name, 160);
  const phone = clean(input.phone || business.phone, 40);
  const email = clean(input.notification_email, 254);
  const method = clean(input.phone_connection_method || "not_decided", 40);
  const allowedMethods = new Set(["not_decided", "call_forwarding", "sip_trunk", "programmable_provider"]);

  if (!businessName || !phone) return respond({ error: "Business name and main public phone number are required" }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: "Enter a valid lead notification email" }, 400);
  }
  if (!allowedMethods.has(method)) return respond({ error: "Choose a valid phone connection method" }, 400);

  const now = new Date().toISOString();
  const forwardingNumber = clean(input.forwarding_number, 40);
  const config = {
    service_area: clean(input.service_area, 300),
    notification_email: email,
    services: clean(input.services, 3000),
    opening_time: clean(input.opening_time || "08:00", 10),
    closing_time: clean(input.closing_time || "18:00", 10),
    greeting: clean(input.greeting || "Hi, thanks for calling. You've reached the virtual receptionist. How can I help you today?", 1000),
    forwarding_number: forwardingNumber,
    main_phone_normalized: normalizePhone(phone),
    forwarding_number_normalized: normalizePhone(forwardingNumber),
    phone_connection_method: method,
    current_carrier: clean(input.current_carrier, 160),
    phone_connection_status: "not_connected",
    phone_connection_updated_at: now
  };

  await env.DB.prepare("UPDATE businesses SET name=?,phone=? WHERE id=?")
    .bind(businessName, phone, business.id).run();
  await env.DB.prepare("DELETE FROM events WHERE business_id=? AND type=?")
    .bind(business.id, "onboarding_config").run();
  await env.DB.prepare(
    "INSERT INTO events (id,business_id,type,payload,created_at) VALUES (?,?,?,?,?)"
  ).bind(crypto.randomUUID(), business.id, "onboarding_config", JSON.stringify(config), now).run();

  const nextSteps = method === "call_forwarding"
    ? ["Keep the existing public number with the current carrier.", "Assign a dedicated inbound destination to this business.", "Configure conditional, busy, or no-answer forwarding only after the destination is issued.", "Place a real inbound test and verify lead capture and notifications."]
    : method === "sip_trunk"
      ? ["Keep the existing public number and carrier.", "Confirm the carrier/PBX supports SIP trunking and provides the required connection details.", "Configure a tenant-specific inbound route and dispatch rule.", "Place a real inbound test and verify lead capture and notifications."]
      : method === "programmable_provider"
        ? ["Keep the existing public number unless the owner explicitly chooses porting.", "Authorize the chosen voice provider and configure its inbound webhook or BYOC/SIP route.", "Assign a tenant-specific inbound route.", "Place a real inbound test and verify lead capture and notifications."]
        : ["Keep the existing public number with the current carrier.", "Choose call forwarding to a dedicated destination or an approved SIP/programmable-provider route.", "Complete provider authorization and routing before relying on live calls."];

  return respond({
    ok: true,
    configuration_saved: true,
    activated: false,
    phone_connection_status: "not_connected",
    config,
    next_steps: nextSteps,
    message: "Business settings saved. Phone routing is not connected or activated by this form."
  });
}

// A saved configuration is not proof that a phone carrier or SIP route is connected.

// Deployment check marker: this route saves settings only; routing must be verified separately.
