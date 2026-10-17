"""PROTOTYPE（票 05 外貌一致性），用完即弃。

python -I gen.py [--only 子串] [--jobs 3]
按 PLAN 生成「角色 × 情境 × 做法」的对比图到 E:/tmp/nai-appearance/out/，已有的跳过；
每张的提示词、模型、耗时记进 out/manifest.json。key 从仓库的 .env.novelai 读，不打印。
"""
import base64, io, json, os, sys, time, urllib.error, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
ROOT = "E:/tmp/nai-appearance"
OUT = f"{ROOT}/out"
ENV = "E:/Download/others/agent-test/eidolon-sc/.env.novelai"
cfg = dict(l.strip().split("=", 1) for l in open(ENV, encoding="utf-8") if "=" in l and not l.startswith("#"))
URL, KEY = cfg["NOVELAI_RELAY_URL"].strip().rstrip("/"), cfg["NOVELAI_RELAY_KEY"].strip()

# 外貌 tag：对着存储桶里默认衣装的缩略图手写，参考 Danbooru 共现 tag（tools/related.py）
IDOLS = {
    "mano": ("sakuragi mano", "brown hair, medium hair, brown eyes"),
    "asahi": ("serizawa asahi", "grey hair, short hair, blue eyes"),
    "natsuha": ("arisugawa natsuha", "orange hair, long hair, wavy hair, swept bangs, grey eyes"),
    "chiyoko": ("sonoda chiyoko", "brown hair, double bun, twintails, red eyes"),
    "haruki": ("ikuta haruki", "brown hair, short hair, yellow eyes"),
}
# 情境：按「拍板：怎么触发、谁来写提示词」的分栏写（拍法、景别、地点、服装、动作）；种子按情境固定
SCENES = {
    "selfie": (1001, "selfie, looking at viewer, upper body", "cafe, indoors, window, sunlight", "casual, sweater",
               "smile, peace sign"),
    "office": (1002, "looking at viewer, cowboy shot", "office, indoors, sofa, evening", "white shirt, skirt",
               "sitting, holding cup, smile"),
    "outdoor": (1003, "looking at viewer, full body", "street, outdoors, autumn, sunset", "coat, scarf",
                "walking, looking back, open mouth"),
    "stage": (1004, "looking at viewer, cowboy shot", "stage, concert, stage lights, night", "idol clothes",
              "waving, smile"),
}
# 做法：模型 + 是否拼外貌 tag + 是否带角色参考图
VARIANTS = {
    "v5c-name": ("nai-diffusion-5-curated", False, False),
    "v5c-look": ("nai-diffusion-5-curated", True, False),
    "v5f-name": ("nai-diffusion-5-full", False, False),
    "v45c-name": ("nai-diffusion-4-5-curated", False, False),
    "v45c-ref": ("nai-diffusion-4-5-curated", False, True),
}
TAIL = "rating:general, very aesthetic, masterpiece, no text"
NEG = ("nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, "
       "very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, "
       "too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy")


def ref_image(idol):
    """缩略图（400×500 透明）铺白底，等比放进 1024×1536，四周补黑边。"""
    src = Image.open(f"{ROOT}/ref/{idol}.png").convert("RGBA")
    white = Image.new("RGBA", src.size, (255, 255, 255, 255))
    white.alpha_composite(src)
    s = min(1024 / src.width, 1536 / src.height)
    im = white.convert("RGB").resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
    canvas = Image.new("RGB", (1024, 1536), (0, 0, 0))
    canvas.paste(im, ((1024 - im.width) // 2, (1536 - im.height) // 2))
    buf = io.BytesIO()
    canvas.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def build(idol, scene, variant):
    tag, look = IDOLS[idol]
    seed, shot, place, outfit, action = SCENES[scene]
    model, with_look, with_ref = VARIANTS[variant]
    head = f"1girl, solo, {tag}, idolmaster shiny colors" + (f", {look}" if with_look else "")
    prompt = f"{head}, {shot}, {place}, {outfit}, {action}, {TAIL}"
    v45 = "4-5" in model
    params = {"params_version": 3, "width": 832, "height": 1216, "scale": 5 if v45 else 7,
              "sampler": "k_euler_ancestral", "steps": 23, "n_samples": 1, "ucPreset": 3, "qualityToggle": False,
              "seed": seed, "noise_schedule": "karras", "cfg_rescale": 0, "negative_prompt": NEG,
              "v4_prompt": {"caption": {"base_caption": prompt, "char_captions": []}, "use_coords": False,
                            "use_order": True},
              "v4_negative_prompt": {"caption": {"base_caption": NEG, "char_captions": []}, "legacy_uc": False}}
    if with_ref:
        params |= {"director_reference_images": [ref_image(idol)],
                   "director_reference_descriptions": [
                       {"caption": {"base_caption": "character", "char_captions": []}, "legacy_uc": False}],
                   "director_reference_information_extracted": [1],
                   "director_reference_strength_values": [1],
                   "director_reference_secondary_strength_values": [0]}
    return model, prompt, {"input": prompt, "model": model, "action": "generate", "parameters": params}


def run(job):
    idol, scene, variant = job
    name = f"{idol}__{scene}__{variant}"
    fn = f"{OUT}/{name}.png"
    if os.path.exists(fn):
        return name, None
    model, prompt, body = build(idol, scene, variant)
    req = urllib.request.Request(f"{URL}/ai/generate-image", data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    t0 = time.time()
    try:
        raw = urllib.request.urlopen(req, timeout=180).read()
    except urllib.error.HTTPError as e:
        return name, {"error": f"HTTP {e.code} {e.read()[:300]!r}", "prompt": prompt, "model": model}
    except Exception as e:
        return name, {"error": f"{type(e).__name__} {e}", "prompt": prompt, "model": model}
    dt = time.time() - t0
    if raw[:4] != b"PK\x03\x04":
        return name, {"error": f"not zip: {raw[:300]!r}", "prompt": prompt, "model": model}
    z = zipfile.ZipFile(io.BytesIO(raw))
    img = z.read(z.namelist()[0])
    Image.open(io.BytesIO(img)).convert("RGB").save(f"{OUT}/{name}.jpg", quality=88)  # 对比页用
    open(fn, "wb").write(img)
    return name, {"prompt": prompt, "model": model, "seconds": round(dt, 1), "ref": VARIANTS[variant][2]}


def main():
    args = sys.argv[1:]
    only = args[args.index("--only") + 1] if "--only" in args else ""
    jobs_n = int(args[args.index("--jobs") + 1]) if "--jobs" in args else 3
    os.makedirs(OUT, exist_ok=True)
    mf = f"{OUT}/manifest.json"
    manifest = json.load(open(mf, encoding="utf-8")) if os.path.exists(mf) else {}
    jobs = [(i, s, v) for v in VARIANTS for i in IDOLS for s in SCENES if only in f"{i}__{s}__{v}"]
    with ThreadPoolExecutor(jobs_n) as ex:
        for name, rec in ex.map(run, jobs):
            if rec is None:
                continue
            manifest[name] = rec
            print(name, rec.get("error") or f"ok {rec['seconds']}s", flush=True)
            with open(mf, "w", encoding="utf-8", newline="\n") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
