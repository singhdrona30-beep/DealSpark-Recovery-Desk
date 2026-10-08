import {json,options,getSession} from "../../_lib/auth.js";
export async function onRequest({request}){if(request.method==="OPTIONS")return options();return json({error:"Method not allowed"},405)}
export async function onRequestPost({request,env,params}){
 const s=await getSession(request,env);if(!s)return json({error:"Please sign in again"},401);
 const id=String(params?.id||""),action=String(params?.action||"");
 if(!id||!["approve","dismiss"].includes(action))return json({error:"Unsupported action"},400);
 const item=await env.DB.prepare("SELECT id,product,item,issue,status FROM operational_items WHERE id=? AND workspace_id=? LIMIT 1").bind(id,s.workspace_id).first();
 if(!item)return json({error:"Item not found"},404);
 const status=action==="approve"?"approved":"dismissed",now=new Date().toISOString();
 await env.DB.prepare("UPDATE operational_items SET status=?,updated_at=? WHERE id=? AND workspace_id=?").bind(status,now,id,s.workspace_id).run();
 await env.DB.prepare("INSERT INTO action_queue (id,workspace_id,item_id,action_type,payload,status,approved_at,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),s.workspace_id,id,action,JSON.stringify({product:item.product,item:item.item,issue:item.issue}),status,action==="approve"?now:null,now).run();
 await env.DB.prepare("INSERT INTO audit_log (id,workspace_id,action,entity_type,entity_id,details,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),s.workspace_id,"item."+action,"operational_item",id,JSON.stringify({product:item.product,status}),now).run();
 return json({ok:true,id,status,external_action_executed:false});
}