import {json,options,readBody,verifyPassword,createSession,ensureWorkspace} from "../_lib/auth.js";
export async function onRequest({request}){if(request.method==="OPTIONS")return options();return json({error:"Method not allowed"},405)}
export async function onRequestPost({request,env}){
 const b=await readBody(request);
 const email=String(b.email||"").trim().toLowerCase();
 const password=String(b.password||"");
 if(!email||!password)return json({error:"Email and password are required"},400);
 const user=await env.DB.prepare("SELECT u.id,u.business_id,u.password_hash,u.password_salt,b.name AS business_name FROM users u LEFT JOIN businesses b ON b.id=u.business_id WHERE lower(u.email)=? LIMIT 1").bind(email).first();
 if(!user||!user.password_hash||!(await verifyPassword(password,user.password_salt,user.password_hash)))return json({error:"Email or password is incorrect"},401);
 const workspace=await ensureWorkspace(env,email,user.business_id,user.business_name||"DealSpark Workspace");
 const token=await createSession(env,user.id,workspace.id);
 return json({ok:true,token,workspace,business_id:user.business_id});
}