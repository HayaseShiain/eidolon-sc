"""PROTOTYPE（票 05 外貌一致性），用完即弃。python -I page.py → E:/tmp/nai-appearance/index.html"""
import html, json, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0].rsplit("\\", 1)[0])
from gen import IDOLS, OUT, ROOT, SCENES, VARIANTS

NAMES = {"mano": "櫻木真乃", "asahi": "芹沢あさひ", "natsuha": "有栖川夏葉", "chiyoko": "園田智代子",
         "haruki": "郁田はるき（冷门，Danbooru 499 帖）"}
SCENE_ZH = {"selfie": "自拍·咖啡店·便服", "office": "别人拍·事务所·衬衫", "outdoor": "别人拍·外景·全身·大衣",
            "stage": "别人拍·舞台·演出服"}
VAR_ZH = {"v5c-name": "V5 Curated<br>只写角色 tag", "v5c-look": "V5 Curated<br>角色 tag + 外貌 tag",
          "v5f-name": "V5 Full<br>只写角色 tag", "v45c-name": "V4.5 Curated<br>只写角色 tag",
          "v45c-ref": "V4.5 Curated<br>角色 tag + 参考图"}

manifest = json.load(open(f"{OUT}/manifest.json", encoding="utf-8"))
VARIANTS = [v for v in VARIANTS if sum(k.endswith("__" + v) for k in manifest) > 1]  # 只列生成过的做法
checks = "".join(f'<label><input type="checkbox" checked data-v="{v}"> {VAR_ZH[v].replace("<br>", " · ")}</label>'
                 for v in VARIANTS)
sections = []
for i, (tag, look) in IDOLS.items():
    head = "".join(f'<th class="c-{v}">{VAR_ZH[v]}</th>' for v in VARIANTS)
    rows = []
    for s in SCENES:
        cells = []
        for v in VARIANTS:
            n = f"{i}__{s}__{v}"
            rec = manifest.get(n, {})
            if "error" in rec or not rec:
                cells.append(f'<td class="c-{v} err">{html.escape(rec.get("error", "未生成"))}</td>')
            else:
                cells.append(f'<td class="c-{v}"><img loading="lazy" src="out/{n}.jpg" '
                             f'data-p="{html.escape(rec["model"] + " · " + rec["prompt"])}"></td>')
        rows.append(f'<tr><th class="scene">{SCENE_ZH[s]}</th>{"".join(cells)}</tr>')
    sections.append(f"""<section><h2>{NAMES[i]}</h2>
<div class="row"><figure class="ref"><img src="ref/{i}.png"><figcaption>原作缩略图（参考图用的就是这张）<br>
角色 tag：<code>{tag}</code><br>外貌 tag：<code>{look}</code></figcaption></figure>
<table><tr><th></th>{head}</tr>{"".join(rows)}</table></div></section>""")

page = f"""<!doctype html><meta charset="utf-8"><title>PROTOTYPE 外貌一致性</title>
<style>
body{{font:14px/1.5 system-ui,"Microsoft YaHei",sans-serif;margin:16px;background:#f4f2ef;color:#222}}
.bar{{position:sticky;top:0;background:#fff;padding:8px 12px;border-radius:8px;box-shadow:0 1px 4px #0002;z-index:2;
display:flex;gap:16px;flex-wrap:wrap}}
section{{margin:28px 0}} .row{{display:flex;gap:12px;align-items:flex-start}}
.ref{{margin:0;width:200px;flex:none}} .ref img{{width:200px;background:#ccc;border-radius:6px}}
.ref figcaption{{font-size:12px;color:#555}} code{{font-size:11px}}
table{{border-collapse:collapse}} td,th{{padding:3px;vertical-align:top}} th{{font-weight:600;font-size:12px}}
th.scene{{writing-mode:vertical-rl;text-align:center;color:#555}}
td img{{width:220px;border-radius:6px;cursor:zoom-in;display:block}} td.err{{width:220px;color:#b00;font-size:11px}}
#zoom{{position:fixed;inset:0;background:#000d;display:none;z-index:9;cursor:zoom-out;text-align:center}}
#zoom img{{max-height:88vh;margin-top:2vh}} #zoom p{{color:#ddd;max-width:900px;margin:8px auto;font-size:12px}}
</style>
<div class="bar"><b>PROTOTYPE · 票 05 外貌一致性</b>{checks}</div>
<p>每列是一种做法，每行是一个情境；同一行的种子相同。提示词结构按「拍板：怎么触发、谁来写提示词」拼，不加画风 tag。点图放大并显示提示词。</p>
{"".join(sections)}
<div id="zoom"><img><p></p></div>
<script>
document.querySelectorAll('.bar input').forEach(c=>c.onchange=()=>document.querySelectorAll('.c-'+c.dataset.v)
  .forEach(e=>e.style.display=c.checked?'':'none'));
const z=document.getElementById('zoom');
document.querySelectorAll('td img').forEach(i=>i.onclick=()=>{{z.querySelector('img').src=i.src.replace('.jpg','.png');
  z.querySelector('p').textContent=i.dataset.p;z.style.display='block'}});
z.onclick=()=>z.style.display='none';
</script>"""
open(f"{ROOT}/index.html", "w", encoding="utf-8", newline="\n").write(page)
print(f"{ROOT}/index.html")
