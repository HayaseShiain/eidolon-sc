"""PROTOTYPE（票 11 画风），用完即弃。python -I page.py → E:/tmp/nai-art-style/index.html"""
import html, json, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0].rsplit("\\", 1)[0])
from gen import IDOLS, OUT, ROOT, SCENES, STYLES

NAMES = {"mano": "櫻木真乃", "haruki": "郁田はるき（冷门，Danbooru 499 帖）"}
SCENE_ZH = {"selfie": "自拍·咖啡店·便服", "office": "别人拍·事务所·衬衫", "outdoor": "别人拍·外景·全身·大衣"}

manifest = json.load(open(f"{OUT}/manifest.json", encoding="utf-8"))
sections = []
for i, (tag, look) in IDOLS.items():
    styles = [st for st in STYLES if any(k == f"{i}__{s}__{st}" for k in manifest for s in SCENES)]
    if not styles:
        continue
    head = "".join(f'<th>{"不加画风（对照，票 05 的图）" if st == "none" else html.escape(STYLES[st])}</th>'
                   for st in styles)
    rows = []
    for s in SCENES:
        cells = []
        for st in styles:
            n = f"{i}__{s}__{st}"
            rec = manifest.get(n, {})
            if "error" in rec or not rec:
                cells.append(f'<td class="err">{html.escape(rec.get("error", "未生成"))}</td>')
            else:
                cells.append(f'<td><img loading="lazy" src="out/{n}.jpg" '
                             f'data-p="{html.escape(rec["model"] + " · " + rec["prompt"])}"></td>')
        rows.append(f'<tr><th class="scene">{SCENE_ZH[s]}</th>{"".join(cells)}</tr>')
    sections.append(f"""<section><h2>{NAMES[i]}</h2>
<div class="row"><figure class="ref"><img src="ref/{i}.png"><figcaption>原作缩略图<br>
角色 tag：<code>{tag}</code><br>外貌 tag：<code>{look}</code></figcaption></figure>
<table><tr><th></th>{head}</tr>{"".join(rows)}</table></div></section>""")

page = f"""<!doctype html><meta charset="utf-8"><title>PROTOTYPE 画风</title>
<style>
body{{font:14px/1.5 system-ui,"Microsoft YaHei",sans-serif;margin:16px;background:#f4f2ef;color:#222}}
section{{margin:28px 0}} .row{{display:flex;gap:12px;align-items:flex-start}}
.ref{{margin:0;width:160px;flex:none}} .ref img{{width:160px;background:#ccc;border-radius:6px}}
.ref figcaption{{font-size:12px;color:#555}} code{{font-size:11px}}
table{{border-collapse:collapse}} td,th{{padding:3px;vertical-align:top}} th{{font-weight:600;font-size:12px}}
th.scene{{writing-mode:vertical-rl;text-align:center;color:#555}}
td img{{width:200px;border-radius:6px;cursor:zoom-in;display:block}} td.err{{width:200px;color:#b00;font-size:11px}}
#zoom{{position:fixed;inset:0;background:#000d;display:none;z-index:9;cursor:zoom-out;text-align:center}}
#zoom img{{max-height:88vh;margin-top:2vh}} #zoom p{{color:#ddd;max-width:900px;margin:8px auto;font-size:12px}}
</style>
<p><b>PROTOTYPE · 票 11 画风</b>　V5 Curated。每列一种画风，每行一个情境，同一行种子相同；
除了作品 tag 后面那段画风，提示词和票 05 的「角色 tag + 外貌 tag」一字不差。点图放大并显示提示词。</p>
{"".join(sections)}
<div id="zoom"><img><p></p></div>
<script>
const z=document.getElementById('zoom');
document.querySelectorAll('td img').forEach(i=>i.onclick=()=>{{z.querySelector('img').src=i.src.replace('.jpg','.png');
  z.querySelector('p').textContent=i.dataset.p;z.style.display='block'}});
z.onclick=()=>z.style.display='none';
</script>"""
open(f"{ROOT}/index.html", "w", encoding="utf-8", newline="\n").write(page)
print(f"{ROOT}/index.html")
