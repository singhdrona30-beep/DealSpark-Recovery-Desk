import {json,options,getSession} from "../_lib/auth.js";
export async function onRequest({request}){if(request.method==="OPTIONS")return options();return json({error:"Method not allowed"},405)}
export async function onRequestGet({request,env}){
 const s=await getSession(request,env);if(!s)return json({error:"Session expired. Please sign in again."},401);
 const workspace=await env.DB.prepare("SELECT id,name,owner_email,created_at FROM workspaces WHERE id=? LIMIT 1").bind(s.workspace_id).first();
 return json({ok:true,user:{id:s.user_id,email:s.email},workspace});
}