"""Score the live agent on evals/capture.json. Calls Bedrock, so it costs money: run it by hand.

    uv run evals.py
"""

import json
from datetime import datetime
from pathlib import Path

from calendaby_agent import invoke

CASES = json.loads((Path(__file__).parent.parent / "evals" / "capture.json").read_text())


def at_ms(now: datetime, hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return int(now.replace(hour=h, minute=m, second=0).timestamp() * 1000)


def passes(drafts: list[dict], expect: list[dict], now: datetime) -> bool:
    left = list(drafts)
    if len(left) != len(expect):
        return False
    for exp in expect:
        match = next(
            (
                d
                for d in left
                if abs(d["at"] - at_ms(now, exp["at"])) <= 60_000
                and all(d.get(k) == v for k, v in exp.items() if k != "at")
            ),
            None,
        )
        if match is None:
            return False
        left.remove(match)
    return True


def main() -> None:
    now = datetime.fromisoformat(CASES["now"]).astimezone()
    score = 0
    for case in CASES["cases"]:
        out = invoke({"mode": "capture", "prompt": case["text"], "now": now.isoformat()})
        ok = passes(out["drafts"], case["expect"], now)
        score += ok
        print(f"{'PASS' if ok else 'FAIL'}  {case['text']}  ->  {out['drafts'] or out['questions']}")
    print(f"\nagent: {score}/{len(CASES['cases'])}")


if __name__ == "__main__":
    main()
