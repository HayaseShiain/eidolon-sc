"""停服前最后一版（last-letter 分支）的信：把 characters/letters/*.toml 合成语音、上传，生成前端用的数据和字体子集。

每封信按段念：抬头和每段正文各合成一次（Drama 3，她的音色，读音词典和招呼一样用整份 readings.toml）；署名不念，
信上用她手写的签名图。合成要无损的 wav、latency 用 normal（文档说默认的 balanced 是为流式压低首包延迟，
normal 最稳；之前用默认值合成的 mp3 偶尔有爆音），再用 ffmpeg 拼起来，段与段之间留停顿，过一道限幅
（峰值压到约 -1.5 dB），只编码一次成 mp3，记下每段在音频里的起止秒数。拼好的音频按内容哈希放进立绘的
存储桶 `letters/<id>-<hash>.mp3`（CDN 缓存一年，内容变了地址就变），这封信旧的地址删掉。

写出两样东西，都提交：
- frontend/src/components/letter/letters.json：每封信页面上显示的字（去掉语气提示）、字幕、音频地址和每段起止；
- frontend/src/components/letter/fonts/KleeOne-SemiBold.woff2：Klee One（SIL OFL 1.1）按信里用到的字做的子集。

用法（在 backend/ 下，先 `set -a; . ../.env; set +a`）：

    PYTHONIOENCODING=utf-8 uv run python ../scripts/last_letter.py            # 合成、上传、写数据和字体
    PYTHONIOENCODING=utf-8 uv run python ../scripts/last_letter.py --no-upload # 合成、拼好，不上传（校对时听）
    PYTHONIOENCODING=utf-8 uv run python ../scripts/last_letter.py --no-audio # 只写数据和字体，没有音频

每段的录音按「音色、模型、合成参数、念的字、读音」缓存在 frontend/.cache/last-letter/，改了哪段只重新合成哪段。
"""

import argparse
import asyncio
import hashlib
import json
import os
import re
import struct
import subprocess
import sys
import tomllib
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import httpx

from eidolon.characters import Character, load_characters
from eidolon.delivery_cues import spoken_by, voiced, without_cues
from eidolon.greetings import FISH_TTS_HTTP_URL, GREETING_CACHE, FishAudioSettings
from eidolon.readings import load_readings, pronunciation_dictionary, readings_path
from eidolon.s3 import Bucket, S3Settings

ROOT = Path(__file__).resolve().parent.parent
LETTERS = ROOT / "characters" / "letters"
OUT = ROOT / "frontend" / "src" / "components" / "letter"
CACHE = ROOT / "frontend" / ".cache" / "last-letter"
MODEL = "drama-3"
DIRECTORY = "letters"
CONCURRENCY = 4

LEAD_IN = 1.2
"""音频开头的静音（秒）：点开信封时音频就开始放（浏览器只在点击里让出声），信纸展开的这段时间她还没开口。"""
PAUSE_AFTER_SALUTATION = 0.6
PAUSE_BETWEEN_PARAGRAPHS = 0.9
"""段与段之间的停顿（秒）：字幕在这时淡出，下一段再开始写。"""
SYNTHESIS = {"format": "wav", "sample_rate": 44100, "latency": "normal"}
"""每段的合成参数：无损、最稳的那一档（docs.fish.audio 的 Text to Speech 指南）。"""
LIMIT = 0.84
"""拼好后限幅的峰值（线性，约 -1.5 dBFS），免得编码成 mp3 后冲顶爆音。"""

KLEE_ONE = "https://github.com/google/fonts/raw/main/ofl/kleeone"
FONT_WEIGHTS = ("SemiBold",)
FONTTOOLS = "fonttools[woff]==4.61.1"
FEATURES = "ccmp,locl,liga,kern,palt,halt"

LETTER_READINGS = {"W.I.N.G.": "wi1N0gu0", "MC": "e0mu1si0i0", "Ｐたん": "pi1i0ta0N0"}
"""信里才有、readings.toml 没收的几个写法的读音（ウィング、エムシー、ピーたん，音素由 eidolon.reading_draft.to_phonemes 算出），
只加进合成信的读音词典。"""

_BRACKETS = re.compile(r"[()（）\[\]【】<>]")


@dataclass(frozen=True)
class Letter:
    character: Character
    salutation: str
    signature: str
    paragraphs: list[tuple[str, str]]  # (ja，带语气提示), zh

    @property
    def segments(self) -> list[str]:
        """按念的顺序：抬头、每段正文，带语气提示。署名不念。"""
        return [self.salutation, *(ja for ja, _ in self.paragraphs)]


def load_letters(characters: dict[str, Character]) -> list[Letter]:
    letters = []
    for path in sorted(LETTERS.glob("*.toml")):
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        character = characters.get(data["character"])
        if character is None or path.stem != data["character"]:
            raise SystemExit(f"{path.name}：character 不是这个文件名对应的角色")
        paragraphs = [(p["ja"].strip(), p["zh"].strip()) for p in data["paragraphs"]]
        letter = Letter(character, data["salutation"].strip(), data["signature"].strip(), paragraphs)
        for text in [*letter.segments, letter.signature]:
            if _BRACKETS.search(without_cues(text)):
                raise SystemExit(f"{path.name}：去掉语气提示后还有括号：{without_cues(text)}")
        letters.append(letter)
    return letters


def said(text: str) -> str:
    return spoken_by(voiced(text), MODEL)


def segment_cache(letter: Letter, text: str, readings_key: str) -> Path:
    params = json.dumps(SYNTHESIS, sort_keys=True)
    key = f"{letter.character.voice_id}\n{MODEL}\n{params}\n{said(text)}\n{readings_key}"
    return CACHE / letter.character.id / f"{hashlib.sha256(key.encode()).hexdigest()[:16]}.wav"


def fixed_wav(wav: bytes) -> bytes:
    """流式传回的 wav 头里 RIFF 和 data 的长度是占位的 0xFFFFFFxx，按实际长度改正，免得 ffmpeg 读错时长。"""
    data = wav.find(b"data", 12)
    if wav[:4] != b"RIFF" or data < 0:
        raise SystemExit("Fish Audio 返回的不是 wav")
    fixed = bytearray(wav)
    fixed[4:8] = struct.pack("<I", len(wav) - 8)
    fixed[data + 4 : data + 8] = struct.pack("<I", len(wav) - data - 8)
    return bytes(fixed)


async def voice(client: httpx.AsyncClient, api_key: str, text: str, voice_id: str, dictionary: list[dict] | None) -> bytes:
    """`text` 用她的音色念成 wav（SYNTHESIS），读音词典 `dictionary`；失败重试两次。"""
    body: dict[str, object] = {"text": text, "reference_id": voice_id, **SYNTHESIS}
    if dictionary is not None:
        body["pronunciation_dictionary"] = dictionary
    for attempt in range(3):
        try:
            response = await client.post(
                FISH_TTS_HTTP_URL, headers={"Authorization": f"Bearer {api_key}", "model": MODEL}, json=body
            )
        except httpx.HTTPError as e:
            print(f"  第 {attempt + 1} 次连不上：{e!r}", file=sys.stderr)
        else:
            if response.is_success and response.content:
                return fixed_wav(response.content)
            print(f"  第 {attempt + 1} 次失败：{response.status_code} {response.text[:200]}", file=sys.stderr)
        await asyncio.sleep(3)
    raise SystemExit(f"合成失败：{text[:20]}…")


async def voice_all(letters: list[Letter], api_key: str, dictionary: list[dict] | None) -> None:
    readings_key = json.dumps(dictionary, ensure_ascii=False, sort_keys=True)
    todo = [
        (letter, text, path)
        for letter in letters
        for text in letter.segments
        if not (path := segment_cache(letter, text, readings_key)).exists()
    ]
    print(f"要合成 {len(todo)} 段（其余已缓存）")
    limit = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=10)) as client:

        async def one(letter: Letter, text: str, path: Path) -> None:
            async with limit:
                audio = await voice(client, api_key, said(text), letter.character.voice_id, dictionary)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(audio)
            print(f"  {letter.character.id}：{without_cues(text)[:20]}…")

        await asyncio.gather(*(one(*t) for t in todo))


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def assemble(letter: Letter, readings_key: str) -> tuple[bytes, list[tuple[float, float]]]:
    """拼成一个 mp3，返回音频和每段的起止秒数。"""
    parts = [segment_cache(letter, text, readings_key) for text in letter.segments]
    pauses = [PAUSE_AFTER_SALUTATION] + [PAUSE_BETWEEN_PARAGRAPHS] * (len(parts) - 2) + [0.0]
    times, at = [], LEAD_IN
    for part, pause in zip(parts, pauses):
        length = duration(part)
        times.append((round(at, 3), round(at + length, 3)))
        at += length + pause
    inputs = [arg for part in parts for arg in ("-i", str(part))]
    lead = f"adelay={int(LEAD_IN * 1000)}:all=1,"
    pads = ";".join(
        f"[{i}:a]aresample=44100,{lead if i == 0 else ''}apad=pad_dur={pause}[a{i}]" for i, pause in enumerate(pauses)
    )
    joined = "".join(f"[a{i}]" for i in range(len(parts)))
    out = CACHE / letter.character.id / "letter.mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex",
         f"{pads};{joined}concat=n={len(parts)}:v=0:a=1,alimiter=limit={LIMIT}:level=false[out]",
         "-map", "[out]", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", str(out)],
        check=True,
    )
    return out.read_bytes(), times


async def upload(entries: dict[str, tuple[bytes, str]], bucket: S3Settings) -> None:
    storage = Bucket(bucket)
    try:
        keys = set(await storage.keys(f"{DIRECTORY}/"))
        for character_id, (audio, key) in entries.items():
            if key not in keys:
                await storage.put(key, audio, "audio/mpeg", GREETING_CACHE)
                print(f"  上传 {key}")
            for old in sorted(k for k in keys if k != key and re.fullmatch(rf"{DIRECTORY}/{character_id}-[0-9a-f]{{12}}\.mp3", k)):
                await storage.delete(old)
                print(f"  删除旧的 {old}")
    finally:
        await storage.aclose()


def subset_fonts(text: str) -> None:
    fonts = OUT / "fonts"
    fonts.mkdir(parents=True, exist_ok=True)
    glyphs = CACHE / "glyphs.txt"
    glyphs.parent.mkdir(parents=True, exist_ok=True)
    glyphs.write_text("".join(sorted(set(text) - {"\n"})), encoding="utf-8")
    for weight in FONT_WEIGHTS:
        source = CACHE / f"KleeOne-{weight}.ttf"
        if not source.exists():
            urllib.request.urlretrieve(f"{KLEE_ONE}/KleeOne-{weight}.ttf", source)
        subprocess.run(
            ["uv", "run", "--no-project", "--with", FONTTOOLS, "pyftsubset", str(source),
             f"--text-file={glyphs}", f"--layout-features={FEATURES}", "--flavor=woff2",
             "--no-hinting", "--desubroutinize", f"--output-file={fonts / f'KleeOne-{weight}.woff2'}"],
            check=True,
        )


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-audio", action="store_true", help="不合成、不上传，只写数据和字体")
    parser.add_argument(
        "--no-upload", action="store_true", help="合成、拼好（缓存里的 <id>/letter.mp3，校对时听），不上传，数据里没有音频"
    )
    args = parser.parse_args()

    characters_path = ROOT / "characters" / "characters.toml"
    characters = load_characters(characters_path, require_sheets=False)
    letters = load_letters(characters)
    missing = sorted(set(characters) - {letter.character.id for letter in letters})
    if missing:
        print(f"还没有信：{'、'.join(missing)}", file=sys.stderr)
    dictionary = pronunciation_dictionary(load_readings(readings_path(characters_path))) or [{"items": []}]
    dictionary[0]["items"] += [{"key": k, "value": v, "case_sensitive": True} for k, v in LETTER_READINGS.items()]
    readings_key = json.dumps(dictionary, ensure_ascii=False, sort_keys=True)

    audio: dict[str, dict] = {}
    if not args.no_audio:
        assets_url = os.environ["EIDOLON_STAND_ASSETS_URL"].rstrip("/")
        await voice_all(letters, FishAudioSettings.from_env().api_key, dictionary)
        entries = {}
        for letter in letters:
            data, times = assemble(letter, readings_key)
            key = f"{DIRECTORY}/{letter.character.id}-{hashlib.sha256(data).hexdigest()[:12]}.mp3"
            entries[letter.character.id] = (data, key)
            audio[letter.character.id] = {"url": f"{assets_url}/{key}", "segments": times}
        if args.no_upload:
            audio.clear()
        else:
            await upload(entries, S3Settings.from_env(purpose="上传信的语音"))

    data = {
        letter.character.id: {
            "salutation": without_cues(letter.salutation),
            "signature": without_cues(letter.signature),
            "paragraphs": [{"ja": without_cues(ja), "zh": zh} for ja, zh in letter.paragraphs],
            "audio": audio.get(letter.character.id),
        }
        for letter in letters
    }
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "letters.json", "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    # 信封上写她的全名，和信里的字一起收进子集；加上 ASCII 以防万一。
    text = "".join(without_cues(t) for letter in letters for t in [*letter.segments, letter.signature])
    text += "".join(c.name for c in characters.values()) + "".join(chr(i) for i in range(0x20, 0x7F))
    subset_fonts(text)
    print(f"写好了 {len(data)} 封信{'（没有音频）' if args.no_audio else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
