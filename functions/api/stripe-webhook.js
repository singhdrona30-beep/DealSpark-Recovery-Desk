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
const ALLOWED_PLANS=new Set(["starter","growth","pro","business","ai_virtual_receptionist","leadflow","quotepilot","scheduleflow","dispatchdesk","assetcare","billguard","stockwatch","staffdesk","reviewshield","opsvault","bundle_front_office","bundle_service_operations","bundle_business_control","bundle_complete"]);
function checkoutField(obj,key){
  const f=(obj.custom_fields||[]).find(x=>x.key===key);
  return String(f?.text?.value||f?.dropdown?.value||"").trim();
}
export async function onRequestPost({request,env}){
  const raw=await request.text();
  const sig=request.headers.get("stripe-signature")||"";
  if(!env.STRIPE_WEBHOOK_SECRET||!(await verifyStripeSignature(raw,sig,env.STRIPE_WEBHOOK_SECRET)))return new Response("Invalid signature",{status:400});
  let event;try{event=JSON.parse(raw)}catch{return new Response("Bad JSON",{status:400})}
  const obj=event.data?.object||{};
  const email=String(obj.customer_details?.email||obj.customer_email||"").trim().toLowerCase();
  const rawPlan=String(obj.metadata?.dealspark_plan||obj.subscription_data?.metadata?.dealspark_plan||"").toLowerCase();
  const plan=ALLOWED_PLANS.has(rawPlan)?rawPlan:"";
  const customer=String(obj.customer||"");
  const subscription=String(obj.subscription||obj.id||"");
  const periodEnd=Number(obj.current_period_end||obj.lines?.data?.[0]?.period?.end||0);
  const periodEndIso=periodEnd?new Date(periodEnd*1000).toISOString():"";
  const now=new Date().toISOString();
  const status=event.type==="invoice.payment_failed"?"past_due":event.type==="customer.subscription.deleted"?"canceled":event.type==="customer.subscription.updated"?(obj.status||"active"):"active";
  if(event.type==="checkout.session.completed"){
    // A completed Checkout page is not always a paid subscription (e.g. asynchronous or incomplete payment).
    // Keep the workspace locked until Stripe confirms payment; invoice/subscription events update it later.
    if(!["paid","no_payment_required"].includes(String(obj.payment_status||""))){
      return new Response(JSON.stringify({received:true,provisioned:false,reason:"payment_not_confirmed"}),{headers:{"content-type":"application/json"}});
    }
    if(!email||!plan)return new Response(JSON.stringify({received:true,provisioned:false,reason:"missing email or recognized DealSpark plan"}),{headers:{"content-type":"application/json"}});
    const existing=await env.DB.prepare("SELECT u.business_id,b.name,s.id AS subscription_id FROM users u JOIN businesses b ON b.id=u.business_id LEFT JOIN subscriptions s ON s.business_id=u.business_id WHERE lower(u.email)=? LIMIT 1").bind(email).first();
    let businessId=existing?.business_id||"";
    if(!businessId){
      businessId=crypto.randomUUID();
      const userId=crypto.randomUUID();
      const key="ds_"+crypto.randomUUID().replaceAll("-","");
      const customBusiness=checkoutField(obj,"business_name");
      const businessName=customBusiness||String(obj.customer_details?.business_name||"").trim()||String(obj.customer_details?.name||"").trim()||"DealSpark customer";
      const phone=String(obj.customer_details?.phone||"").trim();
      await env.DB.prepare("INSERT INTO businesses (id,name,public_key,timezone,phone,created_at) VALUES (?,?,?,?,?,?)").bind(businessId,businessName,key,"America/Toronto",phone,now).run();
      await env.DB.prepare("INSERT INTO users (id,business_id,email,role,created_at) VALUES (?,?,?,?,?)").bind(userId,businessId,email,"owner",now).run();
    }
    if(existing?.subscription_id){
      await env.DB.prepare("UPDATE subscriptions SET plan=?,status='active',stripe_customer_id=?,stripe_subscription_id=?,current_period_end=?,updated_at=? WHERE business_id=?").bind(plan,customer,subscription,periodEndIso,now,businessId).run();
    }else{
      await env.DB.prepare("INSERT OR IGNORE INTO subscriptions (id,business_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),businessId,plan,"active",customer,subscription,periodEndIso,now).run();
      await env.DB.prepare("UPDATE subscriptions SET plan=?,status='active',stripe_customer_id=?,stripe_subscription_id=?,current_period_end=?,updated_at=? WHERE business_id=?").bind(plan,customer,subscription,periodEndIso,now,businessId).run();
    }
  } else if(event.type.startsWith("customer.subscription.")){
    await env.DB.prepare("UPDATE subscriptions SET plan=CASE WHEN ?<>'' THEN ? ELSE plan END,status=?,stripe_customer_id=?,stripe_subscription_id=?,current_period_end=?,updated_at=? WHERE stripe_customer_id=? OR stripe_subscription_id=?").bind(plan,plan,status,customer,subscription,periodEndIso,now,customer,subscription).run();
  } else if(event.type==="invoice.paid"||event.type==="invoice.payment_failed"){
    const invoiceSubscription=String(obj.subscription||obj.parent?.subscription_details?.subscription||"");
    await env.DB.prepare("UPDATE subscriptions SET status=?,current_period_end=CASE WHEN ?<>'' THEN ? ELSE current_period_end END,updated_at=? WHERE stripe_customer_id=? OR stripe_subscription_id=?").bind(status,periodEndIso,periodEndIso,now,customer,invoiceSubscription).run();
  }
  return new Response(JSON.stringify({received:true}),{headers:{"content-type":"application/json"}});
}
// Production webhook signing secret is managed in Cloudflare Pages secrets; test live checkout before launch.
