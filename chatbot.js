const LEAD_KEY="dealspark_recovery_desk_v1";
const DEALSPARK_API_BASE=window.DEALSPARK_API_BASE||"";
const DEALSPARK_SITE_KEY=window.DEALSPARK_SITE_KEY||"";
const $=id=>document.getElementById(id);
const messages=$("messages"),quick=$("quick");
let state={intent:"",service:"",date:"",time:"",name:"",contact:"",step:"idle"};

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function say(text){const el=document.createElement("div");el.className="msg bot";el.innerHTML=esc(text);messages.appendChild(el);messages.scrollTop=messages.scrollHeight}
function user(text){const el=document.createElement("div");el.className="msg user";el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight}
function buttons(items){quick.innerHTML="";items.forEach(x=>{const b=document.createElement("button");b.textContent=x;b.onclick=()=>handle(x);quick.appendChild(b)})}
function saveLead(){
 const lead={
   id:crypto.randomUUID(),
   name:state.name,
   contact:state.contact,
   service:state.service,
   notes:`Intent: ${state.intent||"General"} | Requested date: ${state.date||"Not specified"} | Requested time: ${state.time||"Not specified"} | Captured by DealSpark website chatbot.`,
   status:state.intent==="appointment"?"Booked":"New",
   createdAt:new Date().toISOString()
 };
 let rows=[];try{rows=JSON.parse(localStorage.getItem(LEAD_KEY)||"[]")}catch{}
 rows.unshift(lead);
 localStorage.setItem(LEAD_KEY,JSON.stringify(rows));
 if(DEALSPARK_API_BASE && DEALSPARK_SITE_KEY){
   fetch(DEALSPARK_API_BASE.replace(/\/$/,"")+"/api/leads",{
     method:"POST",
     headers:{"content-type":"application/json","x-dealspark-site-key":DEALSPARK_SITE_KEY},
     body:JSON.stringify({
       name:lead.name,
       phone:/^\+?[0-9 ()-]{7,}$/.test(lead.contact)?lead.contact:"",
       email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.contact)?lead.contact:"",
       service:lead.service,
       intent:state.intent||"lead",
       status:lead.status,
       source:"website-chatbot",
       notes:lead.notes
     })
   }).catch(()=>{});
 }
}
function reset(){state={intent:"",service:"",date:"",time:"",name:"",contact:"",step:"idle"}}
function nextAfterService(){
 if(state.intent==="appointment"){state.step="date";say("Got it — "+state.service+". What day would you like? You can say something like tomorrow, Friday, or October 12.");}
 else {state.step="name";say("Perfect. What's your name?");}
}
function handle(raw){
 const text=raw.trim();if(!text)return;user(text);quick.innerHTML="";
 const l=text.toLowerCase();

 // If we are collecting a known field, interpret the answer instead of restarting.
 if(state.step==="service"){
   state.service=text;
   nextAfterService(); return;
 }
 if(state.step==="date"){
   state.date=text;state.step="time";say("And what time works best? If you're flexible, just say \"any time\".");return;
 }
 if(state.step==="time"){
   state.time=text;state.step="name";say("Thanks. What's your name?");return;
 }
 if(state.step==="name"){
   state.name=text;state.step="contact";say("Thanks, "+text+". What's the best phone number or email for the business to contact you?");return;
 }
 if(state.step==="contact"){
   state.contact=text;saveLead();
   const summary=`${state.service} • ${state.date||"date flexible"} • ${state.time||"time flexible"}`;
   say("You're all set. I captured "+summary+". The business can now follow up with you.");
   buttons(["Start another request","Ask a question"]);reset();return;
 }

 // Understand natural language first, including service names in the first message.
 const serviceMatch=l.match(/\b(plumb(?:er|ing)?|hvac|heating|cooling|roof(?:er|ing)?|clean(?:er|ing)?|landscap(?:e|ing)|electric(?:ian|al)?|renovation(?:s)?|towing|dental|dentist|mortgage|insurance|real estate|auto repair|car repair|painting)\b/i);
 if(serviceMatch) state.service=serviceMatch[0];

 if(/\b(book|appointment|schedule|come out|visit)\b/.test(l)){
   state.intent="appointment";
   if(state.service){state.step="date";say("Absolutely. I can help schedule "+state.service+". What day would you like?");}
   else {state.step="service";say("Absolutely. What service do you need?");}
   return;
 }
 if(/\b(price|cost|quote|estimate|how much)\b/.test(l)){
   state.intent="quote";
   if(state.service){state.step="name";say("Sure — I can help with a "+state.service+" quote. What's your name?");}
   else {state.step="service";say("Sure. What service would you like a quote or estimate for?");}
   return;
 }
 if(/\b(human|person|agent|someone|call me)\b/.test(l)){
   state.intent="human";
   if(state.service){state.step="name";say("Of course. I can pass this to the team. What's your name?");}
   else {state.step="service";say("Of course. What service do you need help with?");}
   return;
 }
 if(/\b(hours|open|closed|available|24\/7)\b/.test(l)){
   say("I'm available 24/7. For the business's exact hours, tell me what you're looking for and I'll capture the request.");return;
 }
 if(state.service){
   state.intent=state.intent||"service";
   say("I can help with "+state.service+". Would you like a quote, an appointment, or a call from the team?");
   buttons(["Get a quote","Book an appointment","Talk to someone"]);return;
 }
 say("I can help with quotes, appointments, service questions, or a human follow-up. Tell me what you need in your own words.");
 buttons(["Get a quote","Book an appointment","Talk to someone"]);
}
$("chatForm").addEventListener("submit",e=>{e.preventDefault();const i=$("chatInput");handle(i.value);i.value=""});
say("Hi! I'm the DealSpark virtual receptionist. Tell me what you need in your own words — for example, “I need a plumber tomorrow.”");
buttons(["Get a quote","Book an appointment","Talk to someone"]);