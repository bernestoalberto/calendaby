"""Typed tools for the calendaby agent.

Kept free of AgentCore so they can be unit tested without AWS. Each request gets its own
Session, so nothing leaks between families the way a module-level list would.
"""

from datetime import datetime, timedelta
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field, TypeAdapter, ValidationError


class FeedEvent(BaseModel):
    kind: Literal["feed"]
    at: datetime = Field(..., description="When it happened, ISO 8601 with the parent's UTC offset")
    method: Literal["bottle", "breast", "solids"]
    amountMl: Optional[float] = Field(None, gt=0, le=400)
    side: Optional[Literal["left", "right", "both"]] = None
    note: Optional[str] = None


class SleepEvent(BaseModel):
    kind: Literal["sleep"]
    at: datetime
    phase: Literal["start", "end"]
    note: Optional[str] = None


class DiaperEvent(BaseModel):
    kind: Literal["diaper"]
    at: datetime
    contents: Literal["wet", "dirty", "both"]
    note: Optional[str] = None


class MedEvent(BaseModel):
    kind: Literal["med"]
    at: datetime
    name: str = Field(..., min_length=1)
    doseMl: Optional[float] = Field(None, gt=0, le=50)
    note: Optional[str] = None


class NoteEvent(BaseModel):
    kind: Literal["note"]
    at: datetime
    note: str = Field(..., min_length=1)


BabyEvent = Annotated[
    Union[FeedEvent, SleepEvent, DiaperEvent, MedEvent, NoteEvent], Field(discriminator="kind")
]
_event_list = TypeAdapter(list[BabyEvent])


class Session:
    """State for one request: the family's recent log in, proposed events and questions out."""

    def __init__(self, now: datetime, history: list[dict]):
        self.now = now
        self.history = history
        self.drafts: list[dict] = []
        self.questions: list[str] = []

    def record_events(self, events: list[dict]) -> str:
        try:
            parsed = _event_list.validate_python(events)
        except ValidationError as err:
            # Returned to the model so it can correct itself instead of failing the request.
            return f"Rejected, fix and retry: {err.errors(include_url=False)}"
        future = [e for e in parsed if e.at > self.now + timedelta(minutes=1)]
        if future:
            return "Rejected: events cannot be in the future. Parents log what already happened."
        for e in parsed:
            d = e.model_dump(exclude_none=True)
            d["at"] = int(e.at.timestamp() * 1000)
            self.drafts.append(d)
        return f"Recorded {len(parsed)} event(s)."

    def ask_parent(self, question: str) -> str:
        self.questions.append(question)
        return "Question queued for the parent."

    def recent_events(self, hours: int) -> list[dict]:
        cutoff = (self.now - timedelta(hours=hours)).timestamp() * 1000
        return [e for e in self.history if e.get("at", 0) >= cutoff]
