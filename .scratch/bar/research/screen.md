# 调研：原版酒吧的画面、调酒流程和素材清单

地图票 `03-original-screen-research.md`（bar）。调研日期 2026-10-26，下文的「访问」都指这一天。给票 08（酒吧画面原型）备料。

术语以 `GLOSSARY.md` 为准：酒吧、光顾、饮品、材料、点单。原版的说法（Adelhyde、Mix、Blend）只在引原版时出现。

来源标注：

- **一手·代码**：用 UndertaleModTool CLI 0.9.2.0 从安装目录 `data.win` 的副本反编译出的 GML（游戏自己的逻辑），文件名写成 `gml_Object_xxx_Step_0` 这种。复现方法见第 6 节。
- **一手·数据**：同一份 `data.win` 里的房间、精灵、字体、声音表，以及提取目录 `E:\Download\others\VA11_extract` 里的文件。
- **一手·文档**：规范、浏览器源码、浏览器兼容数据（MDN browser-compat-data）、平台的官方开发文档。
- **二手**：wiki、攻略、博客、社区帖子。

原版剧本只用来核对文本速度和换行规则，下文不引台词。

## 结论

### 1. 画面怎么拼

- **整屏 640×360，原版按 2 倍画到 1280×720**（`bar` 房间 view 640×360、port 1280×720，room speed 30）。共五层，从后往前：
  1. 酒吧背景 `barground`（424×257），画在 (11,18)。电视那块是透明洞，电视频道动画画在 (239,44)，吊扇 `fan_spr` 画在 (193,61)。
  2. 客人立绘：底边贴 y=268，横向按原点（底边中点）摆，单人 x=185，两人 x=120 / 280。
  3. 配方书：只在调酒时出现，左上 (18,20)，420×252，整块盖住客人。
  4. 外框 `frame_sprite`（640×360）。整张不透明，只挖了两个洞：
     - 左上的客人窗：y 27–89 宽 410（x 19–428）；往下被右侧面板挡住，y 114–267 只剩 x 19–347，宽 329。
     - 右上「Cyberpunk Bartender Action / VA-11 HALL-A」的 logo 是直接画在外框图里的。
  5. 调酒台按钮、份数格、摇酒器，以及所有文字（标签、台词、金额），都画在外框之上。
- **各块的位置**（640×360 坐标）：

  | 区域 | 位置和尺寸 | 内容 |
  |---|---|---|
  | 客人窗 | (19,27) 410×241，L 形 | 背景 + 立绘；调酒时换成配方书 |
  | 文本框 | (17,276) 412×65 | 台词，正文从 (23,279) 起，最多 4 行；右下角 (413,328) 是「点击继续」箭头 |
  | logo | (435,27) 188×63 | 烤在外框里，VA-283 要改这块图 |
  | 金额 | (356,94) 73×20 | `$` + 数字 |
  | 调酒台 | x 356–624，y 94–268 | 第 2 节 |
  | 侧边菜单 | (435,276) 190×65 | 设置、读取、点唱机、退出，四个文字按钮 |

- **示意图**：
  - [`screen-talk.png`](screen-talk.png)：闲聊状态，标了区域。
  - [`screen-mix.png`](screen-mix.png)：调酒状态，配方书盖住了客人窗。
  - 两张都用 Pillow 按反编译出的坐标拼成，2 倍放大。
- **立绘的入场退场**：先画黑色剪影，透明度每 3–4 帧加 0.25，约 0.5 秒；再叠彩色层，同样约 0.5 秒。退场倒过来。眨眼每 3–5 秒一次。嘴型动画只在说话时播，每秒 9 帧。

### 2. 调酒流程：每一步用什么图、什么音效

调酒台只在「点单之后、文本框里没有正在播的台词」时可用。其余时间材料瓶显示 `*_off`，按钮显示 `slotout`。

| 步骤 | 原版操作 | 图 | 音效 |
|---|---|---|---|
| 进入调酒 | 点单台词播完 | 配方书 `recipe_bg` 25 帧从上往下擦出，首页 `recipe_introcn`；文本框换成点单原话 | `boot_up` |
| 加材料 | 在材料格上按下，把瓶子拖到摇酒器上松开，每次 +1。键盘 Q W E R T 直接 +1，没有音效；Shift+键 −1 | 瓶子：常态 `adelhyde` 等，拖动中 `*_hover`，不可用 `*_off`。拖到摇酒器上方时摇酒器换 `shake_hover_spr`。松手后从摇酒器放出一圈放大淡出的光圈 `shakerpulse_*`。份数格 `a_on`…`e_on`，1–10 份逐格点亮，没加的格子 30% 透明；11–20 份时在同一格上叠一条窄的 `*big_on`。每个栏位最多 20 份 | `addingredient` |
| 加冰 / 陈化 | 点左侧两格（键盘 A / S），开关切换 | `icesprite` / `agesprite`，关时 30% 透明 | 打开：`iceadd` / `ageadd`；关掉：`buttonnoclick` |
| 开始摇 | 点「调制」（空格） | 按钮 `mixspriteyes`，杯里没东西时是 `mixspriteno`。摇酒器换 `shaker_nohit`，在 ±30° 之间左右摆，每帧 5° | `mixdone`；空杯时 `buttonnoclick` |
| 摇的时长 | 摇满 150 帧（30fps 下 5 秒）自动变成快摇，每帧 15° | 同上 | 摇的过程中没有循环音效 |
| 停 | 再点（按钮字变成「停止」）。慢摇时停下是 mixed，快摇后停下是 blended | 摇酒器换成饮品图，饮品图都是 35×53，中心对齐。上方飘起「成功」或「失败」字样（`successtext_cn` / `failtext_cn`），每帧上移 2px、淡出 | `mixdone` |
| 上酒 | 再点（按钮字变成「上酒」），或直接点杯子 | 配方书 10 帧压扁后关掉，弹出金额 | `glassserve` |
| 失败品 | 配方对不上叫 `failed`：按钮变 `mixspriteno`，不能上酒，只能重做 | `glitchbottle` | `buttonnoclick` |
| 重做 | 点「重做」 | 按下时下移 1px，换 `resetsprite_hover`；松手时放出白色光圈 | 杯里有东西：`buttonclick`；空杯：`buttonnoclick` |
| 第二杯 | 一次点两杯时用「栏位 1 / 2」切换 | 当前栏 `slotsprite`，另一栏 `slotoff`，已调好 `slotdone`；第一杯调好后按钮字变成「下一杯」 | 切到另一栏：`buttonclick`；点当前栏：`buttonnoclick` |

按钮上的字是另画的（`ui_tl_ch`）：调制、停止、上酒、下一杯、重做、栏位 1、栏位 2、加冰、陈化。材料名中文版也不翻译，仍是 Adelhyde、Bronson Ext、Pwd Delta、Flanergide、Karmotrine。

对照 wiki（二手）的说法：按「Mix」后在慢摇时按「Stop」是 mixed；超过 5 秒摇酒器会快速左右摇，这时再停就是 blended。和代码一致。

### 3. 文本和打字音效

- **打字速度**：每帧 1 个字，30fps 下每秒 30 个字（`textbox_typewriter`）。
  - 脚本可以用 `[S:S]` / `[S:R]` 降到每 4 帧、每 12 帧一个字，但三种语言的剧本都没用过。
  - 停顿 `[P:n]` 停 n 帧，全剧本只有十几处。
- **点一下**：
  - 字还没打完：瞬间打完整句，打字途中的命令（表情、停嘴型）一起执行掉。
  - 已经打完：翻到下一句。
  - 酒吧里鼠标只有点在文本框范围内才算（`dialog_frame` 判定）；空格在哪都行；按住 Ctrl 快进。
- **一句的排法**：
  - 说话人名字和台词在同一行：名字按角色上色，后接冒号，台词白色。没有单独的名字条。
  - 换行由剧本里的 `#` 手动给出，一框最多 4 行。
  - 中文版字体是 Noto Sans CJK SC 10pt，每个汉字宽 13px，一行到头约 29 字；剧本里一行的 95 分位约 26 字（含名字），一框多数 1–2 行。
  - 英文版 45 字一行，日文版约 27 字一行。
- **打字音效不是每个字一声**：
  - 角色「在说话」时，循环播一段 0.11 秒的 `bleep_high`，或 0.16 秒的 `bleep_low`。
  - 「在说话」由台词开头的 `[XS:xxtalk,1]` 打开，由句尾的 `[STOPLIP:]` 关掉。音效和嘴型共用这个开关，所以响的时长就是打字的时长；点一下打完整句，声音立刻停。
  - 逐字发声的代码（`textbox_voice_play`）在这一版里是空壳，不出声。
- **按角色分高低两种**：
  - `bleep_high`：Jill、Dana、Alma、Dorothy、Stella 等女性角色，例外是 Virgilio 和 Tomcat。
  - `bleep_low`：Donovan、Ingram、Gil、Art 等男性角色。
  - 没有一人一种音色。
  - 键盘 V 可以整体关掉打字音效。
- **对 VA-283 的建议**：29 位都是女孩，全用 `bleep_high`；制作人的中文台词用 `bleep_low`，正好分开两人。
- **客人进门没有音效**，只有立绘的两段淡入。`door` 音效存在，剧本里没用过。

### 4. 手机：只支持横屏，竖屏只显示「请横过来」

用户已定：手机只支持横屏，竖屏不做布局。

1. **网页没法在所有手机上强制横屏。**
   - `screen.orientation.lock('landscape')` 只在安卓上能用：Chrome、Samsung Internet、Firefox 144 起。
   - 安卓上有两个前提：
     - 页面得先进全屏。Chromium 的 `FullScreenRequired()` 在安卓上写死返回 true；不在全屏、也不是以 `display: fullscreen` 安装的 PWA 时，直接报错。
     - 进全屏的 `requestFullscreen()` 要用户的点击来触发。
     - 所以只能在用户点某个按钮时，依次进全屏、锁横屏。
   - iPhone 上做不到：
     - Safari 及所有 iOS 浏览器都没有 `lock()`。
     - iPhone 也没有元素全屏，只有 iPad 有。
     - 能读方向（`screen.orientation.type` 和 change 事件，Safari 16.4 起），但改不了方向。
   - 本应用没有 PWA manifest，不用考虑以 PWA 安装的情况。
2. **竖屏检测**：
   - 用 CSS 媒体查询 `@media (orientation: portrait) and (pointer: coarse)` 盖一层提醒就够，不用 JS。
     - `orientation` 看的是视口宽高，不是设备方向。
     - 加 `pointer: coarse` 是为了不让电脑上的窄窗口也弹提醒。
     - MDN 提醒：竖屏弹出软键盘时视口会变「横」。酒吧里不打字，没影响。
   - 要在 JS 里知道方向时，用 `matchMedia('(orientation: portrait)')` 的 change 事件，或 `screen.orientation` 的 change 事件。
3. **横屏下 640×360 放多大：手机上整数倍放大做不到。**
   - 手机横屏的整屏高度只有 360–440 CSS px：
     - iPhone 15/16 是 393，Pro Max 是 430–440。
     - 安卓常见 360–412。
   - 浏览器地址栏还要再吃掉一截：
     - 有人报 iPhone 横屏 Safari 显示工具栏时可视高约 330（Chromium 模拟，未在真机核实）。
     - 安卓 Chrome 顶栏按经验约 56，没找到一手数字。
   - 所以普通标签页里只能放到约 0.85–1.0 倍；安卓进全屏后约 1.0–1.15 倍。
   - 宽度不是瓶颈：0.92 倍时宽 589，iPhone 15 横屏扣掉两侧各 59 的安全区后还有 734。
   - 建议：
     - 电脑上按整数倍放大：视口够 1280×720 就 2 倍。
     - 手机上按 `min(宽/640, 高/360)` 小数缩放。
       - 想保持像素均匀，可以先在离屏 canvas 上按整数倍（例如 3 倍）用最近邻画好，再让浏览器平滑缩小到目标尺寸。
       - 也可以直接 `image-rendering: pixelated` 小数缩放。手机像素比 2.6–3.5，每个原版像素合 2.2–4 个物理像素，不均匀不太显眼。
     - 尺寸按 `visualViewport` 或 `innerHeight` 算，并监听 resize：iOS 的 `100vh` 含工具栏后面那截。
   - iPhone 横屏底部 21px 的 Home 条安全区，正好可以压在外框底边那 19px 装饰边上。
4. **同类做法，两个例子**：
   - CrazyGames：开发者在投稿时填支持的方向，平台自己弹「请旋转设备」，游戏不用写锁方向的逻辑。
   - Playgama Bridge SDK：配 `supportedOrientations: ["landscape"]` 和 `useBuiltInOrientationPopup: true`，转到不支持的方向就弹内置的旋转提示层。
   - 这类提示层一般是盖满屏幕的暗底，中间一个手机图标加一行字；我没有截图核对具体样子。
   - Construct 的文档也说，多数浏览器只在全屏时才让锁方向。
   - 反过来，Poki 现在要求手机游戏必须能竖屏玩，认为让玩家转手机会流失人。这说明「请横过来」本身就有流失。
5. **给票 08 的可选做法**：
   - 甲（最简单）：竖屏时只盖一层「请横过来」，横屏按上面的规则缩放。iPhone 和安卓一样。
   - 乙：在甲的提醒层上加一个「全屏」按钮，只在 `screen.orientation.lock` 存在、`document.fullscreenEnabled` 为真时显示（安卓）。点了就进全屏、锁横屏，失败就静默留在提醒层。
     - 好处是安卓手机竖着拿也能一点就转过来，还能多出地址栏那截高度。
     - 退出全屏时锁会被自动解除（规范要求）。
   - 两种都要做的：横屏时 iOS Safari 的工具栏会随滚动收放，页面要禁止滚动，并在 `visualViewport` resize 时重算缩放。

### 5. 背景音乐

- 原版酒吧里放的是玩家在点唱机里选的 12 首歌单，可选曲目共 59 首（`jukebox_list` 的 `fullplaylist`）。
- 没开点唱机时：序章固定放 Dusk，第 1 天放 Every Day is Night，之后放 Last Call（`mixershow_Create_0`）。
- 适合当 VA-283 背景音乐的见第 5.3 节的表。没有剧情含义、偏轻松的有十几首，每首 1–4.7 分钟、1.1–5.3 MB。
- 先放 3–4 首就够一次光顾（3–5 分钟）用，约 12 MB。

---

## 1. 画面布局（依据）

### 1.1 层次和坐标

GameMaker 的 depth 越大越先画。酒吧房间 `bar` 里只放了三个对象（`mixershow`、`dialog_control`、`transition_in`），其余全由代码建出来：

- `mixershow` 建好后调 `call_mixer()`，按下面的坐标建出调酒台。坐标写在各对象的 `Create_0`。
- `dialog_control` 调 `daycontrol()` 驱动剧情，并建侧边菜单 `side_menus`。

| 对象 | depth | 画什么 | 坐标 | 出处 |
|---|---|---|---|---|
| `fondos` | 3000 | `barground` | (11,18) | `gml_Object_fondos_Draw_0` |
| `bg_tv` / `bg_fan` | 2999 | 电视频道、吊扇 | (239,44) / (193.3,61.3) | `*_Create_0` |
| `sprite_xxx`（客人） | 2800 | 立绘：剪影层 + 彩色层 + 眼 + 嘴 | (SHOW 的 x, 268) | `textbox_cmd_execute` 的 `CMD_SHOWSPRITE` |
| `recipebg` | 2700 | `recipe_bg` | 左上 (18,20) | `gml_Object_recipebg_Draw_0` |
| `obj_background` | −10 | `frame_sprite` | (0,0) | `gml_Object_obj_background_Draw_0` |
| 材料瓶 `adl` `bex` `dlt` `fln` `krm` | −3000 | `adelhyde` 等 | (405,140) (480,140) (555,140) (405,200) (555,200) | `gml_Object_adl_Create_0` 等 |
| 摇酒器 `shaker_a` | −200 | `shaker_spr`，原点 (36,34) | (513,216) | `gml_Object_shaker_a_Create_0` |
| 栏位 `slot1` `slot2` | −3000 | `slotsprite` 等 | (479,94) (553,94) | `slot1_Create_0` |
| 重做 `reset_btn` / 调制 `mixw` | −3000 | `resetsprite` / `mixspriteyes` | (402,243) / (553,243) | `*_Create_0` |
| 份数格、冰、陈化、标签字 | — | `a_on`…、`icesprite`、`agesprite` | 见 `amounts_Draw_0` | `gml_Object_amounts_Draw_0` |
| 金额 | −3000 | `$` + 数字，字体 recipefont4 | (360,95) | `gml_Object_scorecount_obj_Draw_0` |
| 文本框 `obj_textbox` | — | 正文 | 框 (15,275)，字 (23,279) | `gml_Object_obj_textbox_Create_0` |
| 点击继续 `ctc_obj` | −1000 | `ctc` 8 帧 | (413,328) | `gml_Object_ctc_obj_Create_0` |
| 侧边菜单 | −4999 | 隐形热区 + 文字 | 设置 (445,285)、读取 (543,285)、点唱机 (445,312)、退出 (543,312) | `side_*_Create_0` |

外框的透明区域是逐行量出来的（Pillow 读 `000_frame_sprite.png` 的 alpha）：

- y 27–89：x 19–428
- y 90–113：x 19–350
- y 114–267：x 19–347

`00_bar_frame.png`（BGND 里的同名背景）和 `alt_frame_spr` 把右侧按钮格也挖空了。`alt_frame_spr` 只在彩蛋 `easter_bar_1` 里切换（`global.framebar`），默认用 `frame_sprite`。

### 1.2 客人立绘

- 位置：剧本命令 `[SHOW:x,sprite_xxx]` 在 (x,268) 建立绘对象；立绘原点在底边中点，例如 `dana_spr` 160×215，原点 (80,215)。
  - 剧本里 x=185 出现 187 次，是单人位；120 和 280 是两人位。
  - 原版立绘高 165–215px，客人窗下半段高 154（114–267），所以只露出半身到大半身。
- 出场退场：见结论第 1 节（`gml_Object_sprite_dana_Step_0`、`Alarm_1`）。
- 情绪：`[XS:danaface,worry]` 这类命令换表情层。
- 调酒时客人被配方书整块盖住：配方书 depth 2700，比立绘的 2800 更靠前。

### 1.3 配方书

- `recipebook_bg` 在 (18,20) 打开：
  - 先画 `recipe_bg`，`wipe` 每帧 +0.04，从上往下擦出，约 25 帧；
  - 再建首页和四个标签：按名称、按口味、按种类、瓶装饮品（`ui_tl_ch`）。
- 口味分甜味、苦味、酸味、辛辣、发泡；种类分女性化、男性化、经典、时尚、宣传。
- 每页配方是一张做好的图 `recipes_cn`（25 帧，315×214），画在 (27,45)。图上的中文是官方的。
- 上酒后 `global.recipeon=0`：配方书高度每帧 −0.1、透明度每帧 −0.12，10 帧后销毁。

## 2. 调酒流程（依据）

- 拖放：`gml_Object_a_button_Step_0`。
  - 在 75×57 的材料格（`b_ingredientes`，例如 A 格 (400,123)）上按下，置 `drag`，瓶子跟着光标走。
  - 松开时如果和 `shaker_a` 的碰撞框（72×68，中心 (513,216)）重叠，就 +1，播 `addingredient`，建光圈 `shaker_effect_1`（`gml_Object_adl_Step_0`）。
  - 每栏位 20 份封顶。鼠标没有减的方法，只能重做。
- 键盘：`gml_Object_keyboard_mixerbinds_Step_0`。
  - Q W E R T 加 A B D F K，Shift 减，不出声、不放光圈。
  - A 加冰，S 陈化，空格调制、停止、上酒，Tab 切栏位。
- 调制按钮：`gml_Object_mixw_Step_0` 管按下时的音效和按钮图，`gml_Script_mix_action` 管状态切换。
  - 没摇：置 `mixing=1`、`mixed_a=1`，摇酒器 `alarm[0]=2` 开始摆、`alarm[1]=150`。
  - 150 帧到了还在摇：`alarm[1]` 置 `failed_a=1`，摆幅步长从 5° 变成 15°（`gml_Object_shaker_a_Alarm_0/1`）。
    - 这个 `failed_a` 就是「blended」：配方判定里 mixed 的饮品要求 `!failed_a`（`gml_Script_drink_a`）。
  - 正在摇时再按：停，`mix_a=1`。销毁摇酒器、建饮品图 `drinksprite_a`，在 `drink_a()` 里认出是哪种饮品，再建「成功/失败」字样。
  - 已停时再按：`mixcontrol()` 结算，`glassserve`，弹金额 `scorepop_obj`。
    - 失败品（`bevid_a == "failed"`）这里直接不响应。
  - 点摇酒器或杯子（`shaker_button`，碰撞框 72×68）也能上酒，效果相同。
- 两杯：`global.slotamount == 2` 时，第一杯停好后按钮字变成「下一杯」，再按切到栏位 2。两杯都好了才能一起上。
- 重做：`gml_Object_reset_btn_Step_0` 加 `gml_Script_resetmixer`，清当前栏位的份数、冰、陈化和摇的状态。

## 3. 文本（依据）

- 打字：
  - `obj_textbox_Step_0` 每帧调 `textbox_typewriter`。
  - `text_draw_speed` 默认 1，即每帧 1 字；`[S:S]` 是 4，`[S:R]` 是 12（`textbox_cmd_execute`）。
  - 房间速度 30，所以默认每秒 30 字。
  - 统计 `scripts/raw/{eng,chn,jp}`：没有 `[S:…]`；`[P:n]` 各 19 处，多为 20 或 30 帧。
- 点击：`gml_Object_obj_textbox_Step_1`。
  - 没打完：循环调 `textbox_typewriter` 直到句尾，即瞬间打完，途中的命令一并执行。
  - 打完了：存进记录、翻下一句。
  - 判定在 `gml_Script_adv_txt_alt`：
    - 酒吧里鼠标点击要求 `global.can_keepreading`，也就是光标在 `dialog_frame` 上（`gml_Object_dialog_frame_Step_0`）；
    - 空格任何时候都算；
    - 按住 Ctrl（不按 Shift）每帧都算，相当于快进。
- 排版：
  - `textbox_maxlines = 4`。
  - 名字用 `[C:13]Jill:[C:C]` 这种颜色命令给前缀上色；颜色表在 `gml_Script_textbox_color_get`，是 GameMaker 的 BGR 整数。
  - 字体按语言选（`dialog_control_Create_0`）：
    - 中文 `dialogfontch`：Noto Sans CJK SC 10，「中」字宽 13、高 16；
    - 英文 `dialogfont`：Inconsolata 12，字宽 8；
    - 日文 `jpdialog`：PixelMplus12 9，字宽 12。
  - 点单时的文本框 `order_text` 用同一套字体，行距 16，宽 380。
- 打字音效：`gml_Object_audio_controller_Step_0`。
  - 每帧检查各角色的 `global.xxxlips`：女性组任一为 1 时，如果 `bleep_high` 没在播就循环播；全为 0 时停。男性组同理用 `bleep_low`。
  - `xxxlips` 由 `[XS:xxxtalk,1]` 置 1（`gml_Script_textbox_var_set`），由 `[STOPLIP:]` 调 `reset_lips()` 全部清零。
  - `global.voice_able` 总开关，V 键切换。
  - `textbox_voice_play`（按字速每 4 字、每 2 字发声那套）在这一版里所有分支都不出声。
- 声音时长（ffprobe）：`bleep_high` 0.11 s，`bleep_low` 0.16 s，`bleep_config` 0.11 s。

## 4. 手机（依据）

- `ScreenOrientation.lock` 的兼容性（MDN browser-compat-data `api/ScreenOrientation.json`，访问 2026-10-26，一手·文档）：
  - chrome_android 38 起支持；
  - firefox_android 144 起支持（之前 79–143 返回错误）；
  - safari / safari_ios：`version_added: false`；
  - 桌面 Chrome 标注「Always throws NotSupportedError」。
  - 同文件里 `type`、`angle`、change 事件在 Safari 16.4 起支持。
- `Element.requestFullscreen` 在 safari_ios 上的标注（同一数据源 `api/Element.json`）：
  - 「Only available on iPad, not on iPhone」；
  - 「Swiping down exits fullscreen mode, making it unsuitable for some use cases like games」。
- 规范 W3C Screen Orientation（编辑草案，https://w3c.github.io/screen-orientation/ ）：
  - 「A user agent MUST restrict the use of lock() to simple fullscreen documents as a pre-lock condition」；
  - 退出全屏时解除锁定；
  - 已安装的 web 应用 SHOULD 要求 fullscreen 显示模式。
- Chromium 源码（一手）：
  - `content/browser/screen_orientation/screen_orientation_delegate_android.cc` 的 `FullScreenRequired()` 返回 true。
  - `screen_orientation_provider.cc` 在页面既不在全屏、display mode 也不是 fullscreen 时返回 `ERROR_FULLSCREEN_REQUIRED`。
  - 开了 `kRestrictOrientationLockToPhones` 时，非手机设备直接报不支持。
- 全屏需要用户手势：MDN `Element.requestFullscreen` 页「Transient user activation is required」。
- `orientation` 媒体特性看视口、软键盘会让它变成横的：MDN `@media/orientation` 页的 Note。
- 横屏安全区（二手，gist「iphone-pwa-game-guide」，https://gist.github.com/fozzedout/5e77925381991a9570151550992baf14 ）：
  - 灵动岛机型（14 Pro–16）上 / 下 / 左 / 右为 0 / 21 / 59 / 59；
  - 刘海机型左右 44–47；
  - 只有 `viewport-fit=cover` 时 `env()` 才有值。
  - 同文还写「iOS 上 orientation.lock 和 manifest 的 orientation 都无效」，和 BCD 一致。
  - 本应用目前没设 `viewport-fit=cover`，Safari 会自己在左右留白，可用宽度相同。
- 可视高度（二手，未在真机核实）：
  - 一个游戏项目的 PR 用 844×330 模拟「iPhone 横屏、Safari 工具栏显示」（https://github.com/JDix90/EmpireCities/pull/640 ）；
  - fullPage.js issue #2414 报 iPhone 7 Plus 横屏去掉工具栏后可视高 370，整屏 414。
  - 原型阶段应在真机上量一次。
- 平台文档（一手·文档）：
  - CrazyGames Technical requirements（https://docs.crazygames.com/requirements/technical/ ）：「The website will make sure your game can be played only in those orientations, by asking the users to rotate their devices」。
  - Playgama Bridge Device API（https://wiki.playgama.com/playgama/bridge-sdk/api/device ）：`useBuiltInOrientationPopup`。
  - Poki Requirements（https://developers.poki.com/guide/requirements-quality ）：手机上竖屏或横屏铺满，按 640×360、836×470、1031×580 等比缩放。
  - Poki 博客「What it takes to build games for the web in 2026」（https://poki.com/blog/building-web-browser-games-2026 ）：要求每款游戏能竖屏玩，转屏「is a conversion killer」。
  - Construct 3 Browser 插件文档（https://www.construct.net/en/make-games/manuals/construct-3/plugin-reference/browser ）：Lock orientation「may have to already be displaying in fullscreen」。

## 5. 素材清单

### 5.1 图（`E:\Download\others\VA11_extract\sprites\`）

**提取目录里的图有一部分被裁掉了透明边。** 提取脚本按图集里的实际像素裁图，没有把透明边补回来，所以「切出尺寸」比游戏里的「逻辑尺寸」小。按游戏坐标摆放时，要先把切出来的图贴回逻辑尺寸画布的 `+(x,y)` 偏移处，再按原点对齐；没写偏移的就是没裁过。偏移来自 TPAG 的 TargetX/Y（UTMT 读出）。

| 组 | 文件（sprites/） | 切出尺寸 | 逻辑尺寸 / 偏移 | 原点 | 用途 |
|---|---|---|---|---|---|
| 画面 | `000_frame_sprite.png` | 640x360 | 640x360 | 0,0 | 整屏外框（默认）；左上客人窗、下方文本框是透明洞，右上 logo 烤在图里；画在客人和配方书之上 |
| 画面 | `001_alt_frame_spr.png` | 640x360 | 640x360 | 0,0 | 彩蛋外框（global.framebar=1），右侧按钮格也是洞；不用 |
| 画面 | `002_barground.png` | 424x257 | 424x257 | 0,0 | 酒吧背景，画在 (11,18)；电视位置 (228,26) 99×41 是透明洞 |
| 画面 | `148_news_channel_spr_00…05.png` | 99x41 | 99x41 | 0,0 | 电视频道动画之一（共十几组 *_channel*，画在 (239,44)） |
| 画面 | `141_fan_spr.png` | 24x24 | 24x24 | 12,12 | 吊扇，画在 (193,61)，每帧转 2° |
| 画面 | `139_scanrines.png` | 640x359 | 640x360 +(0,0) | 0,0 | 可选扫描线滤镜 |
| 画面 | `495_barintro_spr_00…02.png` | 640x360 | 640x360 | 0,0 | 店门口（VALHALLA 招牌）三帧，可做「开店」画面，招牌要改 |
| 文本 | `095_dialogsprite.png` | 383x67 | 383x67 | 0,0 | 文本框底（全透明，仅定尺寸），左上 (15,275) |
| 文本 | `102_ctc_00…07.png` | 12x12 | 15x15 +(3,3) | 0,0 | 「点击继续」动画箭头，8 帧，画在 (413,328)，image_speed 0.3 |
| 调酒台 | `004_adelhyde.png`<br>`005_adelhyde_hover.png`<br>`006_adelhyde_off.png` | 20x38 | 20x38 | 0,0 | A 材料瓶：常态 / 拖动中 / 不可用；左上 (405,140) |
| 调酒台 | `007_bronson.png`<br>`008_bronson_hover.png`<br>`009_bronson_off.png` | 20x38 | 20x38 | 0,0 | B 材料瓶，(480,140) |
| 调酒台 | `010_delta.png`<br>`011_delta_hover.png`<br>`012_delta_off.png` | 20x38 | 20x38 | 0,0 | D 材料瓶，(555,140) |
| 调酒台 | `013_flanergide.png`<br>`014_flanergide_hover.png`<br>`015_flanergide_off.png` | 20x38 | 20x38 | 0,0 | F 材料瓶，(405,200) |
| 调酒台 | `016_karmotrine.png`<br>`017_karmotrine_hover.png`<br>`018_karmotrine_off.png` | 20x38 | 20x38 | 0,0 | K 材料瓶，(555,200) |
| 调酒台 | `058_a_on.png`<br>`059_b_on.png`<br>`060_c_on.png`<br>`061_d_on.png`<br>`062_e_on.png` | 8x17 | 8x17 | 0,0 | 份数格（1–10 份），每格 9px 间距、两行 18px；没加的画 30% 透明。A (428,140)、B (503,140)、D (578,140)、F (428,200)、K (578,200) 起 |
| 调酒台 | `063_abig_on.png`<br>`064_bbig_on.png`<br>`065_cbig_on.png`<br>`066_dbig_on.png`<br>`067_ebig_on.png` | 4x13 | 8x17 +(2,2) | 0,0 | 11–20 份时叠在同一格上的窄条 |
| 调酒台 | `072_icesprite.png` | 25x21 | 33x57 +(3,23) | 0,0 | 加冰开关，(362,123)，关时 30% 透明 |
| 调酒台 | `071_agesprite.png` | 25x26 | 33x57 +(4,25) | 0,0 | 陈化开关，(362,183)，关时 30% 透明 |
| 调酒台 | `044_shaker_spr.png`<br>`047_shake_hover_spr.png`<br>`046_shaker_nohit.png` | 31x59 / 31x62 / 31x59 | 72x68 +(20,6) / 72x68 +(20,3) / 72x68 +(20,6) | 36,34 | 摇酒器：常态 / 拖着材料悬停 / 摇动中；中心 (513,216) |
| 调酒台 | `049_shakerpulse_red.png`<br>`050_shakerpulse_yellow.png`<br>`051_shakerpulse_blue.png`<br>`052_shakerpulse_green.png`<br>`053_shakerpulse_cyan.png`<br>`048_shakerpulse_white.png` | 31x59 | 72x68 +(20,6) | 36,34 | 加料时从摇酒器放大淡出的光圈（每帧 alpha −0.1、放大 0.08，10 帧）；A 红、B 黄、D 蓝、F 绿、K 青，白=重做 |
| 调酒台 | `079_slotsprite.png`<br>`080_slotsprite_hover.png`<br>`083_slotoff.png`<br>`084_slotoff_hover.png`<br>`081_slotdone.png`<br>`082_slotdone_hover.png`<br>`085_slotout.png` | 69x23 / 69x23 / 67x23 / 67x23 / 69x23 / 69x23 / 67x23 | 71x25 +(1,1) / 71x25 +(1,1) / 71x25 +(2,1) / 71x25 +(2,1) / 71x25 +(1,1) / 71x25 +(1,1) / 71x25 +(2,1) | 0,0 | 栏位 1/2 按钮：当前 / 非当前 / 已调好 / 不可用；(479,94)、(553,94)。`slotout` 也是闲聊时所有按钮的样子 |
| 调酒台 | `073_resetsprite.png`<br>`074_resetsprite_hover.png` | 68x23 | 71x25 +(1,1) | 0,0 | 重做按钮，(402,243)，按下时下移 1px |
| 调酒台 | `077_mixspriteyes.png`<br>`078_mixspriteyes_hover.png`<br>`075_mixspriteno.png`<br>`076_mixspriteno_hover.png` | 69x23 / 69x23 / 68x23 / 68x23 | 71x25 +(1,1) | 0,0 | 调制/停止/上酒按钮（文字另画），(553,243)；no=不能按 |
| 调酒台 | `057_successtext_cn_00…01.png`<br>`055_failtext_cn_00…01.png` | 35x12 / 54x12 | 59x12 +(12,0) / 102x15 +(0,3) | 29,6 / 21,8 | 停摇后在摇酒器上方飘起的「成功/失败」字样（中文版），每帧上移 2px、alpha −0.05 |
| 配方书 | `172_recipe_bg.png` | 420x252 | 420x252 | 210,126 | CALICOMP 蓝底窗，左上 (18,20)，开时 25 帧从上往下擦出 |
| 配方书 | `166_recipe_introcn.png` | 315x214 | 315x214 | 0,0 | 配方书首页（中文） |
| 配方书 | `170_recipes_cn_00…24.png` | 315x214 | 315x214 | 0,0 | 25 页配方（中文，含官方描述），画在 (27,45) |
| 配方书 | `617_shop_arrow_spr.png` | 23x24 | 24x24 +(0,0) | 0,0 | 翻页箭头 |
| 配方书 | `179_hoverrecipe.png`<br>`184_hoverrecipe4.png` | 60x15 / 80x15 | 60x15 / 80x15 | 0,0 | 列表项悬停条 |
| 饮品 | `019_flaming_moai_spr.png` … `042_piano_woman_spr.png`（24 张）<br>`043_glitchbottle.png` | 多数 35x53 | 35x53；裁过的见下 | 17,26 | 成品饮品图，中心对齐画在 (513,216)；`glitchbottle` 是失败品 |
| 饮品 | `182_abs_spr.png`<br>`181_rum_spr.png`<br>`180_tea_spr.png`<br>`183_fed_spr.png` | 20x32 / 21x34 / 11x41 / 22x20 | 25x40 +(2,5) / 25x40 +(2,3) / 35x53 +(12,6) / 25x40 +(1,14) | 12,20（tea 17,26） | 瓶装饮品（Absinthe/Rum/Tea/Plumfume） |
| 光标 | `159_cursor_spr.png`<br>`163_cursor_clicked.png` | 17x24 / 17x23 | 17x24 / 17x24 +(0,1) | 4,0 | 鼠标光标；网页上可不用 |

饮品图里裁过透明边的（逻辑尺寸都是 35×53，原点 17,26）：

| 文件 | 切出尺寸 | 偏移 |
|---|---|---|
| `020_sugar_sush_spr.png`、`037_mercuryblast_spr.png` | 13x29 | +(11,15) |
| `021_sparkle_star_spr.png` | 21x43 | +(7,5) |
| `023_fluffy_dream_spr.png` | 23x43 | +(5,5) |
| `024_sunshine_cloud_spr.png`、`040_zen_star_spr.png` | 24x38 | +(6,6) |
| `026_gut_punch_spr.png` | 23x28 | +(6,17) |
| `031_beer_spr.png` | 28x40 | +(3,4) |
| `043_glitchbottle.png` | 30x35 | +(3,9) |

其余 15 张是完整的 35×53。中文配方页 `recipes_cn` 的 25 帧和饮品的对应关系，交给票 01（饮品调研）核对。

### 5.2 音效（`E:\Download\others\VA11_extract\audio\`）

时长和大小用 ffprobe 和文件大小量出。

| 文件 | 时长 | 大小 | 原版何时播 |
|---|---|---|---|
| `080_addingredient.ogg` | 1.21 s | 0.03 MB | 把材料拖进摇酒器 |
| `101_iceadd.ogg` | 0.91 s | 0.02 MB | 打开加冰 |
| `081_ageadd.ogg` | 1.40 s | 0.02 MB | 打开陈化 |
| `109_mixdone.ogg` | 3.33 s | 0.05 MB | 按「调制」开始摇、按「停止」 |
| `099_glassserve.ogg` | 1.99 s | 0.03 MB | 上酒 |
| `088_buttonclick.ogg` | 2.07 s | 0.03 MB | 重做（杯里有东西）、切栏位、「下一杯」 |
| `089_buttonnoclick.ogg` | 1.57 s | 0.02 MB | 无效操作：空杯调制、失败品、关掉冰或陈化、空杯重做 |
| `083_bleep_high.ogg` | 0.11 s | 0.01 MB | 女性角色说话时循环 |
| `085_bleep_low.ogg` | 0.16 s | 0.01 MB | 男性角色说话时循环 |
| `086_boot_up.ogg` | 0.98 s | 0.02 MB | 打开配方书 |
| `106_jukeselect.ogg` | 1.14 s | 0.02 MB | 配方书的四个标签 |
| `104_jukechange.ogg` / `105_jukepick.ogg` | 1.24 / 1.20 s | 0.01 / 0.02 MB | 配方书列表项 / 口味种类按钮 |
| `110_mouse_hover.ogg` | 0.09 s | 0.01 MB | 悬停（可选） |
| `114_prompt.ogg` | 1.32 s | 0.02 MB | 退出确认框（可选） |
| `095_door.ogg` | 1.88 s | 0.03 MB | 剧本命令 `[DOOR]`，剧本里没用过；可给「她进门」用（可选） |

### 5.3 适合当酒吧背景音乐的曲目

- 来源：
  - 原版点唱机可选的 59 首（`gml_Object_jukebox_list_Create_0` 的 `fullplaylist` 是声音编号，对应 `audio/` 文件名前三位）；
  - 加上无点唱机时的三首默认曲。
- 我按曲名、原版用途挑出没有明显剧情或结局含义的，**没有试听**，原型时要人听一遍。
- 不推荐的：
  - 和具体剧情、结局、片尾绑定的：Who Was I?、Troubling News、Where Do I Go From Here、Will You Remember Me、The Answer Lies Within、Reminiscence、Believe in Me Who Believes in You、Welcome to VA-11 HALL-A、Truth、Glitch City；
  - 角色歌：Go! Go! Streaming-chan!；
  - 紧张段落：Tense、The Assignment、Those Who Dwell in the Shadows。

| 文件 | 曲名 | 时长 | 大小 | 备注 |
|---|---|---|---|---|
| `022_every_day_is_night.ogg` | Every Day is Night | 3:40 | 4.02 MB | 原版第 1 天默认曲 |
| `021_dusk.ogg` | Dusk | 3:18 | 3.43 MB | 原版序章默认曲 |
| `038_last_call.ogg` | Last Call | 2:13 | 2.17 MB | 原版其余日子没开点唱机时的默认曲 |
| `002_a_neon_glow_lights_the_way.ogg` | A Neon Glow Lights the Way | 2:32 | 2.44 MB | |
| `026_friendly_conversation.ogg` | Friendly Conversation | 2:15 | 2.42 MB | 另有 `027_…_loop` 1:48 / 1.95 MB |
| `048_safe_haven.ogg` | Safe Haven | 2:39 | 2.53 MB | 另有 `050_safe_haven_loop` 1:42 / 1.63 MB（原版房间曲） |
| `078_your_love_is_a_drug.ogg` | Your Love is a Drug | 3:00 | 2.77 MB | |
| `058_synthestitch.ogg` | Synthestitch | 4:41 | 5.26 MB | 最大的一首 |
| `037_karmotrine_dream.ogg` | Karmotrine Dream | 2:25 | 2.32 MB | |
| `052_skyline.ogg` | Skyline | 3:12 | 3.32 MB | |
| `019_digital_drive.ogg` | Digital Drive | 1:33 | 1.66 MB | |
| `030_good_for_health_bad_for_education.ogg` | Good for Health, Bad for Education | 3:14 | 3.59 MB | |
| `017_commencing_simulation.ogg` | Commencing Simulation | 1:51 | 1.79 MB | |
| `020_drive_me_wild.ogg` | Drive Me Wild | 3:48 | 4.31 MB | |
| `079_youve_got_me.ogg` | You've Got Me | 3:28 | 3.59 MB | |
| `036_jc_eltons.ogg` | JC Elton's | 1:45 | 1.81 MB | |
| `043_neo_avatar.ogg` | Neo Avatar | 3:42 | 4.01 MB | |
| `053_snowfall.ogg` | Snowfall | 2:50 | 3.05 MB | |
| `042_metropolis.ogg` | Metropolis | 1:06 | 1.14 MB | |
| `031_heart_of_the_city.ogg` | Heart of the City | 2:31 | 2.94 MB | |

- 前 12 首合计约 35:00、35.9 MB。
- 如果只先放 3–4 首（例如前三首加 A Neon Glow Lights the Way），约 12 MB。
- 一次光顾 3–5 分钟，用不完一首半。

## 6. 方法和复现

- 反编译：
  - 先把 `data.win` 复制到 `E:\tmp\va11-tools-screen\game\`，安装目录只读不动。
  - UTMT CLI 0.9.2.0 读这份文件会在 EXTN 块报「specified length 428, but read only 412」：
    - 游戏 GEN8 头里的 Build 是 1757，扩展末尾带了 16 字节 product ID；
    - UTMT 只在 Build ≥ 1773 时读这 16 字节。
  - 解决：把**副本**文件偏移 72 处的 u32 从 1757 改成 1773，然后：
    - `UndertaleModCli dump <副本> -c UMT_DUMP_ALL` 得到 2288 个 GML 文件；
    - `load <副本> -s xxx.csx` 跑 C# 脚本，导出房间、精灵原点、TPAG 偏移、字体字形、声音表。
- 示意图脚本和导出的中间文件放在 `E:\tmp\va11-screen-scripts\`、`E:\tmp\va11-tools-screen\`，不进仓库。
- 外框透明区、裁图偏移用 Pillow 量，音频时长用 ffprobe 量。
- 二手来源对照：
  - wiki「Drinktionary」（https://va11halla.fandom.com/wiki/Drinktionary ）讲 mix/blend 的 5 秒；
  - Steam 指南（https://steamcommunity.com/sharedfiles/filedetails/?id=856541980 ）列了快捷键；
  - 两者都和代码一致。
