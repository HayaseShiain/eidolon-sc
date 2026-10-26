# 01: 调研：原版的饮品、材料和调法

Type: research
Status: open
Blocked by: none

## Question

定图时定了照搬原版的饮品和调法，这张票把数据提取出来、核对清楚，给票 04、05、07 用。要查：

- **全部饮品**：英文名、官方中文名、配方（五种材料各几份，Adelhyde、Bronson Extract、Powdered Delta、Flanergide、Karmotrine）、加冰、陈化、摇和还是搅拌（mix / blend）、价格、口味（甜、酸、苦、辣、气泡……）、种类（Girly、Manly、Classy、Promo、Classic、Bland、Burning、Sobering、Sophisticated……以原版为准），以及原版对这款饮品的描述。官方中文描述在 `sprites/170_recipes_cn_*.png` 的配方图上，要读出来、对上饮品。
- **可选 Karmotrine 和大杯**：哪些饮品的 Karmotrine 是「可选」，大杯怎么调（份数翻倍？），原版有没有「酒精度」这个量、怎么算。
- **调法规则**：每种材料最多几份、调制器的总容量、调错（份数不对、忘了冰、摇和搅拌搞反）时原版出的是什么（一律算失败的饮品，还是会落到另一款上）；有没有「怎么调都对不上任何配方」的成品。
- **原版的分类和菜单**：配方书（BAR 界面的饮品列表）怎么排列、能不能按名称、口味、种类筛选或排序，界面上一页显示几款。
- 来源按可信度：`data.win` 里的 GML（可以用 UndertaleModTool 一类工具反编译，或者在 `STRG` 里找字符串）、提取目录的配方图、Fandom 之类的 wiki（只作交叉核对）。各条数据注明来源，有冲突时以游戏数据为准。

产出是一份结构化的表（Markdown 或 CSV，放在调研分支），能直接改写成仓库里的饮品表。
