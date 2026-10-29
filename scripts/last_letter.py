"""停服前最后一版（last-letter 分支）的信：把 characters/letters/*.toml 合成语音、配上音乐、上传，生成前端用的数据和字体子集。

每封信按段念：抬头和每段正文各合成一次（Drama 3，她的音色，读音词典和招呼一样用整份 readings.toml）；署名不念，
信上用她手写的签名图。合成要无损的 wav、latency 用 normal（文档说默认的 balanced 是为流式压低首包延迟，
normal 最稳；之前用默认值合成的 mp3 偶尔有爆音）。

拼音频：段与段之间留停顿，她的声音统一到 VOICE_LUFS；底下铺配乐（BGM，不进仓库，只拼进上传的音频里），
配乐从整小节淡入，她开口时压低，念完最后一段、签名开始写出来的那一刻正好是配乐第一次高潮进来的那一拍，
配乐回到原来的音量放满四小节再淡出。最后限幅（峰值约 -1.5 dB），只编码一次成 mp3，记下每段在音频里的起止秒数。
拼好的音频按内容哈希放进立绘的存储桶 `letters/<id>-<hash>.mp3`（CDN 缓存一年，内容变了地址就变），
这封信旧的地址删掉。

签名图从 _签名/（不进仓库，文件名里有她的全名）取，裁掉透明边、缩小成 webp，放进 `letters/signatures/<id>-<hash>.webp`。

写出两样东西，都提交：
- frontend/src/components/letter/letters.json：每封信页面上显示的字（去掉语气提示）、字幕、签名图和音频的地址、每段起止；
- frontend/src/components/letter/fonts/KleeOne-SemiBold.woff2：Klee One（SIL OFL 1.1）按信里用到的字做的子集。

用法（在 backend/ 下，先 `set -a; . ../.env; set +a`）：

    PYTHONIOENCODING=utf-8 uv run python ../scripts/last_letter.py            # 合成、拼好、上传、写数据和字体
    PYTHONIOENCODING=utf-8 uv run python ../scripts/last_letter.py --no-upload # 合成、拼好，不上传（校对时听）
    PYTHONIOENCODING=utf-8 uv run python ../scripts/last_letter.py --no-audio # 只写数据和字体，没有音频

每段的录音按「音色、模型、合成参数、念的字、读音」缓存在 frontend/.cache/last-letter/，改了哪段只重新合成哪段。
"""

import argparse
import asyncio
import hashlib
import io
import json
import math
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
SIGNATURES = ROOT / "_签名"
BGM = ROOT / "染み渡るように.m4a"
MODEL = "drama-3"
DIRECTORY = "letters"
CONCURRENCY = 4

PAUSE_AFTER_SALUTATION = 0.6
PAUSE_BETWEEN_PARAGRAPHS = 0.9
"""段与段之间的停顿（秒）：字幕在这时淡出，下一段再开始写。"""
SIGNATURE_DELAY = 0.8
"""念完最后一段后隔多久开始签名（秒），和前端 lib/letter 的 SIGNATURE_DELAY 一致。"""
SYNTHESIS = {"format": "wav", "sample_rate": 44100, "latency": "normal"}
"""每段的合成参数：无损、最稳的那一档（docs.fish.audio 的 Text to Speech 指南）。"""

CLIMAX = 83.94
"""配乐第一次高潮进来的那一拍（秒）：前面 66–80 秒是安静的间奏，80.8–83.4 秒几乎无声，像屏住一口气。
签名开始写出来的那一刻对准这一拍。"""
BAR = 2.5224
"""配乐一小节（约 95 BPM 的四拍）。从高潮那一拍往前数整小节，找配乐的起点。"""
MIN_LEAD = 2.2
"""拆开后配乐至少先响多久她才开口（秒）：信纸 0.8 秒展开，再让音乐铺一会儿。实际在 MIN_LEAD 到 MIN_LEAD + BAR
之间，好让配乐从整小节开始。"""
VOICE_LUFS = -17.0
"""她的声音统一到的响度（各人合成出来在 -15.5 到 -18.2 之间）。"""
MUSIC_GAIN = -6.5
"""配乐整体的增益（dB）：高潮约 -18 LUFS，和她的声音差不多响。"""
DUCK = -9.0
"""她说话时配乐再压低多少（dB）：铺在她声音下面 15 dB 左右。"""
FADE_IN = 1.5
TAIL = 10.1
"""高潮进来后配乐放满多久（秒，四小节），然后淡出。"""
FADE_OUT = 5.0
LIMIT = 0.84
"""拼好后限幅的峰值（线性，约 -1.5 dBFS），免得编码成 mp3 后冲顶爆音。"""

SIGNATURE_HEIGHT = 240
"""签名图的高度（像素）：信上占三行（约 108 px），两倍屏再留一点余量。"""

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


def loudness(path: Path) -> float:
    """整段的响度（LUFS，EBU R128 积分响度，静音不算在内）。"""
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    return float(re.findall(r"I:\s*(-?[0-9.]+) LUFS", out.stderr)[-1])


def envelope(points: list[tuple[float, float]]) -> str:
    """折线 `points`（秒, 线性增益）写成 ffmpeg volume 滤镜按帧求值的表达式；最后一点之后保持它的增益。"""
    expr = f"{points[-1][1]:.5f}"
    for (t0, g0), (t1, g1) in reversed(list(zip(points, points[1:]))):
        expr = f"if(lt(t,{t1:.3f}),{g0:.5f}+({g1 - g0:.5f})*(t-{t0:.3f})/{t1 - t0:.3f},{expr})"
    return expr


def assemble(letter: Letter, readings_key: str, with_music: bool) -> tuple[bytes, list[tuple[float, float]]]:
    """拼成一个 mp3，返回音频和每段的起止秒数（从拆开算起）。"""
    folder = CACHE / letter.character.id
    parts = [segment_cache(letter, text, readings_key) for text in letter.segments]
    lengths = [duration(p) for p in parts]
    pauses = [PAUSE_AFTER_SALUTATION] + [PAUSE_BETWEEN_PARAGRAPHS] * (len(parts) - 2) + [0.0]
    span = sum(lengths) + sum(pauses)
    # 配乐从高潮那一拍往前数 bars 小节开始，她在 lead 秒开口，签名开始写的那一刻（lead + span + SIGNATURE_DELAY）正好是高潮。
    bars = math.ceil((span + SIGNATURE_DELAY + MIN_LEAD) / BAR)
    start = CLIMAX - bars * BAR
    lead = bars * BAR - span - SIGNATURE_DELAY
    times, at = [], lead
    for length, pause in zip(lengths, pauses):
        times.append((round(at, 3), round(at + length, 3)))
        at += length + pause

    # 先拼出她的声音（开头留 lead 秒），量响度，算出统一到 VOICE_LUFS 要的增益。
    inputs = [arg for part in parts for arg in ("-i", str(part))]
    pads = ";".join(
        f"[{i}:a]aresample=44100,{f'adelay={round(lead * 1000)}:all=1,' if i == 0 else ''}apad=pad_dur={pause}[a{i}]"
        for i, pause in enumerate(pauses)
    )
    joined = "".join(f"[a{i}]" for i in range(len(parts)))
    alone = folder / "voice.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex",
         f"{pads};{joined}concat=n={len(parts)}:v=0:a=1[out]", "-map", "[out]", str(alone)],
        check=True,
    )
    gain = VOICE_LUFS - loudness(alone)

    out = folder / "letter.mp3"
    if not with_music:
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", str(alone), "-af",
             f"volume={gain:.2f}dB,alimiter=limit={LIMIT}:level=false",
             "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", str(out)],
            check=True,
        )
        return out.read_bytes(), times

    climax = lead + span + SIGNATURE_DELAY
    end = climax + TAIL + FADE_OUT
    full, duck = 10 ** (MUSIC_GAIN / 20), 10 ** ((MUSIC_GAIN + DUCK) / 20)
    music = envelope([
        (0, 0), (FADE_IN, full), (lead - 0.6, full), (lead, duck),
        (climax - 0.25, duck), (climax + 0.35, full), (climax + TAIL, full), (end, 0),
    ])
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(alone), "-ss", f"{start:.3f}", "-t", f"{end:.3f}", "-i", str(BGM),
         "-filter_complex",
         f"[0:a]volume={gain:.2f}dB,aresample=48000,aformat=channel_layouts=stereo[v];"
         f"[1:a]aresample=48000,aformat=channel_layouts=stereo,volume='{music}':eval=frame[m];"
         f"[v][m]amix=inputs=2:duration=longest:normalize=0,alimiter=limit={LIMIT}:level=false[out]",
         "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "160k", str(out)],
        check=True,
    )
    return out.read_bytes(), times


def signature_image(character: Character) -> bytes | None:
    """她手写的签名（_签名/ 里文件名带她全名的那张，透明底）：裁掉透明边，缩到 SIGNATURE_HEIGHT 高，转成 webp。没有时 None。"""
    from PIL import Image

    found = [p for p in SIGNATURES.glob("*.png") if character.name in p.stem]
    if not found:
        return None
    image = Image.open(found[0]).convert("RGBA")
    box = image.getchannel("A").getbbox()
    if box:
        image = image.crop(box)
    if image.height > SIGNATURE_HEIGHT:
        image = image.resize((round(image.width * SIGNATURE_HEIGHT / image.height), SIGNATURE_HEIGHT), Image.LANCZOS)
    out = io.BytesIO()
    image.save(out, "WEBP", quality=90, method=6)
    (CACHE / character.id).mkdir(parents=True, exist_ok=True)
    (CACHE / character.id / "signature.webp").write_bytes(out.getvalue())
    return out.getvalue()


async def upload(files: list[tuple[str, bytes, str]], bucket: S3Settings) -> None:
    """把 (key, 内容, 类型) 放进桶，删掉同一个人同一类文件旧的版本。"""
    storage = Bucket(bucket)
    try:
        keys = set(await storage.keys(f"{DIRECTORY}/"))
        for key, body, kind in files:
            if key not in keys:
                await storage.put(key, body, kind, GREETING_CACHE)
                print(f"  上传 {key}")
            stem = key.rsplit("-", 1)[0]
            suffix = key.rsplit(".", 1)[1]
            for old in sorted(k for k in keys if k != key and re.fullmatch(rf"{re.escape(stem)}-[0-9a-f]{{12}}\.{suffix}", k)):
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


def address(kind: str, character: Character, body: bytes, suffix: str) -> str:
    return f"{DIRECTORY}/{kind}{character.id}-{hashlib.sha256(body).hexdigest()[:12]}.{suffix}"


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-audio", action="store_true", help="不合成、不上传，只写数据和字体")
    parser.add_argument(
        "--no-upload", action="store_true", help="合成、拼好（缓存里的 <id>/letter.mp3，校对时听），不上传，数据里没有音频和签名图"
    )
    parser.add_argument("--no-music", action="store_true", help="不铺配乐，只有她的声音")
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
    signatures: dict[str, str] = {}
    if not args.no_audio:
        assets_url = os.environ["EIDOLON_STAND_ASSETS_URL"].rstrip("/")
        await voice_all(letters, FishAudioSettings.from_env().api_key, dictionary)
        files: list[tuple[str, bytes, str]] = []
        for letter in letters:
            data, times = assemble(letter, readings_key, with_music=not args.no_music)
            key = address("", letter.character, data, "mp3")
            files.append((key, data, "audio/mpeg"))
            audio[letter.character.id] = {"url": f"{assets_url}/{key}", "segments": times}
            image = signature_image(letter.character)
            if image is None:
                print(f"  {letter.character.id} 没有签名图，信上照字写", file=sys.stderr)
            else:
                key = address("signatures/", letter.character, image, "webp")
                files.append((key, image, "image/webp"))
                signatures[letter.character.id] = f"{assets_url}/{key}"
        if args.no_upload:
            audio.clear()
            signatures.clear()
        else:
            await upload(files, S3Settings.from_env(purpose="上传信的语音和签名"))

    data = {
        letter.character.id: {
            "salutation": without_cues(letter.salutation),
            "signature": without_cues(letter.signature),
            "signature_image": signatures.get(letter.character.id),
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
