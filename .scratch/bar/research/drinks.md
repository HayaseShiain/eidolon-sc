# 调研：原版的饮品、材料和调法

地图票 `01-original-drinks-research.md`（bar）。调研日期 2026-10-26。对象是 Steam 版《VA-11 HALL-A》，`data.win` 里的版本号字符串是 1.2.3.0。

术语以 `GLOSSARY.md` 为准：酒吧、光顾、饮品、材料、点单。本文说「原版」时指这款游戏本身。

来源标注：

- **代码**：`data.win` 里 GML 反编译的结果，工具是 UndertaleModTool CLI 0.9.2.0，反编译的是 `data.win` 的副本。写作 `代码:<脚本名>`，比如 `代码:drink_a`。这是一手来源，冲突时以它为准。
- **配方卡**：提取目录 `E:\Download\others\VA11_extract\sprites\` 里的配方书图。中文是 `170_recipes_cn_NN.png`，英文是 `171_recipes_NN.png`，日文是 `169_recipes_jp_NN.png`。也是一手来源，是玩家实际看到的内容。
- **界面字符串**：`代码:ui_tl_ch`、`代码:ui_tl_eng`、`代码:ui_tl_jp`，即各语言的界面文字表。
- **wiki**：<https://va11halla.fandom.com/wiki/Drinktionary>、<https://va11halla.fandom.com/wiki/Flaming_Moai>（访问 2026-10-26），只用来交叉核对。
- **推测**：只是根据变量名或代码结构推断的，会单独标出来。

## 结论

1. **一共 29 款饮品。** 其中 25 款用五种材料调制，4 款是瓶装直接上。
   - 调制的 25 款里，24 款在配方书里，有配方卡（带官方中文描述）。
   - 第 25 款 Flaming Moai 是隐藏饮品：没有配方卡，没有描述，剧本里也从没提过。
   - 瓶装 4 款是 Absinthe、Rum、Mulan Tea、A Fedora，一律 $500。Absinthe 和 Rum 一局只会出现一种。
   - 完整数据见第 2 节的表和同目录的 `drinks.csv`。各条都从代码 `drink_a` 和配方卡逐条核对过。配方、加冰、陈化、调法、价格两边全部一致；wiki 也一致。
2. **官方中文版没有翻译饮品名。**
   - 配方卡、界面字符串（`代码:ui_tl_ch` 的 `sugarrush_str = "Sugar Rush"` 等）、中文剧本（`scripts/readable/chn/_all_chn.txt` 里 "Sugar Rush" 出现 22 次）用的都是英文原名。
   - 所以「官方中文名」就是英文名。要给饮品起中文名的话，是我们自己的新决定，不是照搬。
   - 日文版翻译了饮品名，见表里的日文名一列。
3. **口味 5 种，种类 5 种，此外还有一个只写在配方卡上的「第三标签」。**
   - 口味（flavor）：Sweet 甜味、Bitter 苦味、Sour 酸味、Spicy 辛辣、Bubbly 发泡。
   - 种类（kind）：Girly 女性化、Manly 男性化、Classic 经典、Classy 时尚、Promo 宣传。
   - 每款饮品正好一个口味、一个种类。代码判点单时只看这两个，外加 `alcohol` 和 `drinksize`。
   - 第三标签共 7 个：Vintage 复古、Sobering 解酒、Bland 清淡、Soft 温和、Happy 惬意、Burning 火辣、Strong 强烈。它只印在配方卡上，代码里没有，也不参与任何判定。
   - 票里列的 Bland、Burning、Sobering、Sophisticated：前三个是第三标签，Sophisticated 原版没有。
4. **调法规则：**
   - 调制器总容量是 20 份，五种材料加起来算；每种材料单独没有上限。
   - 加冰（On the rocks）和陈化（Age）是两个开关。
   - 按「调制」后摇酒壶开始摇。5 秒内按「停止」算摇和（mix）；摇满 5 秒后摇酒壶转为剧烈晃动，再停就算搅拌（blend）。
   - 判定是精确匹配：五个份数、冰、陈化、mix/blend 必须和某个配方完全一致。多一份、少一份、多加了冰、多陈化了都不行。
5. **大杯和可选 Karmotrine：**
   - 大杯就是全部份数翻倍，冰、陈化、调法不变。可选 Karmotrine 的饮品翻倍时，Karmotrine 仍然可选。
   - 原配方总量超过 10 份的 5 款没有翻倍版，本身就是大杯：Flaming Moai 12 份、Marsblast 13、Zen Star 20、Piano Man 18、Piano Woman 18。
   - 可选 Karmotrine 的有 7 款：Sugar Rush、Sparkle Star、Blue Fairy、Fluffy Dream、Sunshine Cloud、Gut Punch、Crevice Spike。
     - 加 0 份时饮品是无酒精的。
     - 加 1 份以上时是含酒精的，加多少都还是同一款、同一个杯型，直到总量填满 20 份。
   - 另有 2 款固定不含 Karmotrine：Bleeding Jane、Frothy Water。
   - 原版没有「酒精度」这个量。只有两个相关的东西：
     - `alcohol`：是否含酒精，取值 yes/no。
     - 醉意 `drunklevel`：上一杯就加上这杯的 Karmotrine 份数，剧本在某些节点按阈值分支，比如 >5、>10、>12。
6. **调错的结果分两种：**
   - **对不上任何配方**（份数错、冰或陈化错、mix/blend 反了，都在此列）：成品是「故障瓶」。
     - 名字随机显示成 `##20%!!` 一类的乱码，图是 `043_glitchbottle`。
     - 这时「调制/上酒」按钮变灰，**根本上不了酒**，只能按「重做」清空重来。
     - 原版没有「调错了落到另一款」的模糊匹配。只有份数和开关恰好等于另一款的配方时才会变成那一款，例如 Sugar Rush 多开了陈化就正好是 Sparkle Star。
   - **调出了合法的另一款**：可以上，后果由当天的剧情脚本决定。
     - 一般是不给钱，「失误」计数加 1，她的台词跟着变。
     - 有的点单只要求口味、种类、含不含酒或大小，满足即算对。
     - 怎么判、给多少小费，是票 02 和票 07 的范围。
7. **价格就是表里的数字。**
   - 上对了：拿价格；如果点单允许大杯、又上了翻倍版，再加 $100。原版即大杯的 Marsblast、Zen Star、Piano Man、Piano Woman 不加。最后加上剧情给的小费。
   - 上错了：$0。
   - 瓶装的固定 $500。
8. **配方书（BTC 调酒指南，开在 CALICOMP 上）：**
   - 四个标签：「按名称」「按口味」「按种类」「瓶装饮品」。
     - 「按名称」是 B C F G M P S Z 八个首字母按钮。
     - 「按口味」和「按种类」各 5 个分类按钮。
     - 点开一个分类后列出不超过 6 款饮品，点名字看配方卡。
   - 配方卡一页一款，左右箭头按字母顺序翻 24 页。
   - 没有组合筛选，也没有别的排序方式。
   - 分类里的顺序是代码的内部顺序：先按种类 Girly→Manly→Classic→Classy→Promo，再按固定次序，见第 6 节。字母分类里按字母排。
9. **原版的几处数据冲突和 bug**（详见第 7 节），实现时要选一边：
   - Piano Man 的口味：配方卡写 Sour，代码写首字母大写的 `"Bitter"`，它不会和任何口味判定相等；配方书的口味分类里两边都没有它。
   - Flaming Moai 的口味：代码是 spicy，wiki 说 Sour。
   - 大杯 Crevice Spike：带 Karmotrine 的版本口味拼成了 `"ssour"`；不带 Karmotrine 的版本走不到，会变成故障瓶。
   - Beer 的中文配方卡把 Classic 印成了「时尚」。
   - **建议**：
     - 口味和种类以配方卡为准（Piano Man = Sour），代码里大小写和拼写的错当 bug 修掉。
     - Flaming Moai 没有配方卡，按代码记成 Spicy / Classy。
     - 中文标签统一用菜单分类名：Classic = 经典，Classy = 时尚。

## 1. 怎么查的

- **配方卡**：把 `170_recipes_cn_*.png`、`171_recipes_*.png`、`169_recipes_jp_*.png` 叠到深色底上放大，逐张读。
  - 第 00 帧是空白，第 01–24 帧是 24 张配方卡，按英文字母顺序排。
  - 中、英、日三版的份数和价格逐张对过，全部一致。
- **代码**：在 `data.win` 的副本上跑 `UndertaleModCli dump <副本> -v -o <out> -c UMT_DUMP_ALL -s`，得到 2288 个 GML 文件和字符串表。
  - 这个文件的 EXTN 块有一处长度警告，不加 `-v` 时 CLI 会当作异常退出。
  - 游戏目录只读过，没写过。工具和输出都在 `E:\tmp\va11-tools\`，不进仓库。
- 用到的脚本：
  - `drink_a` / `drink_b`：两个杯位各一份，内容几乎相同。它们决定调出来的是什么饮品，以及口味、种类、杯型、酒精、价格。
  - `mix_action`、`shaker_a` 的 `Alarm_0` 和 `Alarm_1`：摇和与搅拌。
  - `a_button` 到 `e_button`、`keyboard_mixerbinds`：加材料、容量、快捷键。
  - `age_toggle` 和 `otr_toggle`：陈化和加冰两个开关。
  - `resetmixer`：重做。
  - `mixw_Step`：「调制/上酒」按钮能不能按。
  - `scorepop_obj_Create`：算钱和醉意。
  - `mixertips` 和 `mixNcontrol`：剧情判点单。
  - `introbutton_*`、`bb*`、`bc*`、`ba*`、`textx_Step`、`recipebook_bg_Create`：配方书。
  - `exframe_*`：瓶装饮品。
  - `ui_tl_*`：界面文字。
- 房间帧率：解析 ROOM 块，`bar` 房间的 speed 是 30，所以 `alarm[1] = 150` 帧等于 5 秒。

## 2. 饮品表

列的含义：

- A、B、D、F、K 分别是 Adelhyde、Bronson Extract、Powdered Delta、Flanergide、Karmotrine 的份数。
- 「可选」：0 份或 1 份以上都对，加 0 份就是无酒精版。
- 冰、陈化：✓ 表示必须开，空白表示必须关。
- 调法：mix 摇和，blend 搅拌。
- 杯型：「普通」的可以翻倍成大杯；「大杯」的本身就是大杯，不能翻倍。
- 中文标签照中文配方卡的写法，依次是口味、种类、第三标签。
- 「卡」是配方书第几页，也就是 `170_recipes_cn_NN` 的 NN。
- 「#」是代码里的判定顺序，和饮品图 `sprites/019`–`042` 的顺序一致。
- 「官方中文名」一列省略了，因为官方中文版就用英文名（结论 2）。

### 2.1 调制饮品（25 款）

| # | 英文名 | 日文名 | A | B | D | F | K | 冰 | 陈化 | 调法 | 杯型 | 大杯配方 A/B/D/F/K | 价格 | 口味 | 种类 | 中文标签 | 卡 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Flaming Moai | — | 1 | 1 | 2 | 3 | 5 |  |  | mix | 大杯 | — | $150 | Spicy（代码；wiki 作 Sour） | Classy | — | 无 |
| 2 | Sugar Rush | シュガーラッシュ | 2 | 0 | 1 | 0 | 可选 |  |  | mix | 普通 | 4/0/2/0/可选 | $150 | Sweet | Girly | 甜味，女性化，惬意 | 21 |
| 3 | Sparkle Star | スパークルスター | 2 | 0 | 1 | 0 | 可选 |  | ✓ | mix | 普通 | 4/0/2/0/可选 | $150 | Sweet | Girly | 甜味，女性化，惬意 | 20 |
| 4 | Blue Fairy | ブルーフェアリー | 4 | 0 | 0 | 1 | 可选 |  | ✓ | mix | 普通 | 8/0/0/2/可选 | $170 | Sweet | Girly | 甜味，女性化，温和 | 5 |
| 5 | Fluffy Dream | ふもふもドリーム | 3 | 0 | 3 | 0 | 可选 |  | ✓ | mix | 普通 | 6/0/6/0/可选 | $170 | Sour | Girly | 酸味，女性化，温和 | 9 |
| 6 | Sunshine Cloud | サンシャインクラウド | 2 | 2 | 0 | 0 | 可选 | ✓ |  | blend | 普通 | 4/4/0/0/可选 | $150 | Bitter | Girly | 苦味，女性化，温和 | 22 |
| 7 | Moonblast | ムーンブラスト | 6 | 0 | 1 | 1 | 2 | ✓ |  | blend | 普通 | 12/0/2/2/4 | $180 | Sweet | Girly | 甜味，女性化，惬意 | 16 |
| 8 | Gut Punch | ガット パンチ | 0 | 5 | 0 | 1 | 可选 |  | ✓ | mix | 普通 | 0/10/0/2/可选 | $80 | Bitter | Manly | 苦味，男性化，强烈 | 13 |
| 9 | Piledriver | パイルドライヴァー | 0 | 3 | 0 | 3 | 4 |  |  | mix | 普通 | 0/6/0/6/8 | $160 | Bitter | Manly | 苦味，男性化，火辣 | 19 |
| 10 | Suplex | スープレックス | 0 | 4 | 0 | 3 | 3 | ✓ |  | mix | 普通 | 0/8/0/6/6 | $160 | Bitter | Manly | 苦味，男性化，火辣 | 23 |
| 11 | Marsblast | マーズブラスト | 0 | 6 | 1 | 4 | 2 |  |  | blend | 大杯 | — | $170 | Spicy | Manly | 辛辣，男性化，强烈 | 14 |
| 12 | Crevice Spike | クレヴィススパイク | 0 | 0 | 2 | 4 | 可选 |  |  | blend | 普通 | 0/0/4/8/可选（见第 7 节） | $140 | Sour | Manly | 酸味，男性化，解酒 | 8 |
| 13 | Beer | ビール | 1 | 2 | 1 | 2 | 4 |  |  | mix | 普通 | 2/4/2/4/8 | $200 | Bubbly | Classic | 发泡，时尚（应为经典），复古 | 2 |
| 14 | Bleeding Jane | ブリーディングジェイン | 0 | 1 | 3 | 3 | 0 |  |  | blend | 普通 | 0/2/6/6/0 | $200 | Spicy | Classic | 辛辣，经典，解酒 | 3 |
| 15 | Frothy Water | フロシーウォーター | 1 | 1 | 1 | 1 | 0 |  | ✓ | mix | 普通 | 2/2/2/2/0 | $150 | Bubbly | Classic | 发泡，经典，清淡 | 11 |
| 16 | Bad Touch | バッドタッチ | 0 | 2 | 2 | 2 | 4 | ✓ |  | mix | 普通 | 0/4/4/4/8 | $250 | Sour | Classy | 酸味，时尚，复古 | 1 |
| 17 | Brandtini | ブランディーニ | 6 | 0 | 3 | 0 | 1 |  | ✓ | mix | 普通 | 12/0/6/0/2 | $250 | Sweet | Classy | 甜味，时尚，惬意 | 6 |
| 18 | Cobalt Velvet | コバルトヴェルヴェット | 2 | 0 | 0 | 3 | 5 | ✓ |  | mix | 普通 | 4/0/0/6/10 | $280 | Bubbly | Classy | 发泡，时尚，火辣 | 7 |
| 19 | Fringe Weaver | フリンジウィーバー | 1 | 0 | 0 | 0 | 9 |  | ✓ | mix | 普通 | 2/0/0/0/18 | $260 | Bubbly | Classy | 发泡，时尚，强烈 | 10 |
| 20 | Mercury Blast | マーキュリーブラスト | 1 | 1 | 3 | 3 | 2 | ✓ |  | blend | 普通 | 2/2/6/6/4 | $250 | Sour | Classy | 酸味，时尚，火辣 | 15 |
| 21 | Grizzly Temple | グリズリーテンプル | 3 | 3 | 3 | 0 | 1 |  |  | blend | 普通 | 6/6/6/0/2 | $220 | Bitter | Promo | 苦味，宣传，清淡 | 12 |
| 22 | Bloom Light | ブルームライト | 4 | 0 | 1 | 2 | 3 | ✓ | ✓ | mix | 普通 | 8/0/2/4/6 | $230 | Spicy | Promo | 辛辣，宣传，清淡 | 4 |
| 23 | Zen Star | ゼンスター | 4 | 4 | 4 | 4 | 4 | ✓ |  | mix | 大杯 | — | $210 | Sour | Promo | 酸味，宣传，清淡 | 24 |
| 24 | Piano Man | ピアノ マン | 2 | 3 | 5 | 5 | 3 | ✓ |  | mix | 大杯 | — | $320 | Sour（卡；代码作 "Bitter"） | Promo | 酸味，宣传，强烈 | 17 |
| 25 | Piano Woman | ピアノ ウーマン | 5 | 5 | 2 | 3 | 3 |  | ✓ | mix | 大杯 | — | $320 | Sweet | Promo | 甜味，宣传，惬意 | 18 |

关于名字：

- 代码判定饮品用 `bevid`（如 `srush`），见 `drinks.csv` 的 id 列。
- 调好后，调制器上显示一个不超过 10 个字符的短名（`bev`），如 `Flmng Moai`、`Mercryblst`，见 csv 的 short_name 列。
- 界面字符串里 Mercury Blast 写作 `Mercuryblast`（`mercuryblast_str`），配方卡上是 `Mercury Blast`。
- Frothy Water 用的是 Beer 的杯子图（`spriteshown = 31`）。

### 2.2 官方中文描述（配方卡）

配方卡的版式：第一行「名字 - $价格」，第二段是配方句，第三段是引号里的描述，最后一行是标签。

- 配方句的写法：「X 是由 n Adelhyde、n Bronson Extract……（陈化，）（加冰，）调制而成」。搅拌的饮品写「调和而成」；可选 Karmotrine 写作「任选Karmotrine」。
- 搅拌的 7 款（Bleeding Jane、Crevice Spike、Grizzly Temple、Marsblast、Mercury Blast、Moonblast、Sunshine Cloud），中文卡上多一行提示：「（点击"调制"按钮后请等待至摇酒壶开始剧烈晃动。）」。英文卡和日文卡都没有这行。

下表是引号里的描述，照中文配方卡逐字录入。英文卡和日文卡的描述在同目录的对应图里，这里不重复。

| 卡 | 饮品 | 官方中文描述 |
|---|---|---|
| 1 | Bad Touch | 我们毕竟不过是群哺乳动物。 |
| 2 | Beer | 以传统手法酿造的啤酒已经成为了奢侈品，但这种酒和真货的味道相当接近…… |
| 3 | Bleeding Jane | 对着镜子重复三次这杯饮料的名字，就会让你看上去像个傻瓜。 |
| 4 | Bloom Light | 这杯酒泛着完全多余的灰褐色…… |
| 5 | Blue Fairy | 只喝一口就能让你的牙齿变蓝。希望你喝完之后能好好刷牙。 |
| 6 | Brandtini | 每10个自命不凡的混球里就会有8个推荐这种酒，但他们沉溺于自命不凡没空为人推荐什么。 |
| 7 | Cobalt Velvet | 就如同把香槟倒在还剩一点可乐的杯子里。 |
| 8 | Crevice Spike | 它既能把你的醉意驱除，也能够把你的意识驱除。 |
| 9 | Fluffy Dream | 一两口就足以取悦你的舌头，再多喝就可能会导致睡过头。 |
| 10 | Fringe Weaver | 如同就着一勺糖喝下无水酒精。 |
| 11 | Frothy Water | 自2040年以来，家长指导级节目里最爱用的啤酒代用品。 |
| 12 | Grizzly Temple | 这种酒的味道几乎令人难以忍受。基本上只有它所宣传的那部电影的爱好者会点它。 |
| 13 | Gut Punch | 这个名字的意思是'由内脏（Gut）制成的混合饮料（Punch）'，但是同时也描述了饮用时的感受（重击腹部）。 |
| 14 | Marsblast | 只要喝上一口就足以让你的脸像火星一样红。 |
| 15 | Mercury Blast | 在这种酒的研发过程中，没有温度计遭到伤害。 |
| 16 | Moonblast | 与你每个月都有一周时间能看到的那座月球强子大炮没有任何关系。 |
| 17 | Piano Man | 该饮品不代表酒吧钢琴师协会及其相关组织的意见。 |
| 18 | Piano Woman | 它的本名是Pretty Woman，但有很多人投诉如果有种酒叫Piano Man（男钢琴师），就该有另一种被命名为Piano Woman（女钢琴师）。 |
| 19 | Piledriver | 你的舌头可能察觉不到它的火辣程度，但喝的时候请小心不要烧到嗓子。 |
| 20 | Sparkle Star | 这种饮料曾经真的能够迸出（Sparkle）杯子，但这导致过多顾客投诉皮肤问题，于是他们被迫重新设计了不会迸射出任何东西的版本。 |
| 21 | Sugar Rush | 甘甜，清淡，水果风味，不能更加女性化的饮品。 |
| 22 | Sunshine Cloud | 味道就像昔日的巧克力牛奶，甚至还保留着那份香气。也有人说它有些焦糖的味道…… |
| 23 | Suplex | 对Piledriver进行微妙调整之后，将火辣的感觉从喉咙转移到了舌头上。 |
| 24 | Zen Star | 你可能会认为如此均衡的配方能够令这杯酒变得美味……那你就大错特错了。 |

### 2.3 瓶装饮品（4 款）

来源：`代码:drink_a` 开头的 `exdrink` 分支，`代码:ui_tl_ch`、`ui_tl_jp`，`代码:textx_Step`，`代码:exframe_1` 到 `exframe_4`。

| id | 英文名（中文版同） | 日文名 | 中文小字 | 价格 | 口味 | 种类 | 什么时候有 |
|---|---|---|---|---|---|---|---|
| abs | Absinthe | アブサン | 像呕吐物一样绿的精灵 | $500 | Sour | Classic | 第 5 天起；和 Rum 二选一 |
| rum | Rum | ラム酒 | 祖父级的酒 | $500 | Bitter | Classic | 第 5 天起，`stel1` 和 `stel2` 都是 `"right"` 时代替 Absinthe（推测：Stella 某两次点单都上对了） |
| tea | Mulan Tea | ムーラン ティー | 调味茶 | $500 | Sweet | Classic | 在商店买过之后（`shop_tea`） |
| fed | A Fedora | フェドーラ帽 | 内含香水和李子 | $500 | Bubbly | Classic | 一直有；代码里的短名是 `Plumfume` |

- 标签页底部有一行小字：「这里每种饮料的定价都是$500 -Dana」（`notebottle_str`、`dananote_str`）。
- 瓶装饮品只能拖进空的摇酒壶（还没加任何材料时）。拖进去之后材料按钮全部变灰。
- 按「调制」→「停止」→「上酒」照常走，但冰、陈化、mix/blend 都不看，直接得到这款。
- 杯型一律普通，`alcohol` 一律是 yes（Mulan Tea 也是）。

## 3. 大杯、可选 Karmotrine 和酒精

来源：`代码:drink_a`、`代码:scorepop_obj_Create`，wiki 的说法和代码一致。

- **杯型由配方分支直接给出**，不是现算的。
  - 原配方总量 ≤10 份的 20 款，各有一个「全部翻倍」的大杯分支，冰、陈化、调法不变。
  - 总量 >10 份的 5 款只有大杯分支（Flaming Moai 12、Marsblast 13、Zen Star 20、Piano Man 18、Piano Woman 18）。
  - 原版的规则可以概括成：总量不超过 10 份是普通杯，可以翻倍成大杯；超过 10 份本身就是大杯。
- **可选 Karmotrine** 在代码里写成两个分支：`mod_e >= 1` 时 `alcohol = "yes"`，`mod_e == 0` 时 `alcohol = "no"`。
  - Karmotrine 加多少都不改变杯型，只受 20 份总容量限制。例如普通杯 Sugar Rush 最多可加 17 份。
  - 翻倍版也一样，只翻倍其他材料。例如大杯 Sugar Rush 是 4/0/2/0，Karmotrine 加 0 到 14 份。
  - Moonblast 的 Karmotrine 固定 2 份，不是可选，也没有无酒精版。
- **大杯的钱**：
  - 点单允许大杯（剧本传 `big_able = 1`）并上了翻倍版，在价格之外加 $100；双杯点单两杯都满足时加 $200。
  - 本身是大杯的 Marsblast、Zen Star、Piano Man、Piano Woman 被代码排除，不加。Flaming Moai 不在排除名单里。
- **酒精**：原版没有酒精度。
  - `alcohol`：yes/no。剧本靠它判「要不要酒精」一类的点单，`alcohol_a ==` 出现 32 次。
  - `drunklevel_a`：每上一杯（单杯点单）就加上这杯的 Karmotrine 份数，剧本在某些节点按阈值走分支（如 `day0control` 的 `> 5`、`> 12`，`day12control` 的 `> 10`）。所以醉意大致就是 Karmotrine 的累计份数。

## 4. 调法规则

来源：`代码:a_button_Step` 到 `e_button_Step`、`adl_Step` 等、`keyboard_mixerbinds_Step`、`mix_action`、`shaker_a_Alarm_0/1`、`mixw_Step`、`resetmixer`、`amounts_Draw`。

- **材料**：五种，可以拖到摇酒壶上，也可以用快捷键 Q W E R T 各加 1 份，Shift+键减 1 份。用鼠标不能减，只能重做。
- **容量**：五种合计 20 份（`mod_slot != 20` 时才能再加）。单种材料没有上限，比如大杯 Fringe Weaver 要 18 份 Karmotrine。
  - 界面上每种材料一行刻度：前 10 份一种图，第 11–20 份换成大图（`a_on` / `abig_on`）。
- **加冰 / 陈化**：两个开关按钮，快捷键 A 是加冰、S 是陈化。按一次开，再按一次关。
- **摇和 / 搅拌**：这款游戏没有单独的搅拌按钮。
  1. 按「调制」（空格）开始摇，按钮变成「停止」。
  2. 前 150 帧（`bar` 房间 30 帧/秒，即 5 秒）摇酒壶慢摇，每帧 ±5°，这时停下算 **mix**。
  3. 摇满 5 秒后 `mixed` 变 0、`failed` 变 1（代码里搅拌就叫 `failed`），摇酒壶改成每帧 ±15° 剧烈晃动，这时停下算 **blend**。
  4. 按「停止」后才判定这杯是什么。判定时 `drink_a()` 只跑一次，按钮变成「上酒」，双杯点单的第一杯则是「下一杯」。
  5. 再按一次就上酒。
- **开始摇之后**用鼠标就不能再加材料了（材料按钮要求 `!mix && !mixing`）。
  - 但快捷键 Q–T 的代码没有查这两个状态，摇的途中按键仍能加减份数，这些份数会算进停下时的判定。
  - 这像是原版的疏漏，网页版不必照搬。
- **重做**：清空材料、冰、陈化、摇的状态和已判定的饮品。
- **双杯**：剧本可以设 `slotamount = 2`，即一次点两杯，界面有「栏位 1 / 栏位 2」，Tab 切换。两杯都调好才一起上。
- **判定顺序**：`drink_a` 是一串 `if / else if`。
  - 先看是不是瓶装。
  - 再从 Flaming Moai 开始逐款精确比较五个份数（可选 Karmotrine 比 `>= 1` 或 `== 0`）和 `age`、`otr`（加冰）、`mixed`、`failed`（blend）四个开关。
  - 各分支的条件互斥（唯一的例外见第 7 节的 Crevice Spike），所以顺序不影响结果。

## 5. 调错的结果

来源：`代码:drink_a` 末尾的 `else`、`代码:mixw_Step`、`代码:mix_action`、`代码:mixertips`、`代码:scorepop_obj_Create`、`代码:mix1control` 等。

- **对不上任何配方**：
  - `bevid = "failed"`，短名从 `##20%!!`、`n#@##*`、`f@###`、`#y#bb=`、`#u??!!`、`gt??!#` 里随机取一个，图是 `043_glitchbottle`。
  - 「调制/上酒」按钮显示不可用（`mixspriteno`），点了只有「不行」的音效。`mix_action` 遇到 `failed` 什么也不做，**所以故障瓶上不了**，只能重做。
  - 原版一律这样处理，不会落到最接近的饮品上。
  - 常见的几种错：
    - 份数差 1：故障瓶。
    - 该加冰没加，或不该加冰却加了：故障瓶。
    - 该陈化没陈化：多数是故障瓶，但 Sparkle Star 不开陈化正好是 Sugar Rush，Sugar Rush 开了陈化也就是 Sparkle Star。
    - mix 和 blend 搞反：故障瓶。
- **调出了另一款合法饮品**：可以上，由当天的 `mixNcontrol` 脚本按 `bevid`、`flavor`、`kind`、`alcohol`、`drinksize` 判对错，再调用 `mixertips(该不该付钱, 对不对, 大杯加价, 小费)`。
  - 上对：价格 + 大杯加价 + 小费。
  - 上错：`rightdrink = 0`，$0，`mistakecounter += 1`，剧情走另一句台词。
  - 有些点单故意不付钱（`shouldpay = 0`，比如教学），这时有成就「RIGHT_WRONG_TROPHY」。
  - 每位客人具体怎么判，是票 02 的范围。
- **没有「怎么调都对不上」的成品**：每个合法组合都对应一款饮品，除此之外全是故障瓶。

## 6. 原版配方书的分类和排序

来源：`代码:recipebook_bg_Create`、`introbutton_a` 到 `introbutton_d` 的 `Mouse_7`、`bb1` 到 `bb5`、`bc1` 到 `bc8`、`ba1` 到 `ba6` 的 `Mouse_7`、`textx_Step`、`textx_Draw`、`recipe_left/right`、`recipebase`；配方卡 `166_recipe_introcn.png`。

- **名字和首页**：配方书叫「B.T.C 调酒指南」，首页写「欢迎回来，Jill / 使用导航栏浏览调酒配方」。第 11 天某段剧情里，「Jill」会被一张故障图盖成「Alma」（`168_recipe_intro_alma_cn`）。
- **标签栏**（中文界面字符串）：「按名称」「按口味」「按种类」「瓶装饮品」。
  - 按名称：标题「按名称搜索」，下面是 8 个首字母按钮 B C F G M P S Z。
  - 按口味：标题「按口味搜索」，5 个按钮：甜味饮品、苦味饮品、酸味饮品、辛辣饮品、发泡饮品。
  - 按种类：标题「按种类搜索」，5 个按钮：女性化饮品、男性化饮品、经典饮品、时尚饮品、宣传饮品。
  - 瓶装饮品：2×2 的格子放瓶子，加 Dana 的那行小字。
- **分类列表**：点开一个分类后右侧最多 6 个名字按钮（`ba1` 到 `ba6`）。点名字直接跳到那款的配方卡。
- **配方卡**：一页一款，共 24 页（Flaming Moai 不在其中），左右箭头按字母顺序翻（`recipeindex` 1–24）。
- **没有** 组合筛选、价格排序、收藏一类的功能。

各分类的内容和顺序（从 `ba1` 到 `ba6` 的跳转表提取）：

| 分类 | 饮品（按列表顺序） |
|---|---|
| 甜味 Sweet | Sugar Rush / Sparkle Star / Blue Fairy / Moonblast / Brandtini / Piano Woman |
| 苦味 Bitter | Sunshine Cloud / Gut Punch / Piledriver / Suplex / Grizzly Temple |
| 酸味 Sour | Fluffy Dream / Crevice Spike / Bad Touch / Mercury Blast / Zen Star |
| 辛辣 Spicy | Marsblast / Bleeding Jane / Bloom Light |
| 发泡 Bubbly | Beer / Frothy Water / Cobalt Velvet / Fringe Weaver |
| 女性化 Girly | Sugar Rush / Sparkle Star / Blue Fairy / Fluffy Dream / Sunshine Cloud / Moonblast |
| 男性化 Manly | Gut Punch / Piledriver / Suplex / Marsblast / Crevice Spike |
| 经典 Classic | Beer / Bleeding Jane / Frothy Water |
| 时尚 Classy | Bad Touch / Brandtini / Cobalt Velvet / Fringe Weaver / Mercury Blast |
| 宣传 Promo | Grizzly Temple / Bloom Light / Zen Star / Piano Man / Piano Woman |
| B | Bad Touch / Beer / Bleeding Jane / Bloom Light / Blue Fairy / Brandtini |
| C | Cobalt Velvet / Crevice Spike |
| F | Fluffy Dream / Fringe Weaver / Frothy Water |
| G | Grizzly Temple / Gut Punch |
| M | Marsblast / Mercury Blast / Moonblast |
| P | Piano Man / Piano Woman / Piledriver |
| S | Sparkle Star / Sugar Rush / Sunshine Cloud / Suplex |
| Z | Zen Star |

- 口味和种类分类里的顺序就是第 2.1 节的 # 顺序，即先按种类 Girly→Manly→Classic→Classy→Promo 分组。首字母分类里按字母排。
- 5 个口味分类加起来只有 23 款，**Piano Man 不在任何口味分类里**（见第 7 节）。

## 7. 冲突和原版 bug

| 项目 | 配方卡 | 代码 | wiki | 建议 |
|---|---|---|---|---|
| Piano Man 的口味 | Sour（中：酸味，日：酸っぱめ） | `"Bitter"`，首字母大写，两个杯位都是这样，不等于任何判定用的小写值 | Sour | 用 Sour。代码值等于「没有口味」，像是笔误；配方书的口味分类也漏了它 |
| Flaming Moai 的口味 | 无卡 | `"spicy"` | Sour | 按代码用 Spicy。wiki 的 Sour 找不到游戏内出处（推测是转述时的误记） |
| Flaming Moai 的杯型 | 无卡 | big | — | 大杯，不能翻倍 |
| 大杯 Crevice Spike | 未写 | 带 Karmotrine 的分支口味是 `"ssour"`；不带 Karmotrine 的分支条件也写成了 `mod_e >= 1`，所以 0/0/4/8/0 走不到，会变成故障瓶 | — | 修掉：口味用 Sour，不带 Karmotrine 的大杯照常算无酒精大杯 |
| 杯位 2 的 Piano Woman | — | `drink_b` 里口味是 `"Sweet"`，首字母大写；`drink_a` 是小写 | — | 用 sweet |
| Beer 的中文标签 | 「发泡，时尚，复古」 | `kind = "classic"` | Classic | 中文用「经典」 |
| Mercury Blast 的拼写 | Mercury Blast | 界面字符串 `Mercuryblast`，短名 `Mercryblst` | Mercuryblast | 用配方卡的 Mercury Blast |
| 瓶装 A Fedora 的名字 | — | 短名 `Plumfume`，界面字符串 `A Fedora` | A Fedora | 用 A Fedora |

## 8. 给后续票的提示

以下是建议，不是决定：

- **票 04、05**（口味和点单）：原版判点单只看 `bevid`、`flavor`、`kind`、`alcohol`、`drinksize` 五个量，第三标签不参与。点单「有哪几种说法」可以从这五个量出发，具体说法以票 02 从剧本里整理出的为准。
- **票 07**（上酒的结果）：原版里调错分「上不了的故障瓶」和「上了但不对」两层。网页版要不要保留「故障瓶上不了、必须重做」，是票 07 要定的事。
- **饮品表落地**：
  - `drinks.csv` 每行一款，带 id、份数、开关、价格、口味、种类、中文描述和来源。
  - 大杯翻倍和可选 Karmotrine 用规则表达，不必每款写两三行。
  - 判定可以写成「先查瓶装 → 精确匹配 25 个配方（含翻倍版）→ 否则故障瓶」。
- **素材**：
  - 25 款调制饮品的图在 `sprites/019`–`042`，Frothy Water 复用 Beer 的图。
  - 故障瓶是 `043`，瓶装是 `180`–`183`。
  - 材料按钮是 `004`–`018`，每种三态：常态、悬停、关闭。
