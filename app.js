const KEY="dealspark_recovery_desk_v1";
const API_BASE="https://dealspark-recovery-desk.singhdrona30.workers.dev";
const SITE_KEY="cd3b4a45-2b2a-452d-87a1-22da12ec721058b5c12c-c8b5-45a8-b737-25b4c582981a";
const statuses=["New","Follow-up","Qualified","Booked","Won","Lost"];
const $=id=>document.getElementById(id);
let rows=[];
let remoteReady=false;

function localLoad(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function localSave(){localStorage.setItem(KEY,JSON.stringify(rows))}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function api(path,options={}){
  const res=await fetch(API_BASE+path,{
    ...options,
    headers:{"content-type":"application/json","x-dealspark-site-key":SITE_KEY,...(options.headers||{})}
  });
  if(!res.ok) throw new Error("API "+res.status);
  return res.json();
}

async function load(){
  try{
    const data=await api("/api/leads?limit=500");
    rows=(data.leads||[]).map(r=>({
      id:r.id,name:r.name,contact:r.phone||r.email||"",service:r.service,
      notes:r.notes,status:r.status,createdAt:r.created_at
    }));
    remoteReady=true;
    localSave();
  }catch{
    rows=localLoad();
    remoteReady=false;
  }
  render();
}

function render(){
  const q=$("search").value.trim().toLowerCase();
  const filtered=rows.filter(r=>[r.name,r.contact,r.service,r.notes,r.status].join(" ").toLowerCase().includes(q));
  $("openCount").textContent=rows.filter(r=>!["Won","Lost"].includes(r.status)).length;
  $("qualifiedCount").textContent=rows.filter(r=>r.status==="Qualified").length;
  $("bookedCount").textContent=rows.filter(r=>r.status==="Booked").length;
  $("wonCount").textContent=rows.filter(r=>r.status==="Won").length;
  $("pipeline").innerHTML=filtered.length?filtered.map(r=>`<article class="lead"><div class="leadTop"><strong>${esc(r.name)}</strong><small>${new Date(r.createdAt).toLocaleString()}</small></div><div>${esc(r.service)} · ${esc(r.contact)}</div><small>${esc(r.notes)}</small><label>Status <select data-id="${esc(r.id)}">${statuses.map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select></label></article>`).join(""):'<div class="empty">No opportunities yet.</div>';
  document.querySelectorAll("select[data-id]").forEach(s=>s.addEventListener("change",async e=>{
    const row=rows.find(x=>x.id===e.target.dataset.id);
    if(!row)return;
    const previous=row.status; row.status=e.target.value; localSave(); render();
    if(remoteReady){
      try{await api("/api/leads/"+encodeURIComponent(row.id),{method:"PATCH",body:JSON.stringify({status:row.status})})}
      catch{row.status=previous;localSave();render();alert("Could not save the status change. Please try again.")}
    }
  }));
}

$("leadForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const lead={id:crypto.randomUUID(),name:String(fd.get("name")||""),contact:String(fd.get("contact")||""),service:String(fd.get("service")||""),notes:String(fd.get("notes")||""),status:"New",createdAt:new Date().toISOString()};
  try{
    const isEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.contact);
    const data=await api("/api/leads",{method:"POST",body:JSON.stringify({name:lead.name,phone:isEmail?"":lead.contact,email:isEmail?lead.contact:"",service:lead.service,intent:"lead",status:"New",source:"recovery-desk",notes:lead.notes})});
    lead.id=data.id; remoteReady=true;
  }catch{}
  rows.unshift(lead); localSave(); render(); e.target.reset();
});

$("search").addEventListener("input",render);
$("clearBtn").addEventListener("click",()=>{if(confirm("Clear all Recovery Desk data?")){localStorage.removeItem(KEY);rows=[];render()}});

$("exportBtn").addEventListener("click",()=>{
  const head=["id","name","contact","service","notes","status","createdAt"];
  const csv=[head,...rows.map(r=>head.map(k=>String(r[k]??"").replace(/"/g,'""')))].map(row=>row.map(v=>`"${v}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="dealspark-recovery-pipeline.csv";a.click();URL.revokeObjectURL(a.href);
});

$("demoBtn").addEventListener("click",()=>{
  const demo=[["Sarah Miller","416-555-0182","Emergency plumbing","Called after hours; no answer.","Follow-up"],["Mark Chen","647-555-0124","Roof repair","Requested an estimate.","Qualified"],["Aisha Patel","aisha@example.com","HVAC service","Asked about availability.","Booked"]].map((x,i)=>({id:crypto.randomUUID(),name:x[0],contact:x[1],service:x[2],notes:x[3],status:x[4],createdAt:new Date(Date.now()-i*3600000).toISOString()}));
  rows=[...demo,...rows];localSave();render();
});

load();