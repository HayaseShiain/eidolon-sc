# PROTOTYPE：画风（票 11），用完即弃

问题：照片用什么画风，画风段写什么、放在哪。结论见 `.scratch/photos/issues/11-art-style-prototype.md` 的 Answer（`feat/photos` 分支）。

- `gen.py`：按「角色 × 情境 × 画风」走用户的中转（A 形态）出图，V5 Curated，提示词、种子、参数和票 05 的「角色 tag + 外貌 tag」一字不差，只在作品 tag 后面多一段画风。key 从仓库根目录的 `.env.novelai` 读。图在仓库外的 `E:/tmp/nai-art-style/out/`，已有的跳过；不加画风的对照图拷自票 05 的 `E:/tmp/nai-appearance/out/`。**每张都扣中转额度，跑之前先跟用户说张数。**
- `page.py`：生成对比页 `E:/tmp/nai-art-style/index.html`（行是情境、列是画风，点图放大看提示词）。
- `manifest.json`：实际生成的 24 张（第一档 12、第二档 8、第三档 4）和 6 张对照图的提示词、耗时。

画师候选是用户在 nax.moe、tags.gallery 上挑的。官方 tag 建议接口不列在世画师（输入 `artist:` 只推荐古典画家，连 `wlop` 也不推荐），所以认不认识只能出图看。
