from datetime import datetime, timedelta, timezone

from tools import Session

TZ = timezone(timedelta(hours=-4))
NOW = datetime(2026, 10, 22, 16, 10, tzinfo=TZ)


def test_records_valid_events_as_epoch_ms():
    s = Session(NOW, [])
    msg = s.record_events(
        [
            {"kind": "feed", "at": "2026-10-22T15:00-04:00", "method": "bottle", "amountMl": 120},
            {"kind": "sleep", "at": "2026-10-22T16:10-04:00", "phase": "start"},
        ]
    )
    assert msg == "Recorded 2 event(s)."
    assert s.drafts[0] == {
        "kind": "feed",
        "at": int(datetime(2026, 10, 22, 15, 0, tzinfo=TZ).timestamp() * 1000),
        "method": "bottle",
        "amountMl": 120,
    }


def test_rejects_bad_events_so_the_model_can_retry():
    s = Session(NOW, [])
    assert s.record_events([{"kind": "feed", "at": "2026-10-22T15:00-04:00", "method": "cup"}]).startswith("Rejected")
    assert s.record_events([{"kind": "diaper", "at": "2026-10-22T20:00-04:00", "contents": "wet"}]).startswith(
        "Rejected: events cannot be in the future"
    )
    assert s.drafts == []


def test_recent_events_filters_by_window():
    old = int((NOW - timedelta(hours=30)).timestamp() * 1000)
    new = int((NOW - timedelta(hours=2)).timestamp() * 1000)
    s = Session(NOW, [{"kind": "diaper", "at": old}, {"kind": "diaper", "at": new}])
    assert s.recent_events(24) == [{"kind": "diaper", "at": new}]


def test_questions_are_collected():
    s = Session(NOW, [])
    s.ask_parent("How much did she drink?")
    assert s.questions == ["How much did she drink?"]
