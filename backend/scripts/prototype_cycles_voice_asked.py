"""PROTOTYPE, throwaway: round three of `prototype_cycles_voice.py`, only the typed
conversation with the producer's straight question at the end, wording D, each run twice.

    cd backend && uv run python scripts/prototype_cycles_voice_asked.py"""

import asyncio
import html
import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "voice", Path(__file__).with_name("prototype_cycles_voice.py"))
v = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v)  # type: ignore[union-attr]

from eidolon.characters import load_characters  # noqa: E402
from eidolon.config import ChatModelSettings, LLMSettings  # noqa: E402
from eidolon.llm.providers import open_llm  # noqa: E402
from eidolon.world import load_world, world_path  # noqa: E402


async def main() -> None:
    cp = v.ROOT / "characters" / "characters.toml"
    cs, world = load_characters(cp), load_world(world_path(cp))
    llm = open_llm(ChatModelSettings(LLMSettings.chat_from_env()).text)
    sem = asyncio.Semaphore(6)
    stages = [s for s in v.STAGES if s.phase != "none"]
    jobs = [
        v.run_conversation(llm, sem, cs[c], world, st, "D", "typing", v.TYPING)
        for c in v.CHARACTERS for st in stages for _ in range(2)
    ]
    runs = await asyncio.gather(*jobs)
    out = ["<!doctype html><meta charset=utf-8><title>PROTOTYPE 周期：被直接问（D）</title>",
           "<style>body{font:14px/1.6 system-ui;margin:24px}td,th{border:1px solid #ccc;"
           "padding:6px;vertical-align:top}table{border-collapse:collapse}.r{white-space:pre-wrap}"
           "</style><h1>PROTOTYPE 周期：制作人问「……是不是那个来了？」（措辞 D，每格跑两次）</h1>",
           "<table><tr><th></th>" + "".join(f"<th>{s.label}</th>" for s in stages) + "</tr>"]
    by: dict = {}
    for r in runs:
        by.setdefault((r.character, r.stage), []).append(r.said[-1].reply)
    for c in v.CHARACTERS:
        out.append(f"<tr><th>{html.escape(cs[c].name)}</th>")
        for st in stages:
            cell = "<hr>".join(f"<div class=r>{html.escape(x)}</div>" for x in by[(c, st.key)])
            out.append(f"<td>{cell}</td>")
        out.append("</tr>")
    out.append("</table>")
    path = Path(__file__).with_name("prototype_cycles_voice_asked.html")
    path.write_text("\n".join(out), encoding="utf-8")
    print(path)


if __name__ == "__main__":
    asyncio.run(main())
