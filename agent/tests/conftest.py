import json
import sys
from pathlib import Path

from strands.models import Model

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class StubModel(Model):
    """Plays back scripted turns so tests never call a model: each turn is a tool call or a final text."""

    def __init__(self, turns: list[dict]):
        self.turns = list(turns)
        self.system_prompts: list[str | None] = []

    def update_config(self, **model_config):
        pass

    def get_config(self):
        return {}

    def structured_output(self, output_model, prompt, system_prompt=None, **kwargs):
        raise NotImplementedError

    async def stream(self, messages, tool_specs=None, system_prompt=None, **kwargs):
        self.system_prompts.append(system_prompt)
        turn = self.turns.pop(0)
        yield {"messageStart": {"role": "assistant"}}
        if "tool" in turn:
            yield {"contentBlockStart": {"start": {"toolUse": {"toolUseId": f"t{len(self.turns)}", "name": turn["tool"]}}}}
            yield {"contentBlockDelta": {"delta": {"toolUse": {"input": json.dumps(turn["input"])}}}}
            yield {"contentBlockStop": {}}
            yield {"messageStop": {"stopReason": "tool_use"}}
        else:
            yield {"contentBlockDelta": {"delta": {"text": turn["text"]}}}
            yield {"contentBlockStop": {}}
            yield {"messageStop": {"stopReason": "end_turn"}}
