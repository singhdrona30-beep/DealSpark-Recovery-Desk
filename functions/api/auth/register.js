import {json,options,readBody,hashPassword,createSession,ensureWorkspace,ensureBusiness} from "../_lib/auth.js";
export async function onRequest({request}){if(request.method==="OPTIONS")return options();return json({error:"Method not allowed"},405)}
export async function onRequestPost({request,env}){
 const b=await readBody(request),email=String(b.email||"").trim().toLowerCase(),password=String(b.password||""),businessName=String(b.business_name||"").trim();
 if(!email||!email.includes("@")||!businessName)return json({error:"Business name and a valid email are required"},400);
 if(password.length<10)return json({error:"Use a password with at least 10 characters"},400);
 const old=await env.DB.prepare("SELECT id,business_id,password_hash FROM users WHERE lower(email)=? LIMIT 1").bind(email).first();
 const salt=randomSalt();const passwordHash=await hashPassword(password,salt);const now=new Date().toISOString();
 if(old){
   if(old.password_hash)return json({error:"An account already exists for this email. Use Sign in instead."},409);
   await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=? WHERE id=?").bind(passwordHash,salt,old.id).run();
   const business=await env.DB.prepare("SELECT id,name,public_key FROM businesses WHERE id=?").bind(old.business_id).first();
   const workspace=await ensureWorkspace(env,email,old.business_id,business?.name||businessName);
   const token=await createSession(env,old.id,workspace.id);
   return json({ok:true,token,workspace,existing:true});
 }
 const business=await ensureBusiness(env,businessName,String(b.timezone||"America/Toronto"),String(b.phone||""));
 const userId=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO users (id,business_id,email,role,created_at,password_hash,password_salt) VALUES (?,?,?,?,?,?,?)").bind(userId,business.id,email,"owner",now,passwordHash,salt).run();
 const workspace=await ensureWorkspace(env,email,business.id,businessName);
 await env.DB.prepare("INSERT INTO subscriptions (id,business_id,plan,status,updated_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),business.id,String(b.plan||"starter"),"setup",now).run();
 const token=await createSession(env,userId,workspace.id);
 return json({ok:true,token,workspace,business_id:business.id});
}
function randomSalt(){return [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,"0")).join("")}
