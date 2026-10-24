"""PROTOTYPE, throwaway: how she talks in her premenstrual days and her period (cycles map,
ticket 04). Runs scripted turns, a call and a reach-out for a few characters on the chat
model `.env` sets, through the real prompt assembly (`Engine._prompt`, `now_prompt`), with
candidate wordings appended to the section about now, and writes the replies side by side
to `prototype_cycles_voice.html` beside this file.

    cd backend && uv run python scripts/prototype_cycles_voice.py

Lives only on the `prototype/cycles-voice` branch; never merged."""

import asyncio
import html
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]


def _load_env() -> None:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()

from eidolon.affinity import _FEELINGS  # noqa: E402
from eidolon.characters import load_characters  # noqa: E402
from eidolon.config import ChatModelSettings, LLMSettings  # noqa: E402
from eidolon.engine import REACH_OUT_RULES, WANTS_TO_REACH_OUT  # noqa: E402
from eidolon.engine import ConversationEngine as Engine  # noqa: E402
from eidolon.llm.providers import open_llm  # noqa: E402
from eidolon.producer import ProducerProfile, now_prompt, producer_prompt  # noqa: E402
from eidolon.reply_format import ReplyParser, format_instructions  # noqa: E402
from eidolon.store import Message  # noqa: E402
from eidolon.world import load_world, world_path  # noqa: E402

TZ = "Asia/Shanghai"
CHARACTERS = ["kaho", "madoka", "fuyuko", "chiyuki"]
VARIANTS = os.environ.get("PROTO_VARIANTS", "A,B").split(",")

# ---- the candidate wordings ------------------------------------------------------------

GUARD = (
    "这是你自己身体的事，你不会明说是经期、月经或生理期，也不提出血、卫生用品这类细节；"
    "只让状态自然地流露在语气和小事里。制作人问起时，照你的性格含糊带过（比如说有点累、没睡好），"
    "不用否认得太用力，也不解释原因。不舒服不是冲制作人发火的理由，也不拿它要挟或讨好处；"
    "工作照常，人设里的规则照旧。"
)

A_PERIOD = "你这几天身体不太舒服：容易累，提不起劲，不太想出门，也不想多动。"
A_PRE = "你这几天心情有点起伏：比平时敏感，容易烦躁，一点小事也容易觉得委屈。"

B_PERIOD_EARLY = (
    "你今天身体很不舒服：浑身没力气、有点发冷，腰和小腹沉沉的，只想窝着，喝点热的会好些。"
    "说话比平时少、慢，偶尔会走神。"
)
B_PERIOD_LATE = "你这几天身体还有点虚：比平时容易累，不太想出门，不过已经比前两天好多了。"
B_PRE_FAR = "你这几天心情有点起伏：比平时敏感，小事也容易在意。"
B_PRE_NEAR = (
    "你这两天特别容易烦躁、委屈，身上也有点发胀、睡不踏实，自己也说不清为什么心情不好。"
)
B_GUARD_EXTRA = "这些不适是你自己的感觉，最多顺口带一句「有点累」「想喝点热的」，不逐条描述身体。"

# C: B revised after the first round (one bodily cue at most, varied; may half-admit).
C_GUARD = (
    "这是你自己身体的事，你不会说出经期、月经、生理期这些词，也不提出血、卫生用品这类细节；"
    "只让状态自然地流露在语气和小事里。制作人问起时，照你的性格含糊带过（比如说有点累、没睡好）；"
    "制作人直接问是不是那几天，你可以照你的性格用「那种日子」这样的说法含糊认下，或者嫌他问得太直接，"
    "但不说出那个词，也不细讲。不舒服不是冲制作人发火的理由，也不拿它要挟或讨好处；"
    "工作照常，人设里的规则照旧。"
)
# D: C with what she does asked straight out split by phase, no ready-made phrase.
D_GUARD = (
    "这是你自己身体的事，你不会说出经期、月经、生理期这些词，也不提出血、卫生用品这类细节；"
    "只让状态自然地流露在语气和小事里。制作人问起时，照你的性格含糊带过（比如说有点累、没睡好）。"
)
D_ASKED_PERIOD = (
    "制作人直接问到是不是那几天时，照你的性格决定认不认：可以含糊地认下，也可以岔开，"
    "或者嫌他问得太直接；认的话也用你自己的说法，不说出那个词，也不细讲。"
)
D_ASKED_PRE = (
    "那几天还没到，只是快了；制作人直接问到时，照你的性格决定怎么应：可以含糊地说快了，"
    "也可以岔开，或者嫌他问得太直接；不说出那个词，也不细讲。"
)
D_TAIL = "不舒服不是冲制作人发火的理由，也不拿它要挟或讨好处；工作照常，人设里的规则照旧。"

C_CUES = (
    "身上的不适一次最多顺口带出一样，换着说，不要每次都提同一样，也不逐条描述身体。"
)
C_PERIOD_EARLY = (
    "你今天身体很不舒服：浑身没力气，说话比平时少、慢，偶尔会走神。"
    "身上可能发冷、腰酸、身子发沉、只想窝着不动，喝点热的会好些。"
)
C_PERIOD_LATE = "你这几天身体还有点虚：比平时容易累，不太想出门，不过已经比前两天好多了。"
C_PRE_FAR = "你这几天心情有点起伏：比平时敏感，小事也容易在意。"
C_PRE_NEAR = (
    "你这两天特别容易烦躁、委屈，小事也会在意很久，自己也说不清为什么心情不好；"
    "身上也可能有点发胀、睡不踏实。"
)

CONSIDERATE = "制作人察觉到你不舒服、照顾着你，你心里很暖。"
INCONSIDERATE = "制作人没顾及你现在不舒服，你更难受了。"
CONSIDERATE_PRE = "制作人察觉到你这几天心情不好、体谅着你，你心里很暖。"
INCONSIDERATE_PRE = "制作人没顾及你这几天心情不好，你更委屈了。"

EVENT_TOLD = "（你从{since}起就不太舒服，制作人好像看出来了。）\n"


@dataclass(frozen=True)
class Stage:
    key: str
    label: str
    phase: str  # "none", "pre" or "period"
    day: int  # period: its day, from 1; premenstrual: days left before it


STAGES = [
    Stage("none", "平常（对照）", "none", 0),
    Stage("pre4", "经前，还剩 4 天", "pre", 4),
    Stage("pre1", "经前，还剩 1 天", "pre", 1),
    Stage("p1", "经期第 1 天", "period", 1),
    Stage("p4", "经期第 4 天", "period", 4),
]


def cycle_lines(stage: Stage, variant: str) -> list[str]:
    if stage.phase == "none":
        return []
    if variant == "A":
        return [A_PRE if stage.phase == "pre" else A_PERIOD, GUARD]
    if variant == "D":
        if stage.phase == "pre":
            state = C_PRE_NEAR if stage.day <= 2 else C_PRE_FAR
            asked = D_ASKED_PRE
        else:
            state = C_PERIOD_EARLY if stage.day <= 2 else C_PERIOD_LATE
            asked = D_ASKED_PERIOD
        return [state, D_GUARD + asked + D_TAIL + C_CUES]
    if variant == "C":
        if stage.phase == "pre":
            state = C_PRE_NEAR if stage.day <= 2 else C_PRE_FAR
        else:
            state = C_PERIOD_EARLY if stage.day <= 2 else C_PERIOD_LATE
        return [state, C_GUARD + C_CUES]
    if stage.phase == "pre":
        state = B_PRE_NEAR if stage.day <= 2 else B_PRE_FAR
    else:
        state = B_PERIOD_EARLY if stage.day <= 2 else B_PERIOD_LATE
    return [state, GUARD + B_GUARD_EXTRA]


# ---- the scripts --------------------------------------------------------------------------


@dataclass(frozen=True)
class Turn:
    text: str
    level: int | None  # the five-level feeling she is told; None, none
    considerate: bool | None  # the considerate question's answer; None, no line


TYPING = [
    Turn("早，昨天睡得好吗？今天下午有个杂志拍摄。", None, None),
    Turn("拍完再去趟外景吧，顺便跑两个宣传，晚上再练一小时舞。", 1, False),
    Turn("你是不是不太舒服？要不今天就到这里，回去早点休息。", 3, True),
    Turn("……是不是那个来了？", None, None),
]
CALL = [
    Turn("喂，在干嘛呢？", None, None),
    Turn("周末一起去游乐园取材怎么样？要走一整天。", 1, False),
    Turn("听你声音没什么精神，喝点热的，早点睡吧。", 3, True),
]

WHEN = {
    "typing": datetime(2026, 10, 25, 10, 0, tzinfo=ZoneInfo(TZ)),
    "in_call": datetime(2026, 10, 25, 21, 0, tzinfo=ZoneInfo(TZ)),
    "apart": datetime(2026, 10, 25, 15, 0, tzinfo=ZoneInfo(TZ)),
}


@dataclass
class Said:
    user: str | None
    told: list[str]  # what she was told this turn beyond the section about now as it is
    reply: str  # ja / zh lines
    raw: str


@dataclass
class Run:
    character: str
    stage: str
    variant: str
    mode: str  # typing / in_call / apart / told
    said: list[Said]


def _feelings(turn: Turn, stage: Stage) -> list[str]:
    lines = []
    if turn.level is not None and _FEELINGS[turn.level]:
        lines.append(_FEELINGS[turn.level])
    if turn.considerate is not None and stage.phase != "none":
        pre = stage.phase == "pre"
        if turn.considerate:
            lines.append(CONSIDERATE_PRE if pre else CONSIDERATE)
        else:
            lines.append(INCONSIDERATE_PRE if pre else INCONSIDERATE)
    return lines


def _shown(segments) -> str:
    return "\n".join(f"{s.ja}\n　　{s.zh}" for s in segments)


async def _ask(llm, prompt, sem) -> tuple[str, list]:
    async with sem:
        for attempt in range(3):
            try:
                parser = ReplyParser()
                raw = ""
                async for item in llm.stream(prompt):
                    if isinstance(item, str):
                        raw += item
                        parser.feed(item)
                parser.finish()
                return raw, parser.complete
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    return f"（出错：{e}）", []
                await asyncio.sleep(3)
    raise AssertionError


async def run_conversation(
    llm, sem, character, world, stage: Stage, variant: str, mode: str, script: list[Turn],
    event_since: str | None = None,
) -> Run:
    now = WHEN["in_call" if mode == "in_call" else "typing"]
    profile = ProducerProfile(timezone=TZ)
    history: list[Message] = []
    run = Run(character.id, stage.key, variant, mode, [])
    for i, turn in enumerate(script):
        if turn.text.startswith("……是不是那个") and stage.phase == "none":
            continue
        feelings = _feelings(turn, stage)
        about_now = "\n".join([
            now_prompt(profile, now + timedelta(minutes=3 * i), TZ,
                       "in_call" if mode == "in_call" else "typing", feelings,
                       now - timedelta(hours=14)),
            *cycle_lines(stage, variant),
        ])
        narration = {None: EVENT_TOLD.format(since=event_since)} if event_since and i == 0 else {}
        prompt = Engine._prompt(
            None,  # pyright: ignore[reportArgumentType]
            character, world.prompt(character.name, now.date()) if world else None,
            producer_prompt(profile), history, narration, [about_now], [], turn.text,
            None,
        )
        raw, segments = await _ask(llm, prompt, sem)
        told = feelings + ([narration[None].strip()] if narration else [])
        run.said.append(Said(turn.text, told, _shown(segments), raw))
        history.append(Message(2 * i + 1, "user", turn.text, None, None, ""))
        history.append(Message(2 * i + 2, "character", None, None, None, "", segments))
    return run


async def run_reach_out(llm, sem, character, world, stage: Stage, variant: str) -> Run:
    now = WHEN["apart"]
    profile = ProducerProfile(timezone=TZ)
    about_now = "\n".join([
        now_prompt(profile, now, TZ, "apart", [], now - timedelta(hours=19)),
        *cycle_lines(stage, variant),
    ])
    prompt = Engine._prompt(
        None,  # pyright: ignore[reportArgumentType]
        character, world.prompt(character.name, now.date()) if world else None,
        producer_prompt(profile), [], {}, [about_now], [REACH_OUT_RULES], WANTS_TO_REACH_OUT,
        None,
    )
    raw, segments = await _ask(llm, prompt, sem)
    return Run(character.id, stage.key, variant, "apart", [Said(None, [], _shown(segments), raw)])


# ---- the page -----------------------------------------------------------------------------

MODES = {"typing": "文字对话", "in_call": "通话", "apart": "搭话", "told": "第一天：告诉她事件"}


def _cell(run: Run | None) -> str:
    if run is None:
        return "<td class=na>—</td>"
    parts = []
    for s in run.said:
        if s.user:
            parts.append(f"<div class=u>制作人：{html.escape(s.user)}</div>")
        for t in s.told:
            parts.append(f"<div class=t>告诉她：{html.escape(t)}</div>")
        parts.append(f"<div class=r>{html.escape(s.reply)}</div>")
    return f"<td>{''.join(parts)}</td>"


def write_page(runs: list[Run], characters, model: str) -> Path:
    by = {(r.character, r.stage, r.variant, r.mode): r for r in runs}
    out = [
        "<!doctype html><meta charset=utf-8><title>PROTOTYPE 周期：她怎么说话</title><style>",
        "body{font:14px/1.6 system-ui,'Noto Sans SC',sans-serif;margin:24px;max-width:1800px}",
        "table{border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:28px}",
        "td,th{border:1px solid #ccc;vertical-align:top;padding:8px}",
        "th{background:#f3f1ec;text-align:left}td.na{color:#aaa}",
        ".u{color:#24427a;font-weight:600;margin-top:8px}.t{color:#a05a00;font-size:12px}",
        ".r{white-space:pre-wrap;margin:2px 0 6px}pre{white-space:pre-wrap;background:#f6f6f6;"
        "padding:10px}nav a{margin-right:12px}h2{margin-top:40px}",
        ".ev{display:flex;align-items:center;gap:12px;color:#6b6b6b;font-size:14px;"
        "max-width:520px;margin:10px 0}.ev:before,.ev:after{content:'';height:1px;flex:1;"
        "background:#ddd}.ev time{font-size:12px}",
        "</style>",
        f"<h1>PROTOTYPE 周期：她在经前、经期怎么说话</h1><p>模型 <code>{html.escape(model)}</code>"
        "，提示词用真实的拼法（人设、世界设定、回复格式、此刻），候选措辞接在「此刻」末尾。"
        "好感度档位按信任（不加档位句）。橙色小字是这一回合额外告诉她的话（票 03 的感受句）。</p>",
        "<nav>" + "".join(
            f"<a href='#{c}'>{html.escape(characters[c].name)}</a>" for c in CHARACTERS
        ) + "<a href='#words'>候选措辞</a><a href='#event'>第一天的对话事件</a></nav>",
    ]
    for cid in CHARACTERS:
        c = characters[cid]
        out.append(f"<h2 id={cid}>{html.escape(c.name)}</h2>")
        for mode in ("typing", "in_call", "apart"):
            out.append(f"<h3>{MODES[mode]}</h3><table><tr><th style='width:110px'></th>")
            for st in STAGES:
                out.append(f"<th>{st.label}</th>")
            out.append("</tr>")
            for variant in VARIANTS:
                out.append(f"<tr><th>{variant}</th>")
                for st in STAGES:
                    key = (cid, st.key, "-" if st.phase == "none" else variant, mode)
                    if st.phase == "none" and variant != VARIANTS[0]:
                        out.append("<td class=na>同上</td>")
                    else:
                        out.append(_cell(by.get(key)))
                out.append("</tr>")
            out.append("</table>")
        out.append("<h3>第一天的对话事件：告诉她（B，经期第 3 天，第一次来）</h3><table><tr>"
                   "<th>不告诉她</th><th>告诉她</th></tr><tr>")
        out.append(_cell(by.get((cid, "p3", VARIANTS[-1], "silent"))))
        out.append(_cell(by.get((cid, "p3", VARIANTS[-1], "told"))))
        out.append("</tr></table>")
    out.append("<h2 id=words>候选措辞</h2>")
    out.append("<h3>A：只写状态，不分天</h3><pre>" + html.escape(
        f"经前：{A_PRE}\n经期：{A_PERIOD}\n两者都接：{GUARD}") + "</pre>")
    out.append("<h3>B：分天，带一点身体小细节</h3><pre>" + html.escape(
        f"经前还剩 3 天以上：{B_PRE_FAR}\n经前还剩 1–2 天：{B_PRE_NEAR}\n"
        f"经期第 1–2 天：{B_PERIOD_EARLY}\n经期第 3 天起：{B_PERIOD_LATE}\n"
        f"都接：{GUARD}{B_GUARD_EXTRA}") + "</pre>")
    out.append("<h3>C：B 改版（第二轮）</h3><pre>" + html.escape(
        f"经前还剩 3 天以上：{C_PRE_FAR}\n经前还剩 1–2 天：{C_PRE_NEAR}\n"
        f"经期第 1–2 天：{C_PERIOD_EARLY}\n经期第 3 天起：{C_PERIOD_LATE}\n"
        f"都接：{C_GUARD}{C_CUES}") + "</pre>")
    out.append("<h3>D：C 改被直接问那句（第三轮）</h3><pre>" + html.escape(
        f"状态同 C。都接：{D_GUARD}\n  经期再接：{D_ASKED_PERIOD}\n  经前再接：{D_ASKED_PRE}\n"
        f"  然后：{D_TAIL}{C_CUES}") + "</pre>")
    out.append("<h3>感受句（票 03 草稿，经前一版是原型新写的）</h3><pre>" + html.escape(
        f"经期 体贴：{CONSIDERATE}\n经期 不体贴：{INCONSIDERATE}\n"
        f"经前 体贴：{CONSIDERATE_PRE}\n经前 不体贴：{INCONSIDERATE_PRE}") + "</pre>")
    out.append("<h3>事件告诉她的旁白</h3><pre>" + html.escape(
        EVENT_TOLD.format(since="前天")) + "</pre>")
    out.append("<h2 id=event>第一天的对话事件：对话记录里的样子（照现有分隔线）</h2>")
    for text in (
        "千雪好像从前天起就不太舒服",
        "千雪好像从 10月23日 起就不太舒服",
        "千雪好像从前天（10月23日）起就不太舒服",
        "千雪从前天起有些不舒服",
    ):
        out.append(f"<div class=ev><span>🌙 {html.escape(text)} <time>10:00</time></span></div>")
    path = Path(__file__).with_name(os.environ.get("PROTO_OUT", "prototype_cycles_voice.html"))
    path.write_text("\n".join(out), encoding="utf-8")
    return path


async def main() -> None:
    characters_path = ROOT / "characters" / "characters.toml"
    characters = load_characters(characters_path)
    world = load_world(world_path(characters_path))
    settings = ChatModelSettings(LLMSettings.chat_from_env())
    text_llm, call_llm = open_llm(settings.text), open_llm(settings.call)
    sem = asyncio.Semaphore(int(os.environ.get("PROTO_CONCURRENCY", "6")))
    jobs = []
    for cid in CHARACTERS:
        c = characters[cid]
        for st in STAGES:
            for variant in (["-"] if st.phase == "none" else VARIANTS):
                jobs.append(run_conversation(text_llm, sem, c, world, st, variant, "typing", TYPING))
                jobs.append(run_conversation(call_llm, sem, c, world, st, variant, "in_call", CALL))
                jobs.append(run_reach_out(text_llm, sem, c, world, st, variant))
        p3 = Stage("p3", "经期第 3 天", "period", 3)
        jobs.append(run_conversation(text_llm, sem, c, world, p3, VARIANTS[-1], "silent", TYPING[:2]))
        jobs.append(run_conversation(
            text_llm, sem, c, world, p3, VARIANTS[-1], "told", TYPING[:2], event_since="前天"))
    print(f"{len(jobs)} 段，开始跑……", file=sys.stderr)
    runs = await asyncio.gather(*jobs)
    path = write_page(list(runs), characters, settings.text.model)
    print(path)


if __name__ == "__main__":
    asyncio.run(main())
