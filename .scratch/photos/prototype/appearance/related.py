"""related.py tag ...  -> Danbooru 里和角色 tag 共现最多的外貌类 general tag。"""
import sys, json, urllib.request, urllib.parse, re
sys.stdout.reconfigure(encoding="utf-8")
LOOK = re.compile(r"(hair|eyes|bangs|sidelocks|ahoge|twintails|ponytail|bun|braid|bob cut|hairclip|hair ornament|hairband|bow|ribbon|mole|freckles|choker|earrings|eyelashes|eyebrows|ears)")
for t in sys.argv[1:]:
    q = urllib.parse.urlencode({"query": t.replace(" ", "_"), "category": "general", "limit": 80})
    req = urllib.request.Request("https://danbooru.donmai.us/related_tag.json?" + q, headers={"User-Agent": "curl/8.7.1"})
    d = json.loads(urllib.request.urlopen(req, timeout=30).read())
    rows = [(r["tag"]["name"].replace("_", " "), r.get("frequency", 0)) for r in d.get("related_tags", [])]
    look = [f"{n}({f:.2f})" for n, f in rows if LOOK.search(n) and f >= 0.15]
    print(f"{t}: " + ", ".join(look))
