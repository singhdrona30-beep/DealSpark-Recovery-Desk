function hex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function verifyStripeSignature(payload,header,secret){
  const parts=Object.fromEntries(header.split(",").map(x=>x.split("=")));
  const t=parts.t,v1=parts.v1;
  if(!t||!v1)return false;
  const age=Math.abs(Date.now()/1000-Number(t)); if(!Number.isFinite(age)||age>300)return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(t+"."+payload)));
  return timingSafeEqual(sig,v1);
}
export async function onRequestPost({request,env}){
  const raw=await request.text();
  const sig=request.headers.get("stripe-signature")||"";
  if(!env.STRIPE_WEBHOOK_SECRET||!(await verifyStripeSignature(raw,sig,env.STRIPE_WEBHOOK_SECRET)))return new Response("Invalid signature",{status:400});
  let event;try{event=JSON.parse(raw)}catch{return new Response("Bad JSON",{status:400})}
  const obj=event.data?.object||{};
  const email=String(obj.customer_details?.email||obj.customer_email||"").trim().toLowerCase();
  const plan=String(obj.metadata?.dealspark_plan||obj.subscription_data?.metadata?.dealspark_plan||"").toLowerCase();
  const customer=String(obj.customer||"");
  const subscription=String(obj.subscription||obj.id||"");
  const periodEnd=Number(obj.current_period_end||obj.lines?.data?.[0]?.period?.end||0);
  const periodEndIso=periodEnd?new Date(periodEnd*1000).toISOString():"";
  const status=event.type==="invoice.payment_failed"?"past_due":event.type==="customer.subscription.deleted"?"canceled":event.type==="customer.subscription.updated"?(obj.status||"active"):"active";
  if(event.type==="checkout.session.completed"){
    if(email){
      await env.DB.prepare("UPDATE subscriptions SET plan=CASE WHEN ? IN ('starter','growth','pro','business') THEN ? ELSE plan END,status='active',stripe_customer_id=?,stripe_subscription_id=?,current_period_end=?,updated_at=? WHERE business_id IN (SELECT business_id FROM users WHERE lower(email)=?)").bind(plan,plan,customer,subscription,periodEndIso,new Date().toISOString(),email).run();
    }
  } else if(event.type.startsWith("customer.subscription.")){
    await env.DB.prepare("UPDATE subscriptions SET plan=CASE WHEN ? IN ('starter','growth','pro','business') THEN ? ELSE plan END,status=?,stripe_customer_id=?,stripe_subscription_id=?,current_period_end=?,updated_at=? WHERE stripe_customer_id=? OR stripe_subscription_id=?").bind(plan,plan,status,customer,subscription,periodEndIso,new Date().toISOString(),customer,subscription).run();
  } else if(event.type==="invoice.paid"||event.type==="invoice.payment_failed"){
    await env.DB.prepare("UPDATE subscriptions SET status=?,current_period_end=CASE WHEN ?<>"" THEN ? ELSE current_period_end END,updated_at=? WHERE stripe_customer_id=? OR stripe_subscription_id=?").bind(status,periodEndIso,periodEndIso,new Date().toISOString(),customer,subscription).run();
  }
  return new Response(JSON.stringify({received:true}),{headers:{"content-type":"application/json"}});
}