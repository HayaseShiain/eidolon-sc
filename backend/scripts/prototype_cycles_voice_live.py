"""PROTOTYPE, throwaway (cycle-her ticket 07): `prototype/cycles-voice` rerun on the live chat
model, with her prompt laid out as the implementation lays it: `ConversationEngine._prompt`,
`_now_prompt` (with `cycle_lines` for where she is), `narrations` (a warm gift told with
`WARMED`), and her feelings from a real `Judged` through `affinity_prompt`. Writes the
replies side by side to `cycles_voice_live.html` beside this file.

    cd backend && uv run python E:/tmp/cycles-voice-live/prototype_cycles_voice_live.py

Not in main."""

import asyncio
import html
import os
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

ROOT = Path(os.environ.get("EIDOLON_ROOT", "E:/Download/others/agent-test/eidolon-sc"))


def _load_env() -> None:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()

from eidolon.affinity import Judged, affinity_prompt  # noqa: E402
from eidolon.affinity import CONSIDERATE, INCONSIDERATE, UNRELATED  # noqa: E402
from eidolon.characters import load_characters  # noqa: E402
from eidolon.config import ChatModelSettings, LLMSettings  # noqa: E402
from eidolon.cycles import cycle_lines  # noqa: E402
from eidolon.engine import REACH_OUT_RULES, WANTS_TO_REACH_OUT, narrations  # noqa: E402
from eidolon.engine import ConversationEngine as Engine  # noqa: E402
from eidolon.gift_catalog import load_gift_catalog  # noqa: E402
from eidolon.her_cycle import Period, Premenstrual  # noqa: E402
from eidolon.llm.providers import open_llm  # noqa: E402
from eidolon.producer import ProducerProfile, producer_prompt  # noqa: E402
from eidolon.reply_format import ReplyParser  # noqa: E402
from eidolon.store import ConversationEvent, Message  # noqa: E402
from eidolon.world import load_world, world_path  # noqa: E402

TZ = "Asia/Shanghai"
CHARACTERS = ["kaho", "madoka", "fuyuko", "chiyuki"]
TODAY = date(2026, 10, 25)
SAMPLES = int(os.environ.get("PROTO_SAMPLES", "2"))


@dataclass(frozen=True)
class Stage:
    key: str
    label: str
    her_day: object  # HerDay

    @property
    def days(self):
        if isinstance(self.her_day, Period):
            return "period"
        if isinstance(self.her_day, Premenstrual):
            return "premenstrual"
        return None


STAGES = [
    Stage("none", "平常（对照）", None),
    Stage("pre4", "经前，还剩 4 天", Premenstrual(4)),
    Stage("pre1", "经前，还剩 1 天", Premenstrual(1)),
    Stage("p1", "经期第 1 天", Period(1, 5, TODAY)),
    Stage("p3", "经期第 3 天", Period(3, 5, TODAY - timedelta(days=2))),
]


@dataclass(frozen=True)
class Turn:
    text: str
    level: int | None  # the five-level judgement; None, not judged
    considerate: int = UNRELATED


TYPING = [
    Turn("早，昨天睡得好吗？今天下午有个杂志拍摄。", 2),
    Turn("拍完再去趟外景吧，顺便跑两个宣传，晚上再练一小时舞。", 1, INCONSIDERATE),
    Turn("你是不是不太舒服？要不今天就到这里，回去早点休息。", 3, CONSIDERATE),
]
CALL = [
    Turn("喂，在干嘛呢？", 2),
    Turn("周末一起去游乐园取材怎么样？要走一整天。", 1, INCONSIDERATE),
    Turn("听你声音没什么精神，喝点热的，早点睡吧。", 3, CONSIDERATE),
]
ASKED = [
    [Turn("今天看你没什么精神。", 2), Turn("……是不是那几天来了？", 2)],
    [Turn("你最近是不是生理期啊？感觉你有点不对劲。", 2)],
]
GIFTED = [Turn("刚刚给你寄了点东西，收到了吗？", 2)]
GIFTS = ["cocoa", "hot-water-bag"]

WHEN = {
    "typing": datetime(2026, 10, 25, 10, 0, tzinfo=ZoneInfo(TZ)),
    "in_call": datetime(2026, 10, 25, 21, 0, tzinfo=ZoneInfo(TZ)),
    "apart": datetime(2026, 10, 25, 15, 0, tzinfo=ZoneInfo(TZ)),
}

UNSAID = re.compile(r"经期|月经|生理期|生理|出血|例假|大姨妈|月経|生理日|出血|ナプキン|卫生巾")


@dataclass
class Said:
    user: str | None
    told: list[str]
    reply: str


@dataclass
class Run:
    character: str
    stage: str
    mode: str
    said: list[Said]


def _shown(segments) -> str:
    return "\n".join(f"{s.ja}\n　　{s.zh}" for s in segments)


async def _ask(llm, prompt, sem) -> list:
    async with sem:
        for attempt in range(3):
            try:
                parser = ReplyParser()
                async for item in llm.stream(prompt):
                    if isinstance(item, str):
                        parser.feed(item)
                parser.finish()
                return parser.complete
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    print(f"error: {e}", file=sys.stderr)
                    return []
                await asyncio.sleep(3)
    raise AssertionError


def _engine(characters):
    return SimpleNamespace(_characters=characters)


async def run_conversation(
    llm, sem, characters, character, world, gifts, stage: Stage, mode: str, script: list[Turn],
    gift: str | None = None,
) -> Run:
    talking = "in_call" if mode == "in_call" else "typing"
    now = WHEN[talking]
    profile = ProducerProfile(timezone=TZ)
    engine = _engine(characters)
    history: list[Message] = []
    record: list = []
    if gift is not None:
        record.append(ConversationEvent(
            1000, "gift", (now - timedelta(minutes=5)).isoformat(), gift_id=gift,
            liked=gift in character.liked_gifts,
        ))
    run = Run(character.id, stage.key, mode, [])
    for i, turn in enumerate(script):
        at = now + timedelta(minutes=3 * i)
        judged = (
            Judged(turn.level, days=stage.days,
                   considerate=turn.considerate if stage.days else UNRELATED)
            if turn.level is not None else None
        )
        affinity_lines = affinity_prompt("trust", judged)
        about_now = Engine._now_prompt(
            engine, character, profile, at, TZ, talking, affinity_lines,
            now - timedelta(hours=14), None, stage.her_day,
        )
        told = narrations(record, gifts, TZ, lambda _at, _tz: stage.her_day)
        prompt = Engine._prompt(
            engine,  # pyright: ignore[reportArgumentType]
            character, world.prompt(character.name, at.date()) if world else None,
            producer_prompt(profile), history, told, [about_now], [], turn.text, None,
        )
        segments = await _ask(llm, prompt, sem)
        shown_told = list(affinity_lines) + ([told[None].strip()] if told.get(None) else [])
        run.said.append(Said(turn.text, shown_told, _shown(segments)))
        user = Message(2 * i + 1, "user", turn.text, None, None, "")
        reply = Message(2 * i + 2, "character", None, None, None, "", segments)
        history += [user, reply]
        record += [user, reply]
    return run


async def run_reach_out(llm, sem, characters, character, world, gifts, stage: Stage) -> Run:
    now = WHEN["apart"]
    profile = ProducerProfile(timezone=TZ)
    about_now = Engine._now_prompt(
        _engine(characters), character, profile, now, TZ, "apart", [],
        now - timedelta(hours=19), None, stage.her_day,
    )
    prompt = Engine._prompt(
        _engine(characters),  # pyright: ignore[reportArgumentType]
        character, world.prompt(character.name, now.date()) if world else None,
        producer_prompt(profile), [], {}, [about_now], [REACH_OUT_RULES], WANTS_TO_REACH_OUT,
        None,
    )
    segments = await _ask(llm, prompt, sem)
    return Run(character.id, stage.key, "apart", [Said(None, [], _shown(segments))])


MODES = {
    "typing": "文字对话", "in_call": "通话", "apart": "搭话",
    "asked0": "被直接问（一）", "asked1": "被直接问（二）", "gift": "送了暖礼物",
}


def _mark(text: str) -> str:
    return UNSAID.sub(lambda m: f"<mark>{m.group(0)}</mark>", html.escape(text))


def _cell(runs: list[Run]) -> str:
    if not runs:
        return "<td class=na>—</td>"
    parts = []
    for n, run in enumerate(runs):
        if n:
            parts.append("<hr>")
        for s in run.said:
            if s.user:
                parts.append(f"<div class=u>制作人：{html.escape(s.user)}</div>")
            for t in s.told:
                parts.append(f"<div class=t>告诉她：{html.escape(t)}</div>")
            parts.append(f"<div class=r>{_mark(s.reply) or '（没有回复）'}</div>")
    return f"<td>{''.join(parts)}</td>"


def write_page(runs: list[Run], characters, model: str, hits: dict, replies: int) -> Path:
    by: dict = {}
    for r in runs:
        by.setdefault((r.character, r.stage, r.mode), []).append(r)
    out = [
        "<!doctype html><meta charset=utf-8><title>PROTOTYPE 周期：线上模型重跑</title><style>",
        "body{font:14px/1.6 system-ui,'Noto Sans SC',sans-serif;margin:24px;max-width:1900px}",
        "table{border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:28px}",
        "td,th{border:1px solid #ccc;vertical-align:top;padding:8px}",
        "th{background:#f3f1ec;text-align:left}td.na{color:#aaa}hr{border:0;border-top:1px dashed #bbb}",
        ".u{color:#24427a;font-weight:600;margin-top:8px}.t{color:#a05a00;font-size:12px}",
        ".r{white-space:pre-wrap;margin:2px 0 6px}mark{background:#ffb3b3}nav a{margin-right:12px}",
        "</style>",
        f"<h1>PROTOTYPE 周期：线上模型重跑（票 07）</h1><p>模型 <code>{html.escape(model)}</code>；"
        "提示词照实现后的真实拼法（<code>_prompt</code>、<code>_now_prompt</code> 里的 "
        "<code>cycle_lines</code>、<code>narrations</code> 的送礼那句、<code>affinity_prompt</code> 的感受句）。"
        "好感度按信任；橙色小字是这一回合「此刻」里给她的感受句和送礼旁白（周期那几行每格都在，没列出）。"
        f"「被直接问」每格跑 {SAMPLES} 次。</p>",
        f"<p><b>说没说出那几个词</b>：共 {replies} 条回复；"
        + ("、".join(f"「{w}」{n} 次" for w, n in hits.items()) if hits else "经期、月经、生理期、出血都没有出现")
        + "（日文的 生理、月経 也算；制作人自己说的不算）。命中处红底。</p>",
        "<nav>" + "".join(
            f"<a href='#{c}'>{html.escape(characters[c].name)}</a>" for c in CHARACTERS
        ) + "</nav>",
    ]
    for cid in CHARACTERS:
        out.append(f"<h2 id={cid}>{html.escape(characters[cid].name)}</h2><table><tr><th style='width:110px'></th>")
        for st in STAGES:
            out.append(f"<th>{st.label}</th>")
        out.append("</tr>")
        for mode, label in MODES.items():
            out.append(f"<tr><th>{label}</th>")
            for st in STAGES:
                out.append(_cell(by.get((cid, st.key, mode), [])))
            out.append("</tr>")
        out.append("</table>")
    out.append("<h2>她读到的周期那几行</h2><pre style='white-space:pre-wrap'>")
    for st in STAGES[1:]:
        out.append(html.escape(f"{st.label}：\n" + "\n".join(cycle_lines(st.her_day)) + "\n\n"))
    out.append("</pre>")
    path = Path(__file__).with_name("cycles_voice_live.html")
    path.write_text("\n".join(out), encoding="utf-8")
    return path


async def main() -> None:
    characters_path = ROOT / "characters" / "characters.toml"
    characters = load_characters(characters_path)
    world = load_world(world_path(characters_path))
    gifts = load_gift_catalog(ROOT / "characters" / "gifts.toml")
    settings = ChatModelSettings(LLMSettings.chat_from_env())
    text_llm, call_llm = open_llm(settings.text), open_llm(settings.call)
    sem = asyncio.Semaphore(int(os.environ.get("PROTO_CONCURRENCY", "6")))
    jobs = []
    for cid in CHARACTERS:
        c = characters[cid]
        args = (sem, characters, c, world, gifts)
        for st in STAGES:
            jobs.append(run_conversation(text_llm, *args, st, "typing", TYPING))
            jobs.append(run_conversation(call_llm, *args, st, "in_call", CALL))
            jobs.append(run_reach_out(text_llm, *args, st))
            if st.days:
                for n, script in enumerate(ASKED):
                    for _ in range(SAMPLES):
                        jobs.append(run_conversation(text_llm, *args, st, f"asked{n}", script))
            for gift in GIFTS:
                jobs.append(run_conversation(text_llm, *args, st, "gift", GIFTED, gift))
    print(f"{len(jobs)} 段，开始跑……", file=sys.stderr)
    runs = list(await asyncio.gather(*jobs))
    hits: dict[str, int] = {}
    replies = 0
    for r in runs:
        if r.stage == "none":
            continue
        for s in r.said:
            replies += 1
            for m in UNSAID.findall(s.reply):
                hits[m] = hits.get(m, 0) + 1
    print(f"replies in her days: {replies}; hits: {hits}", file=sys.stderr)
    print(write_page(runs, characters, settings.text.model, hits, replies))


if __name__ == "__main__":
    asyncio.run(main())
