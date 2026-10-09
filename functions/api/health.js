export async function onRequest({env}) {
  return new Response(JSON.stringify({
    ok: true,
    service: "dealspark-pages-api",
    database: Boolean(env.DB) ? "binding_present" : "missing",
    billing_webhook_configured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    catalog_version: "2026-10-launch",
    webhook_route: "/api/stripe-webhook"
  }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}
