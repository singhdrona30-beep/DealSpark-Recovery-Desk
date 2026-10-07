const KEY="dealspark_recovery_desk_v1";
const statuses=["New","Follow-up","Qualified","Booked","Won","Lost"];
const $=id=>document.getElementById(id);
function load(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function save(rows){localStorage.setItem(KEY,JSON.stringify(rows));render()}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){
 const rows=load(), q=$("search").value.trim().toLowerCase();
 const filtered=rows.filter(r=>[r.name,r.contact,r.service,r.notes,r.status].join(" ").toLowerCase().includes(q));
 $("openCount").textContent=rows.filter(r=>!["Won","Lost"].includes(r.status)).length;
 $("qualifiedCount").textContent=rows.filter(r=>r.status==="Qualified").length;
 $("bookedCount").textContent=rows.filter(r=>r.status==="Booked").length;
 $("wonCount").textContent=rows.filter(r=>r.status==="Won").length;
 $("pipeline").innerHTML=filtered.length?filtered.map(r=>`<article class="lead"><div class="leadTop"><strong>${esc(r.name)}</strong><small>${new Date(r.createdAt).toLocaleString()}</small></div><div>${esc(r.service)} · ${esc(r.contact)}</div><small>${esc(r.notes)}</small><label>Status <select data-id="${esc(r.id)}">${statuses.map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select></label></article>`).join(""):'<div class="empty">No opportunities yet.</div>';
 document.querySelectorAll("select[data-id]").forEach(s=>s.addEventListener("change",e=>{const rows=load(),r=rows.find(x=>x.id===e.target.dataset.id);if(r){r.status=e.target.value;save(rows)}}));
}
$("leadForm").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.target);const rows=load();rows.unshift({id:crypto.randomUUID(),name:fd.get("name"),contact:fd.get("contact"),service:fd.get("service"),notes:fd.get("notes"),status:"New",createdAt:new Date().toISOString()});save(rows);e.target.reset()});
$("search").addEventListener("input",render);
$("clearBtn").addEventListener("click",()=>{if(confirm("Clear all Recovery Desk data?")){localStorage.removeItem(KEY);render()}});
$("exportBtn").addEventListener("click",()=>{const rows=load();if(!rows.length)return alert("Nothing to export.");const head=["id","name","contact","service","notes","status","createdAt"];const csv=[head,...rows.map(r=>head.map(k=>String(r[k]??"").replace(/"/g,'""')))].map(row=>row.map(v=>`"${v}"`).join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="dealspark-recovery-pipeline.csv";a.click();URL.revokeObjectURL(a.href)});
$("demoBtn").addEventListener("click",()=>{const rows=[["Sarah Miller","416-555-0182","Emergency plumbing","Called after hours; no answer.","Follow-up"],["Mark Chen","647-555-0124","Roof repair","Requested an estimate.","Qualified"],["Aisha Patel","aisha@example.com","HVAC service","Asked about availability.","Booked"]].map((x,i)=>({id:crypto.randomUUID(),name:x[0],contact:x[1],service:x[2],notes:x[3],status:x[4],createdAt:new Date(Date.now()-i*3600000).toISOString()}));save([...rows,...load()])});
render();