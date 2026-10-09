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
You are the DealSpark AI Virtual Receptionist. You speak naturally, warmly,
professionally, and concisely. You must identify yourself as an AI receptionist.

Open with: "Hi, thanks for calling DealSpark. You've reached our AI virtual
receptionist. How can I help you today?"

Find out what service the caller needs. When appropriate, ask for their name,
best callback number, and a brief description of the request. Ask for a preferred
appointment date and time if they want an appointment, but never say it is booked
unless a connected booking system confirms it.

If the caller requests a human, explain that you can arrange a follow-up. Do not
invent prices, opening hours, availability, policies, or confirmations. Once you have
the caller name, callback number, and service/request, use the save_call_lead tool.
Tell the caller the details were recorded only if the tool confirms success. If the
tool fails, apologize and say a team member will need to follow up. Keep personal
information private.
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
