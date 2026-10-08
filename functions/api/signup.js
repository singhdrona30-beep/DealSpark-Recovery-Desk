import {json,options,readBody,hashPassword,verifyPassword,createSession,ensureWorkspace,ensureBusiness} from "./_lib/auth.js";
const ALLOWED_PLANS=new Set(["starter","growth","pro","business","ai_virtual_receptionist","leadflow","quotepilot","scheduleflow","dispatchdesk","assetcare","billguard","stockwatch","staffdesk","reviewshield","opsvault","bundle_front_office","bundle_service_operations","bundle_business_control","bundle_complete"]);
function salt(){return [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,"0")).join("")}
export async function onRequest({request}){if(request.method==="OPTIONS")return options();return json({error:"Method not allowed"},405)}
export async function onRequestPost({request,env}){
 const b=await readBody(request),email=String(b.email||"").trim().toLowerCase(),name=String(b.business_name||"").trim(),phone=String(b.phone||"").trim(),timezone=String(b.timezone||"America/Toronto"),plan=String(b.plan||"").toLowerCase(),password=String(b.password||"");
 if(!email||!email.includes("@")||!name)return json({error:"Business name and a valid email are required"},400);
 if(password.length<10)return json({error:"Use a password with at least 10 characters"},400);
 if(!ALLOWED_PLANS.has(plan))return json({error:"Invalid DealSpark product or bundle"},400);
 const now=new Date().toISOString(),existing=await env.DB.prepare("SELECT u.id AS user_id,u.business_id,u.password_hash,u.password_salt,b.name,b.public_key FROM users u JOIN businesses b ON b.id=u.business_id WHERE lower(u.email)=? LIMIT 1").bind(email).first();
 let userId,businessId,publicKey;
 const s=salt(),ph=await hashPassword(password,s);
 if(existing){
  userId=existing.user_id;businessId=existing.business_id;publicKey=existing.public_key;
  if(existing.password_hash){if(!(await verifyPassword(password,existing.password_salt,existing.password_hash)))return json({error:"This email already has an account. Check your password or use the Operations Control Center sign-in."},409);}
  else await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=? WHERE id=?").bind(ph,s,userId).run();
  await env.DB.prepare("UPDATE businesses SET name=?,timezone=?,phone=? WHERE id=?").bind(name,timezone,phone,businessId).run();
  await env.DB.prepare("INSERT OR IGNORE INTO subscriptions (id,business_id,plan,status,updated_at) VALUES (?,?,?,'setup',?)").bind(crypto.randomUUID(),businessId,plan,now).run();
  await env.DB.prepare("UPDATE subscriptions SET plan=?,status=CASE WHEN status='active' THEN status ELSE 'setup' END,updated_at=? WHERE business_id=?").bind(plan,now,businessId).run();
 }else{
  const business=await ensureBusiness(env,name,timezone,phone);businessId=business.id;publicKey=business.public_key;userId=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id,business_id,email,role,created_at,password_hash,password_salt) VALUES (?,?,?,?,?,?,?)").bind(userId,businessId,email,"owner",now,ph,s).run();
  await env.DB.prepare("INSERT INTO subscriptions (id,business_id,plan,status,updated_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),businessId,plan,"setup",now).run();
 }
 const workspace=await ensureWorkspace(env,email,businessId,name);
 const token=await createSession(env,userId,workspace.id);
 return json({ok:true,dashboard_key:publicKey,business_id:businessId,token,workspace,plan});
}