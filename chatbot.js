const LEAD_KEY="dealspark_recovery_desk_v1";const $=id=>document.getElementById(id);const messages=$("messages");const quick=$("quick");let state={step:"idle",service:"",name:"",contact:""};
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function say(text){const el=document.createElement("div");el.className="msg bot";el.innerHTML=esc(text);messages.appendChild(el);messages.scrollTop=messages.scrollHeight}
function user(text){const el=document.createElement("div");el.className="msg user";el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight}
function addLead(){let rows=[];try{rows=JSON.parse(localStorage.getItem(LEAD_KEY)||"[]")}catch{};rows.unshift({id:crypto.randomUUID(),name:state.name,contact:state.contact,service:state.service,notes:"Captured by DealSpark website chatbot.",status:"New",createdAt:new Date().toISOString()});localStorage.setItem(LEAD_KEY,JSON.stringify(rows))}
function buttons(items){quick.innerHTML="";items.forEach(x=>{const b=document.createElement("button");b.textContent=x;b.onclick=()=>handle(x);quick.appendChild(b)})}
function handle(raw){const text=raw.trim();if(!text)return;user(text);quick.innerHTML="";
if(state.step==="service"){state.service=text;state.step="name";say("Great. What's your name?");return}
if(state.step==="name"){state.name=text;state.step="contact";say("Thanks, "+text+". What's the best phone number or email for the business to contact you?");return}
if(state.step==="contact"){state.contact=text;addLead();state.step="idle";say("You're all set. We've captured your request. A team member can follow up with you shortly.");buttons(["Book an appointment","Ask another question"]);return}
const l=text.toLowerCase();
if(/book|appointment|schedule/.test(l)){say("Absolutely. Tell me what service you need and I'll capture the request for booking.");state.step="service";return}
if(/price|cost|quote|estimate/.test(l)){say("We can help with a quote. What service are you looking for?");state.step="service";return}
if(/human|person|agent|call/.test(l)){say("No problem. I can capture your details for a human follow-up.");state.step="service";return}
if(/hours|open|available/.test(l)){say("We're available to help 24/7 through this assistant. For a specific service appointment, tell me what you need.");return}
if(/service|help|need|looking/.test(l)){say("I'd be happy to help. What service do you need?");state.step="service";return}
say("I can help with services, quotes, appointments and connecting you with the business. What would you like help with?");
buttons(["Get a quote","Book an appointment","Talk to someone"])}
$("chatForm").addEventListener("submit",e=>{e.preventDefault();const i=$("chatInput");handle(i.value);i.value=""});
say("Hi! I'm the DealSpark virtual receptionist. I can answer questions, help with a quote, or capture a request for the business.");
buttons(["Get a quote","Book an appointment","Talk to someone"]);