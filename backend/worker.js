const cors={
  "content-type":"application/json",
  "access-control-allow-origin":"*",
  "access-control-allow-headers":"content-type,authorization,x-dealspark-key",
  "access-control-allow-methods":"GET,POST,PUT,OPTIONS"
};
const VERSION="3.0";
const SAFE_MODE=false;
const PRODUCTS={
  BillGuard:{name:"BillGuard",description:"Monitor invoices, overdue items and recurring billing issues.",prices:[99,249,499]},
  StockWatch:{name:"StockWatch",description:"Monitor inventory levels, reorder risk and stock exceptions.",prices:[129,299,599]},
  StaffDesk:{name:"StaffDesk",description:"Organize onboarding documents, training and recurring HR administration.",prices:[149,349,699]},
  ReviewShield:{name:"ReviewShield",description:"Monitor customer feedback, flag urgent complaints and draft owner-reviewed responses.",prices:[99,249,499]},
  OpsVault:{name:"OpsVault",description:"Track business documents, licenses, certificates and expirations.",prices:[129,299,599]},
  LeadFlow:{name:"LeadFlow",description:"Capture, qualify and control sales lead follow-up.",prices:[99,199,399]},
  QuotePilot:{name:"QuotePilot",description:"Organize quote-ready job intake and missing scope information.",prices:[129,249,499]},
  ScheduleFlow:{name:"ScheduleFlow",description:"Control appointments, callbacks and schedule exceptions.",prices:[129,249,499]},
  DispatchDesk:{name:"DispatchDesk",description:"Coordinate field jobs, technician assignments and arrival exceptions.",prices:[129,249,499]},
  AssetCare:{name:"AssetCare",description:"Track equipment maintenance, service history and due dates.",prices:[119,229,449]}
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const text=async r=>{try{return await r.json()}catch{return {}}};
const id=()=>crypto.randomUUID();
const bytes=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return b};
const hex=b=>[...b].map(x=>x.toString(16).padStart(2,"0")).join("");
const hash=async s=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))));
async function passwordHash(password,saltHex){
  const salt=Uint8Array.from(saltHex.match(/.{2}/g).map(x=>parseInt(x,16)));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256);
  return hex(new Uint8Array(bits));
}
async function session(env,user){
  const raw=hex(bytes());
  const t=new Date(Date.now()+1000*60*60*24*30).toISOString();
  await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at,created_at,token_hash,workspace_id) VALUES(?,?,?,?,?,?)")
    .bind(id(),user.id,t,new Date().toISOString(),await hash(raw),user.workspace_id).run();
  return raw;
}
async function auth(request,env){
  const h=request.headers.get("authorization")||"";
  const token=h.startsWith("Bearer ")?h.slice(7):"";
  if(!token)return null;
  const s=await env.DB.prepare("SELECT s.user_id,s.workspace_id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await hash(token),new Date().toISOString()).first();
  return s||null;
}
async function seedWorkspace(env,businessId,workspaceId){
  const samples=[
    ["BillGuard","ABC Mechanical • Invoice #1842","$2,480 overdue • 17 days"],
    ["StockWatch","Northside HVAC • 16x20 filter","4 units left • reorder 20"],
    ["StaffDesk","Maria • Sales Rep","2 documents missing • training due tomorrow"],
    ["ReviewShield","Harbour Plumbing • 2-star review","Technician arrived late • urgent complaint"],
    ["OpsVault","Summit Roofing • Insurance certificate","Expires in 12 days"],
    ["LeadFlow","ABC Roofing • Web lead #1042","Roof replacement • $18,500 estimate • missed follow-up risk"],
    ["QuotePilot","Northside HVAC • Service request #771","No-cooling call • 2.5-ton residential unit • quote information incomplete"],
    ["ScheduleFlow","Metro Plumbing • Tuesday schedule","14 appointments • 2 callbacks • schedule conflict"],
    ["DispatchDesk","Metro Service Team • Job #771","Technician arrival window needs review • schedule exception"],
    ["AssetCare","Harbour Electrical • Van #14","Oil service due in 420 km • maintenance due"]
  ];
  for(const [p,item,issue] of samples){
    await env.DB.prepare("INSERT INTO operational_items(id,workspace_id,product,item,issue,status,source) VALUES(?,?,?,?,?,?,?)")
      .bind(id(),workspaceId,p,item,issue,"needs_review","sample").run();
  }
}
export default {
 async fetch(request,env){
  const u=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{headers:cors});
  if(u.pathname==="/health")return json({ok:true,service:"dealspark-saas",database:"connected",version:VERSION,safe_mode:SAFE_MODE,products:Object.keys(PRODUCTS).length});
  if(u.pathname==="/api/plans")return json({starter:{price:79,name:"AI Receptionist"},growth:{price:149,name:"Lead Recovery"},pro:{price:249,name:"AI Phone Agent"},business:{price:399,name:"Full DealSpark"}});
  if(u.pathname==="/api/products")return json({version:VERSION,safe_mode:SAFE_MODE,products:Object.values(PRODUCTS)});
  if(u.pathname==="/api/auth/register"&&request.method==="POST"){
    const b=await text(request),email=String(b.email||"").trim().toLowerCase(),name=String(b.business_name||"").trim(),password=String(b.password||"");
    if(!email||!name||password.length<8)return json({error:"business_name, email and an 8+ character password are required"},400);
    const existing=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if(existing)return json({error:"An account with that email already exists"},409);
    const now=new Date().toISOString(),businessId=id(),workspaceId=id(),userId=id(),salt=hex(bytes()),ph=await passwordHash(password,salt);
    await env.DB.prepare("INSERT INTO businesses(id,name,public_key,timezone,phone,created_at) VALUES(?,?,?,?,?,?)").bind(businessId,name,"ds_"+hex(bytes()),String(b.timezone||"America/Toronto"),String(b.phone||""),now).run();
    await env.DB.prepare("INSERT INTO workspaces(id,name,owner_email,created_at) VALUES(?,?,?,?)").bind(workspaceId,name,email,now).run();
    await env.DB.prepare("INSERT INTO users(id,business_id,email,role,created_at,password_hash,password_salt) VALUES(?,?,?,?,?,?,?)").bind(userId,businessId,email,"owner",now,ph,salt).run();
    await seedWorkspace(env,businessId,workspaceId);
    const token=await session(env,{id:userId,workspace_id:workspaceId});
    return json({ok:true,token,workspace:{id:workspaceId,name},message:"Workspace created",product_count:Object.keys(PRODUCTS).length});
  }
  if(u.pathname==="/api/auth/login"&&request.method==="POST"){
    const b=await text(request),email=String(b.email||"").trim().toLowerCase(),password=String(b.password||"");
    const user=await env.DB.prepare("SELECT u.id,u.email,u.role,u.password_hash,u.password_salt,b.name AS business_name FROM users u JOIN businesses b ON b.id=u.business_id WHERE u.email=?").bind(email).first();
    if(!user||!user.password_hash)return json({error:"Invalid email or password"},401);
    if(await passwordHash(password,user.password_salt)!==user.password_hash)return json({error:"Invalid email or password"},401);
    const workspace=await env.DB.prepare("SELECT id,name FROM workspaces WHERE owner_email=? ORDER BY created_at DESC LIMIT 1").bind(email).first();
    if(!workspace)return json({error:"Workspace not found"},404);
    return json({ok:true,token:await session(env,{id:user.id,workspace_id:workspace.id}),workspace});
  }
  const me=await auth(request,env);
  if(u.pathname==="/api/me"){
    if(!me)return json({error:"Unauthorized"},401);
    return json({user:{id:me.user_id,email:me.email,role:me.role},workspace_id:me.workspace_id});
  }
  if(u.pathname==="/api/recovery"){
    if(!me)return json({error:"Unauthorized"},401);
    const counts=await env.DB.prepare("SELECT status,COUNT(*) AS count FROM operational_items WHERE workspace_id=? GROUP BY status").bind(me.workspace_id).all();
    const integrations=await env.DB.prepare("SELECT COUNT(*) AS count FROM integrations WHERE workspace_id=?").bind(me.workspace_id).first();
    return json({ok:true,version:VERSION,safe_mode:SAFE_MODE,workspace_id:me.workspace_id,product_count:Object.keys(PRODUCTS).length,item_counts:counts.results,integration_count:integrations?.count||0,checked_at:new Date().toISOString()});
  }
  if(u.pathname==="/api/items"){
    if(!me)return json({error:"Unauthorized"},401);
    if(request.method==="GET"){
      const rows=await env.DB.prepare("SELECT id,product,item,issue,status,source,created_at,updated_at FROM operational_items WHERE workspace_id=? ORDER BY created_at DESC LIMIT 200").bind(me.workspace_id).all();
      return json({items:rows.results});
    }
    if(request.method==="POST"){
      const b=await text(request),product=String(b.product||"").trim(),item=String(b.item||"").trim(),issue=String(b.issue||"").trim();
      if(!product||!item||!issue)return json({error:"product, item and issue are required"},400);
      if(!PRODUCTS[product])return json({error:"Unsupported product. Use /api/products for the current catalog."},400);
      const iid=id();await env.DB.prepare("INSERT INTO operational_items(id,workspace_id,product,item,issue,status,source) VALUES(?,?,?,?,?,?,?)").bind(iid,me.workspace_id,product,item,issue,"needs_review","manual").run();
      await env.DB.prepare("INSERT INTO audit_log(id,workspace_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)").bind(id(),me.workspace_id,"created","operational_item",iid,JSON.stringify({product,item})).run();
      return json({ok:true,id:iid});
    }
  }
  const m=u.pathname.match(/^\/api\/items\/([^/]+)\/(approve|dismiss)$/);
  if(m){
    if(!me)return json({error:"Unauthorized"},401);
    const iid=m[1],action=m[2];
    const row=await env.DB.prepare("SELECT id,product,item,issue FROM operational_items WHERE id=? AND workspace_id=?").bind(iid,me.workspace_id).first();
    if(!row)return json({error:"Item not found"},404);
    await env.DB.prepare("UPDATE operational_items SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?").bind(action==="approve"?"approved":"dismissed",iid,me.workspace_id).run();
    await env.DB.prepare("INSERT INTO audit_log(id,workspace_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)").bind(id(),me.workspace_id,action,"operational_item",iid,JSON.stringify(row)).run();
    return json({ok:true,status:action==="approve"?"approved":"dismissed"});
  }
  if(u.pathname==="/api/integrations"){
    if(!me)return json({error:"Unauthorized"},401);
    const rows=await env.DB.prepare("SELECT provider,status,scopes,metadata,updated_at FROM integrations WHERE workspace_id=? ORDER BY provider").bind(me.workspace_id).all();
    return json({integrations:rows.results});
  }
  if(u.pathname==="/api/audit"){
    if(!me)return json({error:"Unauthorized"},401);
    const rows=await env.DB.prepare("SELECT action,entity_type,entity_id,details,created_at FROM audit_log WHERE workspace_id=? ORDER BY created_at DESC LIMIT 200").bind(me.workspace_id).all();
    return json({audit:rows.results});
  }
  if(u.pathname==="/api/signup"&&request.method==="POST"){
    const b=await text(request),email=String(b.email||"").trim().toLowerCase(),n=String(b.business_name||"").trim();
    if(!email||!n)return json({error:"business_name and email are required"},400);
  }
  const key=request.headers.get("x-dealspark-key")||u.searchParams.get("key");
  if(key){
    const biz=await env.DB.prepare("SELECT id,name,timezone,phone,created_at FROM businesses WHERE public_key=?").bind(key).first();
    if(biz){
      if(u.pathname==="/api/account")return json({business:biz});
      if(u.pathname==="/api/leads"&&request.method==="POST"){
        const b=await text(request),t=new Date().toISOString(),li=id();
        await env.DB.prepare("INSERT INTO leads(id,business_id,name,phone,email,service,intent,status,source,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(li,biz.id,String(b.name||""),String(b.phone||""),String(b.email||""),String(b.service||""),String(b.intent||"lead"),"New",String(b.source||"website"),String(b.notes||""),t,t).run();
        return json({ok:true,lead_id:li});
      }
    }
  }
  return json({error:"Not found"},404);
 }
};