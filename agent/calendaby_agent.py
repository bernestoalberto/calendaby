"""Calendaby agent on Bedrock AgentCore.

Two modes share one entrypoint:
- capture: turns what a parent said into validated events (fast, small model)
- chat: answers questions from the baby's recent log (larger model)

The app never holds AWS credentials: it calls a Vercel function, which invokes this runtime.
"""

import json
import os
from datetime import datetime

from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent, tool
from strands.models import BedrockModel

from context import CAPTURE, CHAT
from tools import Session

REGION = os.environ.get("AWS_REGION", "us-west-2")
# Bedrock model access is per account and region; override these if yours differ.
CAPTURE_MODEL_ID = os.environ.get("CAPTURE_MODEL_ID", "anthropic.claude-haiku-5-5")
CHAT_MODEL_ID = os.environ.get("CHAT_MODEL_ID", "anthropic.claude-sonnet-5-5")

app = BedrockAgentCoreApp()

def build_agent(mode: str, session: Session, model=None) -> Agent:
    @tool
    def record_events(events: list[dict]) -> str:
        """Record baby care events. Each item has kind (feed|sleep|diaper|med|note), at (ISO 8601 with UTC offset)
        and the fields for that kind: feed {method: bottle|breast|solids, amountMl?, side?: left|right|both},
        sleep {phase: start|end}, diaper {contents: wet|dirty|both}, med {name, doseMl?}, note {note}."""
        return session.record_events(events)

    @tool
    def ask_parent(question: str) -> str:
        """Ask the parent one short clarifying question when a needed detail is missing."""
        return session.ask_parent(question)

    @tool
    def get_recent_events(hours: int = 24) -> str:
        """Return the baby's logged events from the last N hours as JSON (times are epoch ms)."""
        return json.dumps(session.recent_events(hours))

    now = session.now.isoformat(timespec="minutes")
    if mode == "chat":
        model_id, prompt, tools = CHAT_MODEL_ID, CHAT, [get_recent_events, record_events]
    else:
        model_id, prompt, tools = CAPTURE_MODEL_ID, CAPTURE, [record_events, ask_parent]

    return Agent(
        model=model or BedrockModel(model_id=model_id, region_name=REGION),
        system_prompt=prompt.format(now=now),
        tools=tools,
        callback_handler=None,
    )


@app.entrypoint
def invoke(payload, model=None):
    """payload: {mode: "capture"|"chat", prompt, now: ISO 8601 with offset, events?: [...]}"""
    mode = payload.get("mode", "capture")
    session = Session(datetime.fromisoformat(payload["now"]), payload.get("events", []))
    result = build_agent(mode, session, model)(payload["prompt"])
    return {"reply": str(result).strip(), "drafts": session.drafts, "questions": session.questions}


if __name__ == "__main__":
    app.run()
