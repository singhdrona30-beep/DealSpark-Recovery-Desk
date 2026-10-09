from dotenv import load_dotenv
import asyncio
import json
import os
import urllib.error
import urllib.request
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, TurnHandlingOptions, inference, function_tool

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
4. Ask for a preferred appointment date/time only when relevant. Never say an
appointment is booked unless a connected booking system confirms it.
5. If the caller requests a human, explain that you can arrange follow-up. Do not
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
Do not continue the conversation after a clear goodbye or decline.
"""


@function_tool
async def save_call_lead(
    name: str,
    phone: str,
    service: str,
    email: str = "",
    appointment_preference: str = "",
    notes: str = "",
) -> str:
    """Save the caller's lead to the configured DealSpark business. Use after collecting the caller's details."""
    api_url = os.getenv("DEALSPARK_API_URL", "https://dealspark-api.singhdrona30.workers.dev").rstrip("/")
    token = os.getenv("VOICE_AGENT_TOKEN", "")
    business_id = os.getenv("DEALSPARK_BUSINESS_ID", "")
    if not token or not business_id:
        return "Lead could not be saved because voice lead capture is not configured. Do not claim it was saved."
    payload = json.dumps({
        "business_id": business_id,
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
            headers={"content-type": "application/json", "authorization": "Bearer " + token},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))

    try:
        result = await asyncio.to_thread(send)
        if result.get("ok") and result.get("lead_id"):
            return "Lead saved successfully. A notification is queued but email delivery is not yet configured."
        return "Lead save was not confirmed. Do not claim success."
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return "Lead save failed. Do not claim success; tell the caller a team member will need to follow up."


class DealSparkReceptionist(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=DEALSPARK_INSTRUCTIONS, tools=[save_call_lead])


@server.rtc_session(agent_name="dealspark-receptionist")
async def dealspark_receptionist(ctx: agents.JobContext):
    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="en"),
        llm=inference.LLM(model="google/gemma-4-31b-it"),
        tts=inference.TTS(model="cartesia/sonic-3"),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
        ),
    )
    await session.start(room=ctx.room, agent=DealSparkReceptionist())
    await session.generate_reply(
        instructions="Greet the caller now using the DealSpark opening greeting."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
