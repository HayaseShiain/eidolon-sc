# PROTOTYPE：外貌一致性（票 05），用完即弃

问题：照片里的人能不能一眼认出是她；角色配置里每位要存什么。结论见 `.scratch/photos/issues/05-appearance-prototype.md` 的 Answer（`feat/photos` 分支）。

- `gen.py`：按「角色 × 情境 × 做法」走用户的中转（A 形态）出图，key 从仓库根目录的 `.env.novelai` 读。图在仓库外的 `E:/tmp/nai-appearance/out/`，已有的跳过。`--only 子串` 只跑一部分。**每张都扣中转额度，跑之前先跟用户说张数。**
- `page.py`：生成对比页 `E:/tmp/nai-appearance/index.html`（左边原作缩略图，行是情境、列是做法，点图放大看提示词）。
- `related.py`：查 Danbooru 上和角色 tag 共现最多的外貌类 tag，当写外貌 tag 初稿的参考（有噪声，要对着缩略图校对）。
- `manifest.json`：实际生成的 41 张，每张的模型、提示词和耗时。

参考图（`ref/<角色标识>.png`）是存储桶里默认衣装的缩略图 `thumbnails/stand/<enzaId>.png`。
