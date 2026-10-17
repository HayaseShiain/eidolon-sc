"""PROTOTYPE（票 11 画风），用完即弃。

python -I gen.py [--only 子串] [--jobs 3]
按 PLAN 生成「角色 × 情境 × 画风」的对比图到 E:/tmp/nai-art-style/out/，已有的跳过；
每张的提示词、模型、耗时记进 out/manifest.json。key 从仓库的 .env.novelai 读，不打印。
提示词、种子、参数和票 05 的 v5c-look 完全一样，只在作品 tag 后面多一段画风；
style=none 的对照图直接拷自 E:/tmp/nai-appearance/out/，不重新生成。
"""
import io, json, os, sys, time, urllib.error, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
ROOT = "E:/tmp/nai-art-style"
OUT = f"{ROOT}/out"
ENV = "E:/Download/others/agent-test/eidolon-sc/.env.novelai"
cfg = dict(l.strip().split("=", 1) for l in open(ENV, encoding="utf-8") if "=" in l and not l.startswith("#"))
URL, KEY = cfg["NOVELAI_RELAY_URL"].strip().rstrip("/"), cfg["NOVELAI_RELAY_KEY"].strip()

IDOLS = {
    "mano": ("sakuragi mano", "brown hair, medium hair, brown eyes"),
    "haruki": ("ikuta haruki", "brown hair, short hair, yellow eyes"),
}
SCENES = {
    "selfie": (1001, "selfie, looking at viewer, upper body", "cafe, indoors, window, sunlight", "casual, sweater",
               "smile, peace sign"),
    "office": (1002, "looking at viewer, cowboy shot", "office, indoors, sofa, evening", "white shirt, skirt",
               "sitting, holding cup, smile"),
    "outdoor": (1003, "looking at viewer, full body", "street, outdoors, autumn, sunset", "coat, scarf",
                "walking, looking back, open mouth"),
}
# 画风：插在作品 tag 后面的一段；用户在 nax.moe / tags.gallery 上挑的 6 位，单个、不加权重
STYLES = {
    "none": "",
    "ningen-mame": "artist:ningen mame",
    "starshadowmagician": "artist:starshadowmagician",
    "machi": "artist:machi (machi0910)",
    "deyui": "artist:deyui",
    "rella": "artist:rella",
    "toosaka-asagi": "artist:toosaka asagi",
    # 第三档：用户定了以 rella 为主，试权重和组合（V4 起的数值加权 `数字::…::`）
    "rella-1.3": "1.3::artist:rella::",
    "rella-0.7": "0.7::artist:rella::",
    "rella+mame": "artist:rella, 0.6::artist:ningen mame::",
    "rella+ssm": "artist:rella, 0.6::artist:starshadowmagician::",
}
MODEL = "nai-diffusion-5-curated"
TAIL = "rating:general, very aesthetic, masterpiece, no text"
NEG = ("nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, "
       "very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, "
       "too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy")
# 第一档：6 位画师 × 真乃 × 自拍、外景 = 12 张
TIER1 = [("mano", s, st) for st in list(STYLES)[1:7] for s in ("selfie", "outdoor")]
# 第二档：用户挑的 3 位 × はるき × 自拍、外景 = 6 张；rella 补事务所，真乃、はるき各 1 张
TIER2 = [("haruki", s, st) for st in ("ningen-mame", "starshadowmagician", "rella") for s in ("selfie", "outdoor")]     + [(i, "office", "rella") for i in IDOLS]
# 第三档：rella 的权重和组合 × 真乃 × 自拍 = 4 张
TIER3 = [("mano", "selfie", st) for st in ("rella-1.3", "rella-0.7", "rella+mame", "rella+ssm")]
PLAN = TIER1 + TIER2 + TIER3


def build(idol, scene, style):
    tag, look = IDOLS[idol]
    seed, shot, place, outfit, action = SCENES[scene]
    st = STYLES[style]
    head = f"1girl, solo, {tag}, idolmaster shiny colors" + (f", {st}" if st else "") + f", {look}"
    prompt = f"{head}, {shot}, {place}, {outfit}, {action}, {TAIL}"
    params = {"params_version": 3, "width": 832, "height": 1216, "scale": 7,
              "sampler": "k_euler_ancestral", "steps": 23, "n_samples": 1, "ucPreset": 3, "qualityToggle": False,
              "seed": seed, "noise_schedule": "karras", "cfg_rescale": 0, "negative_prompt": NEG,
              "v4_prompt": {"caption": {"base_caption": prompt, "char_captions": []}, "use_coords": False,
                            "use_order": True},
              "v4_negative_prompt": {"caption": {"base_caption": NEG, "char_captions": []}, "legacy_uc": False}}
    return prompt, {"input": prompt, "model": MODEL, "action": "generate", "parameters": params}


def run(job):
    idol, scene, style = job
    name = f"{idol}__{scene}__{style}"
    fn = f"{OUT}/{name}.png"
    if os.path.exists(fn):
        return name, None
    prompt, body = build(idol, scene, style)
    req = urllib.request.Request(f"{URL}/ai/generate-image", data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    t0 = time.time()
    try:
        raw = urllib.request.urlopen(req, timeout=180).read()
    except urllib.error.HTTPError as e:
        return name, {"error": f"HTTP {e.code} {e.read()[:300]!r}", "prompt": prompt, "model": MODEL}
    except Exception as e:
        return name, {"error": f"{type(e).__name__} {e}", "prompt": prompt, "model": MODEL}
    dt = time.time() - t0
    if raw[:4] != b"PK\x03\x04":
        return name, {"error": f"not zip: {raw[:300]!r}", "prompt": prompt, "model": MODEL}
    z = zipfile.ZipFile(io.BytesIO(raw))
    img = z.read(z.namelist()[0])
    Image.open(io.BytesIO(img)).convert("RGB").save(f"{OUT}/{name}.jpg", quality=88)  # 对比页用
    open(fn, "wb").write(img)
    return name, {"prompt": prompt, "model": MODEL, "seconds": round(dt, 1)}


def main():
    args = sys.argv[1:]
    only = args[args.index("--only") + 1] if "--only" in args else ""
    jobs_n = int(args[args.index("--jobs") + 1]) if "--jobs" in args else 3
    os.makedirs(OUT, exist_ok=True)
    mf = f"{OUT}/manifest.json"
    manifest = json.load(open(mf, encoding="utf-8")) if os.path.exists(mf) else {}
    for i in IDOLS:  # 对照图的提示词补进清单
        for s in SCENES:
            manifest.setdefault(f"{i}__{s}__none", {"prompt": build(i, s, "none")[0], "model": MODEL,
                                                    "copied_from": "E:/tmp/nai-appearance/out (v5c-look)"})
    jobs = [j for j in PLAN if only in "__".join(j)]
    with ThreadPoolExecutor(jobs_n) as ex:
        for name, rec in ex.map(run, jobs):
            if rec is None:
                continue
            manifest[name] = rec
            print(name, rec.get("error") or f"ok {rec['seconds']}s", flush=True)
            with open(mf, "w", encoding="utf-8", newline="\n") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=1)
    with open(mf, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
