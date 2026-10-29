"""告别站的数据：停机前导出一次，写进 farewell/data/，和站点一起提交。只用标准库。

    python export.py stats <库文件> [--out 目录]   # 在 VPS 上跑：统计页的数（stats.json）
    python export.py snapshot [--site 地址] [--out 目录]   # 在本机跑：角色列表、落地页素材、礼物名的快照

stats 只读地打开库（`mode=ro`），只查现有的表，不写任何东西；只有聚合后的数，没有谁的名字、说了什么。
口径（页面上不写）：
- 删号、删对话都是真删，所以数的都是还在库里的；
- 通话从 2026-10-17 起才记在 calls 表里（ADR-0021），在那之前的通话不在里面；
- 「被她挂断」是她在通话里挂断时留下的对话事件（conversation_events.kind = 'hung_up'）；
- 时间都按北京时间；开站日是第一位用户注册的那天，截止日是跑脚本的那天。

snapshot 从线上的公开接口取角色列表（/api/characters）和落地页素材（/api/landing），只留落地页读的字段；
礼物名读仓库里的 characters/gifts.toml（要 Python 3.11 以上）。
"""

import argparse
import json
import sqlite3
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"
REPO = HERE.parent.parent
BEIJING = timezone(timedelta(hours=8))
SITE = "https://283ai.hmhnk.top"

# 落地页读的角色字段（src/lib/api.ts 的 Character）。
CHARACTER_FIELDS = (
    "id", "name", "color", "stand", "idol_id", "name_zh", "unit", "unit_order",
    "greeting", "call_opener", "call_poster_url", "voxels_url",
)


def beijing(iso: str) -> datetime:
    return datetime.fromisoformat(iso).astimezone(BEIJING)


def stats(db: sqlite3.Connection) -> dict:
    one = lambda sql: db.execute(sql).fetchone()  # noqa: E731
    first_user = one("SELECT MIN(created_at) FROM users")[0]
    opened = beijing(first_user).date() if first_user else datetime.now(BEIJING).date()
    closed = datetime.now(BEIJING).date()

    by_role = dict(db.execute("SELECT role, COUNT(*) FROM messages GROUP BY role").fetchall())

    calls, seconds, longest = one("SELECT COUNT(*), COALESCE(SUM(duration_s), 0), COALESCE(MAX(duration_s), 0) FROM calls")
    hung_up = one("SELECT COUNT(*) FROM conversation_events WHERE kind = 'hung_up'")[0]

    per_character = dict(
        db.execute(
            "SELECT c.character_id, COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id"
            " GROUP BY c.character_id"
        ).fetchall()
    )

    # 制作人发出的话在一天里的分布（北京时间，按小时）。库里的时间是带时区的 ISO 文本，逐条换算。
    hours = [0] * 24
    for (created_at,) in db.execute("SELECT created_at FROM messages WHERE role = 'user'"):
        hours[beijing(created_at).hour] += 1

    gifts = one("SELECT COUNT(*) FROM conversation_events WHERE kind = 'gift'")[0]
    top_gift = one(
        "SELECT gift_id, COUNT(*) AS n FROM conversation_events WHERE kind = 'gift' AND gift_id IS NOT NULL"
        " GROUP BY gift_id ORDER BY n DESC, gift_id LIMIT 1"
    )

    memories = one("SELECT COUNT(*) FROM memories WHERE superseded_by IS NULL")[0]
    visits, drunk = one("SELECT COUNT(*), COALESCE(SUM(drunk), 0) FROM visit_records")

    return {
        "opened": opened.isoformat(),
        "closed": closed.isoformat(),
        "days": (closed - opened).days + 1,
        "producers": one("SELECT COUNT(*) FROM users")[0],
        "messages": {"producers": by_role.get("user", 0), "idols": by_role.get("character", 0)},
        "calls": {"count": calls, "seconds": round(seconds), "longest_seconds": round(longest), "hung_up": hung_up},
        "characters": per_character,
        "hours": hours,
        "gifts": {"count": gifts, "top": {"id": top_gift[0], "count": top_gift[1]} if top_gift else None},
        "memories": memories,
        "bar": {"visits": visits, "drunk": drunk},
    }


def fetch(url: str):
    with urllib.request.urlopen(url, timeout=30) as res:
        return json.load(res)


def snapshot(site: str) -> dict[str, object]:
    import tomllib

    characters = [{k: c.get(k) for k in CHARACTER_FIELDS} for c in fetch(f"{site}/api/characters")]
    landing = fetch(f"{site}/api/landing")
    with open(REPO / "characters" / "gifts.toml", "rb") as f:
        gifts = {g["id"]: g["name"] for g in tomllib.load(f)["gifts"]}
    return {"characters.json": characters, "landing.json": landing, "gifts.json": gifts}


def write(out: Path, name: str, value: object) -> None:
    out.mkdir(parents=True, exist_ok=True)
    path = out / name
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"写好了 {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    s = sub.add_parser("stats")
    s.add_argument("database", type=Path)
    s.add_argument("--out", type=Path, default=DATA)
    p = sub.add_parser("snapshot")
    p.add_argument("--site", default=SITE)
    p.add_argument("--out", type=Path, default=DATA)
    args = parser.parse_args()

    if args.command == "stats":
        if not args.database.is_file():
            sys.exit(f"找不到库文件：{args.database}")
        db = sqlite3.connect(f"{args.database.resolve().as_uri()}?mode=ro", uri=True)
        try:
            write(args.out, "stats.json", stats(db))
        finally:
            db.close()
    else:
        for name, value in snapshot(args.site.rstrip("/")).items():
            write(args.out, name, value)


if __name__ == "__main__":
    main()
