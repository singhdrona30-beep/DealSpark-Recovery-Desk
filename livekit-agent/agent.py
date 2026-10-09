from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, TurnHandlingOptions, inference

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
invent prices, opening hours, availability, policies, or confirmations. Do not
claim that a lead has been saved or a message sent unless a connected tool confirms
it. Keep personal information private. If unsure, say a team member will need to
confirm the details.
"""


class DealSparkReceptionist(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=DEALSPARK_INSTRUCTIONS)


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
