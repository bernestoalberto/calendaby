from datetime import datetime

from conftest import StubModel

from calendaby_agent import invoke

NOW = "2026-10-22T16:10:00-04:00"
NOW_MS = int(datetime.fromisoformat(NOW).timestamp() * 1000)


def test_capture_returns_validated_drafts_and_reply():
    model = StubModel(
        [
            {"tool": "record_events", "input": {"events": [{"kind": "note", "at": NOW, "note": "Grandma visited"}]}},
            {"text": "Logged a note about grandma's visit."},
        ]
    )
    out = invoke({"mode": "capture", "prompt": "grandma visited", "now": NOW}, model)
    assert out["reply"] == "Logged a note about grandma's visit."
    assert out["drafts"] == [{"kind": "note", "at": NOW_MS, "note": "Grandma visited"}]
    assert out["questions"] == []
    assert "2026-10-22T16:10-04:00" in model.system_prompts[0]


def test_capture_asks_instead_of_guessing():
    model = StubModel(
        [
            {"tool": "ask_parent", "input": {"question": "How much was in the bottle?"}},
            {"text": "I need one detail."},
        ]
    )
    out = invoke({"mode": "capture", "prompt": "she had a bottle", "now": NOW}, model)
    assert out["drafts"] == []
    assert out["questions"] == ["How much was in the bottle?"]


def test_chat_reads_the_log():
    events = [{"kind": "feed", "at": NOW_MS - 3_600_000, "method": "bottle", "amountMl": 120}]
    model = StubModel(
        [
            {"tool": "get_recent_events", "input": {"hours": 6}},
            {"text": "She last ate 120 ml at 3:10 pm."},
        ]
    )
    out = invoke({"mode": "chat", "prompt": "when did she eat?", "now": NOW, "events": events}, model)
    assert out["reply"] == "She last ate 120 ml at 3:10 pm."
    assert "not a doctor" in model.system_prompts[0]
