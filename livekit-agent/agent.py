from dotenv import load_dotenv
import asyncio
import json
import os
import urllib.error
import urllib.request
from livekit import agents, rtc
from livekit.agents import Agent, AgentServer, AgentSession, TurnHandlingOptions, RunContext, get_job_context, inference, function_tool

load_dotenv(".env.local")

server = AgentServer()

DEALSPARK_INSTRUCTIONS = """
You are the DealSpark AI Virtual Receptionist. Speak naturally, warmly,
professionally, and concisely. Identify yourself as an AI receptionist.

Opening: "Hi, thanks for calling DealSpark. You've reached our AI virtual
receptionist. How can I help you today?"

CALL FLOW
1. Listen to the caller's request first. Ask only relevant questions and one
question at a time. Collect the caller's name, callback phone number, and the
service/request. Ask for an email address when it is useful for follow-up, or
when the caller offers one. Email is optional; never pressure the caller.
2. EMAIL CAPTURE IS IMPORTANT: when the caller says an email address, do not
skip it or treat it as ordinary conversation. Listen carefully and capture the
full address in the email field of save_call_lead. Convert spoken formats such
as "name at example dot com" into "name@example.com". If any part is unclear,
ask the caller to repeat or spell just the unclear part. Then read the complete
address back naturally and ask, "Did I get that email address right?" Correct
it if needed. Do not invent or guess any letters, numbers, or domain endings.
3. If an email is provided or corrected, pass the confirmed address to the
save_call_lead tool. If no email is provided, pass an empty string. Once you
have the caller's name, callback number, and service/request, call save_call_lead
once with all collected details, including the confirmed email and any
appointment preference. Do not claim anything was saved unless the tool confirms
success. If the tool fails, apologize and say a team member will need to follow up.
4. APPOINTMENT REQUESTS: if the caller asks for a plumber, repair, service visit,
appointment, or asks when someone can come, always ask for their preferred date
AND time before finishing. Ask separately if needed: "What date would work best?"
and "What time would you prefer?" Capture the exact date and time in
appointment_preference (include the caller's timezone or city if known). If they
say a relative date like tomorrow or Friday and the date is ambiguous, clarify it.
Repeat the requested date/time back to confirm it. If they do not know, record
"date/time not provided" and continue without pressuring them. This is only a
request, not a booking: never claim a slot is available or booked. Explain that
the team must confirm the appointment.
5. Once all details are gathered, save them with save_call_lead, including the
requested appointment date/time. Do not omit appointment_preference just because
there is no live calendar.
6. If the caller requests a human, explain that you can arrange follow-up. Do not
invent prices, opening hours, availability, policies, or confirmations. Keep
personal information private.

CLOSING / STOP RULE — FOLLOW EXACTLY
After resolving the request and recording the details, ask at most once:
"Is there anything else I can help you with today?"
If the caller says "no", "no thanks", "that's all", "I'm good", "nothing else",
or any similar clear decline, immediately say a brief, friendly closing such as
"Of course. Thanks for calling DealSpark. Have a great day!" Then stop speaking.
Do not ask another question, repeat the offer to help, or restart the greeting.
If the caller says they have no request or do not need anything, thank them and
close the call politely without trying to prolong the conversation.
If the caller says goodbye, respond with a short goodbye and stop.
Never ask "How can I help you?" again after the call has already been underway.
Do not continue the conversation after a clear goodbye or decline. After saying
 the closing sentence, immediately call the end_call tool. Do not wait for the
 caller to hang up and do not say anything after calling end_call.
"""


async def _save_call_lead_impl(
    name: str,
    phone: str,
    service: str,
    email: str = "",
    appointment_preference: str = "",
    notes: str = "",
    *,
    business_id: str = "",
    called_number: str = "",
    is_phone_call: bool = False,
) -> str:
    """Shared lead-save implementation used by the demo and tenant-specific phone tools."""
    api_url = os.getenv("DEALSPARK_API_URL", "https://dealspark-api.singhdrona30.workers.dev").rstrip("/")
    token = os.getenv("VOICE_AGENT_TOKEN", "")
    business_id = str(business_id or "").strip()
    called_number = str(called_number or "").strip()
    if not token:
        return "Lead could not be saved because voice lead capture is not configured. Do not claim it was saved."
    if is_phone_call and not called_number:
        return "Lead could not be saved because the inbound dialed number was unavailable. Do not claim it was saved."
    if not business_id and not called_number:
        return "Lead could not be saved because no business route is configured. Do not claim it was saved."

    payload = json.dumps({
        "business_id": business_id if not is_phone_call else "",
        "called_number": called_number,
        "is_phone_call": is_phone_call,
        "name": name,
        "phone": phone,
        "service": service,
        "email": email,
        "appointment_preference": appointment_preference,
        "notes": notes,
        "intent": "call",
    }).encode("utf-8")

    def send():
        req = urllib.request.Request(
            api_url + "/api/voice-leads",
            data=payload,
            headers={"content-type": "application/json", "authorization": "Bearer " + token, "user-agent": "DealSparkVoiceAgent/1.0"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))

    try:
        result = await asyncio.to_thread(send)
        if result.get("ok") and result.get("lead_id"):
            status = result.get("notification_status", "not_configured")
            if status == "sent":
                return "Lead saved successfully and the email notification was sent."
            if status == "failed":
                return "Lead saved successfully, but the email notification failed. Do not say an email was sent."
            return "Lead saved successfully, but email notification is not configured yet. Do not say an email was sent."
        return "Lead save was not confirmed. Do not claim success."
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read(1000).decode("utf-8", errors="replace")
            try:
                parsed = json.loads(body)
                safe_detail = str(parsed.get("error") or parsed.get("message") or parsed.get("detail") or "HTTP request rejected")
            except (ValueError, AttributeError):
                safe_detail = "non-JSON response: " + " ".join(body.split())[:140]
                if token:
                    safe_detail = safe_detail.replace(token, "[REDACTED]")
        except Exception:
            safe_detail = "HTTP request rejected"
        print(f"VOICE_LEAD_SAVE_HTTP_ERROR status={exc.code} detail={safe_detail[:180]}")
        return "Lead save failed. Do not claim success; tell the caller a team member will need to follow up."
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"VOICE_LEAD_SAVE_NETWORK_ERROR type={type(exc).__name__} detail={str(exc)[:180]}")
        return "Lead save failed. Do not claim success; tell the caller a team member will need to follow up."


@function_tool
async def save_call_lead(
    name: str,
    phone: str,
    service: str,
    email: str = "",
    appointment_preference: str = "",
    notes: str = "",
) -> str:
    """Save a test or demo caller's lead to the configured DealSpark business."""
    return await _save_call_lead_impl(
        name, phone, service, email, appointment_preference, notes,
        business_id=os.getenv("DEALSPARK_BUSINESS_ID", ""),
    )


def make_tenant_save_call_lead(business_id: str, called_number: str, is_phone_call: bool):
    """Bind the correct tenant route to a tool instance so concurrent calls cannot cross tenants."""
    @function_tool
    async def save_call_lead(
        name: str,
        phone: str,
        service: str,
        email: str = "",
        appointment_preference: str = "",
        notes: str = "",
    ) -> str:
        """Save the caller's lead to the business identified by the inbound phone route."""
        return await _save_call_lead_impl(
            name, phone, service, email, appointment_preference, notes,
            business_id=business_id,
            called_number=called_number,
            is_phone_call=is_phone_call,
        )
    return save_call_lead

 
@function_tool
async def end_call(ctx: RunContext) -> str:
    """End the phone call after you have said a friendly closing goodbye. Call only after the goodbye has finished speaking."""
    job_ctx = get_job_context()
    if job_ctx is None:
        return "Call context unavailable; do not claim the call was disconnected."
    try:
        await ctx.wait_for_playout()
        await job_ctx.delete_room()
        return "Call ended."
    except Exception:
        return "Could not confirm call termination. Do not claim the call ended."


class DealSparkReceptionist(Agent):
    def __init__(self, business_id: str = "", called_number: str = "", is_phone_call: bool = False) -> None:
        lead_tool = make_tenant_save_call_lead(business_id, called_number, is_phone_call)
        super().__init__(instructions=DEALSPARK_INSTRUCTIONS, tools=[lead_tool, end_call])


@server.rtc_session(agent_name="dealspark-receptionist")
async def dealspark_receptionist(ctx: agents.JobContext):
    participant = await ctx.wait_for_participant()
    is_phone_call = participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
    attributes = getattr(participant, "attributes", {}) or {}
    # For inbound SIP, this is the number dialed by the caller, not the caller's own number.
    called_number = str(attributes.get("sip.trunkPhoneNumber", "") or "").strip() if is_phone_call else ""
    # A phone call is resolved by its dialed number. Never use the single demo business ID for SIP calls.
    business_id = "" if is_phone_call else os.getenv("DEALSPARK_BUSINESS_ID", "")

    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="en"),
        llm=inference.LLM(model="google/gemma-4-31b-it"),
        tts=inference.TTS(model="cartesia/sonic-3"),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
        ),
    )
    await session.start(
        room=ctx.room,
        agent=DealSparkReceptionist(
            business_id=business_id,
            called_number=called_number,
            is_phone_call=is_phone_call,
        ),
    )
    await session.generate_reply(
        instructions="Greet the caller now using the DealSpark opening greeting."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
