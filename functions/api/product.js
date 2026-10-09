const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,x-dealspark-key",
  "access-control-allow-methods": "GET,POST,OPTIONS"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const ALL_FEATURES = ["receptionist", "recovery", "quote", "reactivate", "phone", "radar", "sales"];
const PLAN_FEATURES = {
  starter: ["receptionist"],
  growth: ["receptionist", "recovery", "quote", "reactivate"],
  pro: ["receptionist", "recovery", "quote", "reactivate", "phone", "radar"],
  business: ALL_FEATURES,
  ai_virtual_receptionist: ["receptionist", "phone"],
  leadflow: ["recovery", "radar"],
  quotepilot: ["quote"],
  scheduleflow: ["phone"],
  dispatchdesk: ["recovery", "phone"],
  assetcare: ["recovery"],
  billguard: ["recovery"],
  stockwatch: ["recovery"],
  staffdesk: ["recovery"],
  reviewshield: ["recovery"],
  opsvault: ["recovery"],
  bundle_front_office: ["receptionist", "recovery", "phone"],
  bundle_service_operations: ["recovery", "quote", "phone"],
  bundle_business_control: ["recovery"],
  bundle_complete: ALL_FEATURES
};
const ALLOWED_FEATURES = new Set(ALL_FEATURES);

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!["GET", "POST"].includes(request.method)) return json({ error: "Method not allowed" }, 405);

  const url = new URL(request.url);
  const key = request.headers.get("x-dealspark-key") || url.searchParams.get("key");
  if (!key) return json({ error: "Missing DealSpark key" }, 401);

  const business = await env.DB.prepare(
    "SELECT id,name FROM businesses WHERE public_key=? LIMIT 1"
  ).bind(key).first();
  if (!business) return json({ error: "Invalid DealSpark key" }, 401);

  const feature = String(url.searchParams.get("product") || "recovery").toLowerCase();
  if (!ALLOWED_FEATURES.has(feature)) return json({ error: "Unknown DealSpark feature", product: feature }, 400);

  const subscription = await env.DB.prepare(
    "SELECT plan,status,current_period_end FROM subscriptions WHERE business_id=? LIMIT 1"
  ).bind(business.id).first();

  const plan = String(subscription?.plan || "starter").toLowerCase();
  const status = String(subscription?.status || "").toLowerCase();
  const end = subscription?.current_period_end ? Date.parse(subscription.current_period_end) : 0;
  const expired = end > 0 && Date.now() >= end;
  const active = status === "active" && !expired;

  if (!active) {
    return json({
      error: "Subscription expired or inactive",
      locked: true,
      plan,
      status,
      renewal_date: subscription?.current_period_end || null,
      renewal_required: true
    }, 403);
  }
  if (!(PLAN_FEATURES[plan] || []).includes(feature)) {
    return json({ error: "Product not included in current active plan", product: feature, plan, status, upgrade_required: true }, 403);
  }

  if (request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT payload,created_at FROM events WHERE business_id=? AND type=? ORDER BY created_at DESC LIMIT 1"
    ).bind(business.id, "product_state:" + feature).all();
    let state = {};
    if (rows.results?.[0]?.payload) {
      try { state = JSON.parse(rows.results[0].payload); } catch { state = {}; }
    }
    return json({
      ok: true,
      business,
      product: feature,
      state,
      updated_at: rows.results?.[0]?.created_at || null,
      renewal_date: subscription?.current_period_end || null
    });
  }

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const state = body.state && typeof body.state === "object" && !Array.isArray(body.state) ? body.state : {};
  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO events (id,business_id,lead_id,type,payload,created_at) VALUES (?,?,?,?,?,?)"
  ).bind(crypto.randomUUID(), business.id, null, "product_state:" + feature, JSON.stringify(state), createdAt).run();
  return json({ ok: true, product: feature, updated_at: createdAt, state });
}
