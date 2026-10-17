# 调研：NovelAI 提示词怎么写（给「她发照片」的分栏用）

调研日期 2026-10-17。给票 04（怎么触发、谁来写提示词）做输入，接着「NovelAI 官方图像 API 现状」（`research/novelai-api` 分支的 `.scratch/photos/research/novelai-api.md`）往下写：接口、费用、条款、质量预设和 UC 预设原文那份已经查过，这里只引用，不再重复。

来源标记：
- **【官方文档】** docs.novelai.net。
- **【官方博客】** journal.novelai.net。
- **【Danbooru】** danbooru.donmai.us 的 tag 记录和 wiki（NovelAI 的 tag 体系沿用 Danbooru 写法，但不完全相同，见 4.2）。
- **【社区】** 第三方仓库、skill、知识库，只作佐证，写明维护状况。
- **【实测】** 本次自己请求的结果：tag 建议接口不带 token、不花钱；出图走 `.env.novelai` 里的中转（A 形态），一共 8 张，图存在仓库外的 `E:/tmp/nai-prompting/out/`，提示词逐张记在同目录的 `prompts.txt`。

---

## 要点

1. **没有能直接照搬的「角色扮演 LLM → NovelAI 照片」方案。** SillyTavern 的生图扩展是让 LLM 写一串逗号分隔的关键词，再拼上用户手写的通用前缀和角色前缀；它的 NovelAI 模型列表只到 V4.5，也没有针对 NovelAI 的写法规则。写 V5 提示词的 agent skill 最近两个月冒出来不少，最成熟的是 `Miint-Sunny/nai5-prompting`（118 星，GPL-3.0，10-14 还在更新），但它们都是给「人和 agent 一起慢慢磨一张图」用的，篇幅几万字，不适合塞进对话 LLM 的系统提示词。能抄的是其中几条规则（见 1.4）。【社区】
2. **官方规则只有这几条硬的**：tag 一律小写，用「逗号加空格」分隔，下划线写成空格；推荐顺序是「人数、角色、作品、其他随意」；要紧的放前半段；V4 以后要区分大小写，自然语言照英文语法写。我们定的前缀 `1girl, solo, <角色>, idolmaster shiny colors, …` 正好符合官方顺序。【官方文档】
3. **提示词里有好几种字符是语法，不能让 LLM 的原文带进去**：`{}` `[]` 是加权，`数字::…::` 是数值加权（V4 起；负数是 V4.5 起的「负权重」），`|` 在 V4 以后是「分角色」的分隔符，`||a|b||` 是随机挑选，`source#` / `target#` 是多人动作前缀，`Text:` 和引号会触发画面里写字。服务器要把这些字符全部剥掉再拼。社区还报告过以数字结尾的词紧跟 `::` 会被读成权重、把整张图炸掉。【官方文档】【官方博客】【社区】
4. **V5 tag 和自然语言都认**，官方说「直接描述你脑中的画面」，同时说 tag「简短、稳定」。社区锁种子对照：**姿势和机位写成句子容易画坏**（多出一条腿之类），写成 tag 才稳；句子适合写「谁拿着什么、谁在谁前面」这类关系。我们只拍她一个人，基本用不上句子，**全部写 tag 就够**。【官方博客】【社区】
5. **自拍只写 `selfie` 就行。** Danbooru 对 `selfie` 的定义本来就包括「这张图就是手机拍下的那张照片，手机看不见，她的手臂伸向镜头」。实测 V5 Curated，櫻木真乃，两个种子乘四种写法共 8 张，**8 张都没有出现手机，也没有多出来的手**：她一只手比耶，另一只手臂伸出画面外。加 `holding phone` 在这 2 张里没画出第二部手机，但也没有好处；`reaching towards viewer, outstretched arm, foreshortening` 会让伸出的手臂更大、透视更夸张。【Danbooru】【实测】
6. **「别人帮她拍」不要写 `pov`、`taking picture`、`holding phone`。** 官方文档说 `pov` 往往会画出第一人称视角的手；Danbooru 的 `taking picture` 是「她在拍照」，`holding phone` 是手机拿在她手上、看得见。别人拍她，就写景别加 `looking at viewer`，和普通插画一样。`photo (medium)`、`photo background` 是「真实照片」「真实照片当背景」，会把画风拉向实拍或拼贴，**照片感靠构图来做，不靠这两个 tag**。【官方文档】【Danbooru】
7. **LLM 最常犯的是写出「看着像 tag、其实不是」的词组。** 实测 tag 建议接口：`phone selfie`、`taking selfie`、`holding smartphone`、`casual outfit`、`happy expression`、`cafe interior`、`idol costume`、`practice room`、`soft lighting`、`wink`、`v sign` 全都不是已知 tag，各自有对应的正确写法（表见 4.1）。V5 能把不认识的词组当英文去理解，不至于出错，但效果不如正经 tag 稳。另外还有写句子、写外貌、写太多、写画面外的东西几种坑。【实测】【官方文档】【社区】
8. **校验 tag 最准的是官方的 tag 建议接口**（`GET https://image.novelai.net/ai/generate-image/suggest-tags?model=…&prompt=…`，不要 token）。它按模型返回，例如 `viewer holding phone` 在 V5 里有、在 V4.5 里没有；NovelAI 改过名的 tag 也以它为准，比如它要 `peace sign`，而 Danbooru 把 `peace sign` 并到了 `v`，**拿 Danbooru 词表校验会往错的方向改**。缺点是官方没写限速，一次只能查一个词，每次约 0.5 秒。**建议开发时用它批量建一份白名单和改写表，运行时只查本地表**，查不到的词记日志、不硬拒。【实测】【Danbooru】
9. **分栏建议**：「拍法」不要让 LLM 写 tag，改成**枚举**（自拍 / 别人帮她拍），由服务器换成固定的 tag；另加一个**景别枚举**（近景 / 半身 / 大腿以上 / 全身），由服务器换成 `portrait` / `upper body` / `cowboy shot` / `full body`，自拍只能选前两档。光线不单独开一栏，并进「地点和时间」。LLM 自由写 tag 的三栏，建议「地点和时间」2–4 个、「服装」1–4 个、「动作和表情」2–4 个，合计不超过 12 个，**每栏只写一个动作、一套衣服**。具体见第 5 节。
10. **两条要交给别的票的发现**：(a) 只写角色 tag、不写外貌 tag，8 张里真乃的发色、瞳色、发型都对得上；社区有人实测说「版权角色再叠外貌 tag 会和名字打架」，**「服务器拼外貌 tag」值不值得要，留给票 05 对比**。(b) `rating:general` 加负面 `nsfw` 之后，8 张里仍有 2 张白衬衫领口露出粉色吊带，**全年龄的负面词要再补 `bra strap` 这类细项，留给票 06**。【实测】【社区】

---

## 1. 现成可参考的东西

### 1.1 SillyTavern 的 Image Generation 扩展【社区】

来源：文档 <https://docs.sillytavern.app/extensions/stable-diffusion/>；源码 `public/scripts/extensions/stable-diffusion/index.js`（<https://github.com/SillyTavern/SillyTavern>，release 分支，这个文件最后一次提交 2026-04-25；仓库 3.4 万星，AGPL-3.0，持续维护）。

它怎么让 LLM 写提示词：
- **三种触发**：用户点按钮或打 `/sd`；「交互模式」用正则认用户的话（`send/make/draw…` 加 `pic/picture/photo…` 加主题，`your selfie` 会映射到「你的脸」模式）；「函数工具」模式注册一个 `GenerateImage` 工具，只有一个 `prompt` 字符串参数，描述是「Use when a user asks to … send a picture of a scene, a selfie, etc.」。
- **另发一次「安静请求」让 LLM 写提示词**，按模式套模板。例如「你自己」模式：「provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities … Do not write in full sentences.」「最后一条消息」模式要求按「地点、人数、相对位置、主要动作、外貌和表情、动作」的顺序写关键词。
- **清洗**（`processReply`）：去掉引号，换行变逗号，**只保留 `a-zA-Z0-9.,:_(){}<>[]/-'|#` 和空格**，按逗号切开、去空、用「, 」拼回。注意它故意保留了 `{}[]|:#` 这些语法字符，因为它要兼容各家后端的加权写法——我们不该保留（见 2.4）。
- **固定前缀**：通用前缀默认 `best quality, absurdres, aesthetic,`，负面默认是 SD 时代那串；另有「角色专属前缀」和「角色专属负面」，用户手写，拼在通用前缀后面。这和我们「服务器拼角色 tag 和外貌」的做法是一回事。
- **出图之后给 LLM 看什么**：默认把 `[{{char}} sends a picture that contains: {{prompt}}].` 这句写进对话记录，让角色知道自己发了什么。我们用中文说明栏做同样的事，更贴近角色口吻。
- **NovelAI 支持只到 V4.5**：模型列表是 `nai-diffusion-4-5-full`、`-4-5-curated`、`-4-full`、`-4-curated-preview`、`-3` 等，没有 V5；服务端（`src/endpoints/novelai.js`）发的是 `ucPreset: 0`、`qualityToggle: false`，正面原样放进 `v4_prompt.caption.base_caption`。

**可以借鉴的**：工具描述里点名「自拍」；「不写看不见的东西（性格、气味、心理）」「不写句子」这两条约束；出图后把描述写回记录。**不可借鉴的**：让 LLM 自由写外貌和整串提示词，没有 tag 校验，保留语法字符。

### 1.2 写 NovelAI 提示词的 agent skill【社区】

GitHub 上按「novelai skill / nai5 prompt」搜到的（2026-10-17）：

| 仓库 | 状况 | 怎么组织 | 对我们有用的 |
|---|---|---|---|
| [Miint-Sunny/nai5-prompting](https://github.com/Miint-Sunny/nai5-prompting) | 118 星，GPL-3.0，2026-08-26 建，10-14 还在发 nightly（v1.2f）；11 个拆分 skill，中文 | 「主串」放人数、动作、表情、镜头、场景、光影，最后是质量尾；「角色栏」只放外貌和服装；UC 用官方 Heavy 基础串；本图要排除的东西写成主串最后一行的负权重，不往 UC 里塞。说是基于 2226 张实测图和 962 条真实提示词，部分规则有锁种子对照（样本小，作者自己也说不能当成功率） | 姿势、机位、景别用 tag，关系用句子；质量尾只写一次、放最后；版权角色用规范名、不凭印象补默认外貌；「用户明确要全年龄时 UC 最前面加 `nsfw`」；不要用引号包叙事句（会被当成要画的字） |
| [2332239652/novelai-assistant](https://github.com/2332239652/novelai-assistant) | 6 星，MIT，10-12 更新；中文，SKILL.md 10 万字节，附 Danbooru 词表 xlsx | 自然语言转 Danbooru tag；`v5-field-corrections.md` 是在上一个仓库基础上的实测修正 | 「姿势必须 tag，句子 3/3 画坏、tag 3/3 成功」；「版权角色的角色栏只写名字，叠外貌会和名字打架」；「以数字结尾的画师名紧跟 `::` 会被解析成权重，整张图崩」 |
| [Tsukumi233/novelai-skills](https://github.com/Tsukumi233/novelai-skills) | 1 星，AGPL-3.0，10-12 建；Claude Code 插件，带单文件 SDK | `references/prompting.md` 记了 V5 的实测要点 | 多人图「每个角色只写一个可见动作」；Curated 比 Full 更偏厚涂；场景要写具体物件 |
| [iifaneo/novelai-prompt-writer](https://github.com/iifaneo/novelai-prompt-writer) | 6 星，MIT，09-21 建后没再动 | 每个候选 tag 用 Danbooru 公开 API 查一遍（脚本 `lookup_danbooru.py`），查不到就退回自然语言；不许擅自加没确认的视觉元素 | 「先查 tag 是否存在，查不到就写成短的自然语言，不硬造 tag」 |
| [Bigesila-B/novelai-image](https://github.com/Bigesila-B/novelai-image) | 1 星，无许可证，09-01 后没动 | `scripts/check-tag.mjs` 查 Danbooru，角色 tag 要 1000 帖以上才算「稳」 | 用帖子数当可靠度的门槛（只是作者经验值） |
| 其他：[RefirmSaky/novelai-prompt-design-enhancer](https://github.com/RefirmSaky/novelai-prompt-design-enhancer)、[WeissGoat/nai45-prompt-skill](https://github.com/WeissGoat/nai45-prompt-skill)、[1756141021/tag-skill](https://github.com/1756141021/tag-skill) 等 | 0–16 星，多数一两个月内新建 | 画风、画师串、漫画分镜为主 | 和我们的场景关系不大 |

共同点：都是「人和 agent 一起磨一张图」的工作流，大量篇幅在画师串、多人、漫画、文字渲染上；没有一个是「扮演角色的 LLM 顺手写几栏 tag」这种窄用途的。官方的 skill 仓库 [anthropics/skills](https://github.com/anthropics/skills) 和 [openai/skills](https://github.com/openai/skills) 的文件树里**没有** NovelAI 或 Danbooru 相关的文件。

### 1.3 专门生成 tag 的小模型【社区】

KBlueLeaf 的 DanTagGen / TIPO（论文 arXiv:2411.08127，ICLR 2026；<https://github.com/KohakuBlueleaf/KGen>）是在 Danbooru 上训练的几亿参数小模型，把简短提示扩写成一长串 tag。它解决的是「扩写」，我们要的是「按情境写少量 tag」，还得多部署一个模型，**不建议用**。

### 1.4 值得抄进我们规则的几条

| 规则 | 出处 |
|---|---|
| 只写画面里看得见的东西，不写性格、心情、气味；景别装不下的衣物部件不写（半身照不写鞋） | SillyTavern 模板；NovelAI 非官方知识库「tag what you see」<https://tapwavezodiac.github.io/novelaiUKB/Image-Generation.html> |
| 姿势、景别、机位写 tag，不写句子 | novelai-assistant、nai5-prompting 的锁种子对照 |
| 一个人只写一个可见动作 | Tsukumi233/novelai-skills |
| 人数 tag 只在最前面写一次，`solo` 只配单人 | nai5-prompting；官方多角色文档 |
| 质量 tag 只写一组，放最后 | nai5-prompting；官方质量 tag 文档（预设就是拼在末尾） |
| 不要引号、不要 `Text:` | 官方文字渲染文档；nai5-prompting |
| 不确定的词宁可写短的英文词组，也不要硬造 tag | iifaneo/novelai-prompt-writer；官方 Basics「NovelAI Diffusion is trained on prose as well」 |
| 出图后把「发了什么」写回对话记录 | SillyTavern 的 Chat Message Template |

---

## 2. 官方的写法规则

### 2.1 格式【官方文档】

- 「If using NAI Diffusion V4 models or higher, yes [capitalization matters]. Write all your tags in lower case and separate them with a comma followed by a space. Natural language descriptions should be written following the rules of English grammar, spelling, and capitalization.」（FAQ <https://docs.novelai.net/en/faq>）
- 下划线：官方文档没直接写；社区知识库说解析器会把下划线换成空格，写空格就行，只有 `^_^` 这类表情例外（<https://tapwavezodiac.github.io/novelaiUKB/Image-Generation.html>）。tag 建议接口返回的 tag 也都是空格写法。【社区】【实测】
- 改过名的 tag（因为 `|` 是语法字符，加上有些 tag 太抽象）：`v` → `peace sign`，`double v` → `double peace`，`:|` → `neutral face`，`tachi-e` → `character image` 等（<https://docs.novelai.net/en/image/tags>）。

### 2.2 顺序【官方文档】

- 「The expected pattern is: 1boy, 1girl, characters, series, everything else in any order」，并说明这只是推荐（<https://docs.novelai.net/en/image/tags>）。
- 「depending on which model you're using, the order of tags may be used to dictate how important a tag is」；**明确越靠前越强的只有 Anime V3 及更早**。V4 以后的模型，官方只在 Basics 里泛泛地说「It is advised to keep the most important things in the front half of your prompt」（<https://docs.novelai.net/en/image/basics>）。
- 质量 tag：V3 以后官方预设都拼在**末尾**（<https://docs.novelai.net/en/image/qualitytags>）。数据集 tag（`fur dataset`、`background dataset`）要放最前面，我们用不到。

### 2.3 加权【官方文档】【官方博客】

来源：<https://docs.novelai.net/en/image/strengthening-weakening>、V4.5 Full 发布博客 <https://journal.novelai.net/novelai-diffusion-v4-5-full-release-678318c86205/>。

| 写法 | 作用 | 适用 |
|---|---|---|
| `{tag}` / `[tag]` | 每层乘 / 除 1.05；正面和 UC 里都能用 | 所有模型（文档没限制版本） |
| `1.5::tag ::` | 数值加权，作用到下一个 `::` 为止；**不写收尾的 `::` 会一直作用到结尾**；`::` 也会把没配平的 `{` `[` 一起收掉 | V4 及以后 |
| `-1::hat ::` | 负权重：定向去掉某样东西，或者取反（`-1::monochrome ::` 让画面有颜色） | V4.5 及以后 |

V4.5 起「outputs remain reasonably stable even with numeric emphasis values up to and even beyond 10」。官方建议：负权重适合定向去掉一两样东西，UC 适合放一长串不想要的东西。

**对我们的含义**：LLM 写的栏里不该有任何加权。需要压掉某样东西时（例如自拍时不想要手机），由服务器在末尾加固定的负权重或 UC，不让 LLM 决定。

### 2.4 分隔符和其他语法字符【官方文档】【官方博客】

| 字符 | 含义 | 出处 |
|---|---|---|
| `\|` | V3 及以前是「Prompt Mixing」（把两段提示词的向量平均）；**V4 以后**改成「base 提示词 \| 角色 1 \| 角色 2」的分隔符；有角色提示框时这个写法会被禁用 | <https://docs.novelai.net/en/image/promptmixing>、<https://docs.novelai.net/en/image/multiplecharacters> |
| `\|\|a\|b\|\|` | 随机挑一个（Prompt Randomizer），同种子每次也会变 | <https://docs.novelai.net/en/image/promptrandomizer> |
| `source#` `target#` `mutual#` | 多人互动时标谁是动作发起方 | 多角色文档 |
| `Text:`，引号 | `Text:` 之后的内容会画进图里，必须放在最末尾；V5 的**网页前端**会把引号里的字自动变成 `Text:` 块 | <https://docs.novelai.net/en/image/textrendering>、V5 发布博客 |
| `@` 和 `!macro:…!` | 网页前端的提示词片段（Prompt Chunks），存在服务端，展开后才发出去 | <https://docs.novelai.net/en/image/promptchunks> |
| 多余的逗号 | 「double commas are automatically cleaned up before generating」 | Prompt Randomizer、Prompt Chunks 两页 |

**`|` 和引号到底是网页前端解析的，还是服务端也解析**，官方没写，本次**查不到**。我们直接调 API、自己拼 `base_caption`，不管是哪边解析，都应该在服务器上把 LLM 写的 `{}[]|:#"“”「」` 和 `Text:` 统统剥掉。社区另报告：以数字结尾的词紧跟 `::` 会被读成权重数值（如 `xxx153::` 读成权重 153），整张图崩坏（novelai-assistant 的 `v5-field-corrections.md`）。剥掉 `:` 就一并避免了。【社区】

### 2.5 V5 的自然语言和 tag 混写【官方博客】【官方文档】【社区】

- V5 发布博客：「V5 takes this [natural language] to the next level … Just describe the image in your mind … Of course, prompting with tags is still fully supported, for those who appreciate the brevity and consistency it can provide.」官方支持英文、日文提示词，中文等「may vary」（<https://journal.novelai.net/image-generation-novelai-diffusion-v5-is-here-c2df7c6b8d2d/>）。
- Basics：「Don't be afraid to include a term just because it isn't recognized as a suggested tag. NovelAI Diffusion is trained on prose as well.」
- 官方示例的混写方式是「先一串 tag，再接几句英文」（文字渲染页、V4.5 博客的示例都是这样）。**官方没有给出「哪些内容该用句子」的规则**。
- 社区锁种子对照（novelai-assistant、nai5-prompting）：姿势和机位用句子写会画坏（多一条腿、腿断成三段），用 tag 稳；句子适合写对象之间的关系（谁拿着什么、谁在谁前面、光从哪边来）。样本都很小。

**对我们的含义**：单人照片的情境几乎都是离散事实（地点、时段、衣服、姿势、表情），**全部用 tag 写**。中文说明栏不进提示词，不存在中文提示词的问题。

### 2.6 质量 tag、`rating:general`、UC 预设【官方文档】

原文已经在 `novelai-api.md` 的 3.4 节，这里只说和写法有关的：
- V5 的质量预设是在末尾加 `, very aesthetic, masterpiece, no text`（Standard）或 `, very aesthetic, amazing quality, no text`（Light）。`no text` 对照片有用（压掉水印、签名、乱写的字）。直接调 API 时由我们自己拼。
- V5 的预设里**没有** `rating:general`，V4.5 Curated 和 V4 Curated 的预设里有。官方文字渲染示例把 `rating:general` 和质量 tag 一起放在 tag 段末尾。我们放在质量 tag 前面即可。实测 `rating:general` 在 V5 tag 表里存在。
- V5 新加的复杂度 tag（`low / medium / high / ultra complexity`）只在 V5 有；官方说普通好看的图「probably best served by high complexity」，但质量预设里没加它。**要不要加，没实测，先不加。**
- UC 预设 V5 Full 和 V5 Curated 一样（Heavy / Light / Human Focus）。V5 Light 里含 `bad hands, bad anatomy`，Heavy 里没有，Human Focus = Heavy 加 `@_@, mismatched pupils, glowing eyes, bad anatomy`。人物照片用 **Human Focus** 更对口（我们实测用的是 Heavy 加 `nsfw`）。
- 官方文档提醒：质量 tag「may bias the AI towards generating pictures of anime characters」——这对我们反而是想要的。

### 2.7 长度【官方文档】

- V5 Curated 约 703 个有效 token，V5 Full 约 1471，V4.5 约 512 个 T5 token（<https://docs.novelai.net/en/image/models>）。我们整串（固定前缀约 15 个 tag 加 LLM 的 12 个以内加质量尾）远远用不完。
- 官方对数量的说法只有 Basics 里一句：「overly redundant or drawn out, lengthily tagged descriptions might not be desirable」。**官方没有给「写几个 tag 合适」的数字**；社区 skill 也都说「没有统一指标，每个词都要说得出在解决什么问题」。第 5 节的数字是我们自己的建议。

---

## 3. 照片感和自拍构图

### 3.1 相关 tag 在 Danbooru 上是什么意思【Danbooru】

摘自各 tag 的 wiki（<https://danbooru.donmai.us/wiki_pages/selfie> 等），帖子数是 2026-10-17 的；「V5」「V4.5」两列是 tag 建议接口里是否作为已知 tag 出现【实测】。

| tag | Danbooru 的意思 | 帖子数 | V5 | V4.5 |
|---|---|---|---|---|
| `selfie` | 用相机或手机拍自己；**也包括「这张图就是拍下来的那张照片」，此时相机看不见，常见她的手臂伸向观者身后** | 3.3 万 | 有 | 有 |
| `mirror selfie` | 对着镜子自拍，通常拿着手机（手机看得见） | 4700 | 有 | 有（数字小） |
| `holding phone` | 手里拿着手机（手机看得见） | 10.5 万 | 有 | 有 |
| `taking picture` | 她在拿相机或手机拍别的东西 | 1.2 万 | 有 | 有 |
| `viewer holding phone` | 第一人称视角，**观者**手里拿着手机 | 3200 | 有 | **没有** |
| `cellphone photo` | 画面里有一块手机屏幕，屏幕上是照片 | 5400 | 有 | 有 |
| `pov` | 第一人称视角，「Usually a body part of the viewer is visible」 | 20.6 万 | 有 | 有 |
| `reaching towards viewer` | 手臂伸向观者，像要伸出屏幕 | 3.9 万 | 有 | 有 |
| `outstretched arm` | 一只手臂伸直离开身体 | 9.6 万 | 有 | 有 |
| `photo background` | 用真实照片当背景的画 | 1.5 万 | 有 | 有 |
| `photo (medium)` | 图本身是相机拍的（实拍），是 meta 类 | 2.8 万 | 有 | 有 |
| `looking at viewer` | 看着观者，也就是看着镜头 | 501 万 | 有 | 有 |
| `cowboy shot` | 大腿以上 | 87 万 | 有 | 有 |
| `upper body` | 大约腰部以上 | 122 万 | 有 | 有 |

官方文档对 `pov` 的说法：「using `pov` encourages the AI to compose the image as if it were through the eyes of another character, often adding first-person hands to the image」（<https://docs.novelai.net/en/image/basics>）。【官方文档】

社区经验很少，只找到一条日文推文（NAI3 时期）：`selfie` 会让她自拍，`holding phone` 让她手里拿手机，`reaching towards viewer` 让她朝镜头伸手，三个一起用适合「对镜自拍、另一只手调整」的画面（<https://x.com/AI_Illust_000/status/1743187565208068347>）。【社区】**没查到**针对 V4.5 / V5「自拍出现第二部手机、多出来的手」的系统性经验。

### 3.2 实测：自拍的四种写法【实测】

条件：V5 Curated（PNG 元数据 `Source: NovelAI Diffusion V5 DB276663`），832×1216，23 步，scale 7，`k_euler_ancestral`，不开质量预设（自己拼），种子 1111 和 2222。

- 公共正面：`1girl, solo, sakuragi mano, idolmaster shiny colors, <变量>, upper body, looking at viewer, smile, peace sign, cafe, indoors, window, white blouse, rating:general, very aesthetic, masterpiece, no text`（**没写外貌 tag**）
- 负面：`nsfw,` 加 V5 Heavy UC 预设原文

| 写法 | 变量 | 种子 1111 | 种子 2222 |
|---|---|---|---|
| A | `selfie` | 手机不可见；一只手比耶，另一只手臂伸出画外（画面右下） | 同上，伸出的手臂在画面左下 |
| B | `selfie, holding phone` | 手机不可见；手臂伸向画外 | 手机不可见；手臂伸向画外 |
| C | `selfie, reaching towards viewer, outstretched arm, foreshortening` | 同 A | 伸出的手臂更大、透视更夸张 |
| D | C 再加一句 `She holds her phone out at arm's length to take a selfie, and the picture is seen from the phone camera.` 和末行 `-1::holding phone, smartphone::` | 同 A | 同 A |

结论：
- **8 张都没有出现手机，也没有多出来的手或第三只手臂**，比耶的手指数正常。V5 Curated 对 `selfie` 的理解就是「这张图是她自拍的照片」。
- 同一种子下四种写法的人物、构图几乎不变，说明 `selfie` 这一个 tag 已经决定了构图，**多加的手臂、手机类 tag 收益很小**。
- B 加了 `holding phone` 也没画出第二部手机，但只有 2 张、一个场景，**不能证明它安全**；它在 Danbooru 上的意思是「手机看得见」，留着只有风险。
- 局限：只测了一位角色、一个室内场景、一种手势、2 个种子；全身、外景、拿着东西的自拍都没测。
- **意外发现**：B 和 C 的种子 1111 两张，白衬衫领口露出粉色吊带。图是全年龄范围内的，但说明 `rating:general` 加 `nsfw` 挡不住这类细节，见第 5 节「交给票 06」。

### 3.3 「别人帮她拍」【官方文档】【Danbooru】（未实测）

出图名额用在了自拍上，这部分没有出图验证，结论来自官方文档和 tag 定义：
- 不写 `selfie`、`pov`（会画出观者的手）、`taking picture`（变成她在拍别人）、`holding phone`（手机出现在她手里）。
- 写景别（`upper body` / `cowboy shot` / `full body`）加 `looking at viewer`，和普通插画一样。想要抓拍感，可以让动作栏写 `looking away`、`looking back` 之类代替 `looking at viewer`。知识库提醒 `looking back` 常带出扭身、肩膀挡脸（<https://tapwavezodiac.github.io/novelaiUKB/Image-Generation.html>）。
- 「照片感」可以用 `depth of field`、`blurry background`（V5 tag 表里都有）做出浅景深，这是候选，**没实测效果**。
- **不要用** `photo (medium)`（实拍）和 `photo background`（真实照片当背景，Danbooru 定义就是拼贴），会把动漫画风拉偏。

### 3.4 建议：拍法由服务器换成固定 tag

| 拍法（枚举） | 服务器拼的 tag | 允许的景别 |
|---|---|---|
| 自拍 | `selfie, looking at viewer` | 近景 `portrait`、半身 `upper body` |
| 别人帮她拍 | `looking at viewer`（动作栏里已经有 `looking …` 或 `closed eyes` 时不加） | 近景、半身、大腿以上 `cowboy shot`、全身 `full body` |

另由服务器在末尾固定加一行负权重压手机，或者在 UC 里加 `holding phone, smartphone, cellphone`（自拍时）——这一条是**防御性建议**，实测没出问题，也没测过加了之后会不会削弱自拍构图（D 写法在 2 张里没削弱）。对镜自拍（`mirror selfie`）手机是看得见的，镜子里还多一个她，**第一版不建议开放**。

---

## 4. LLM 写 tag 的坑和校验

### 4.1 常见的坑

| 坑 | 证据 | 服务器怎么兜 |
|---|---|---|
| **写出看着像 tag 的词组**（最常见） | 【实测】见下表 | 改写表映射到正确 tag；映射不到的保留但记日志 |
| 写成句子 | SillyTavern 模板专门写了「Do not write in full sentences」；社区实测姿势写句子会画坏 | 单个 tag 超过 4 个词或 40 个字符就丢弃（或截断到逗号） |
| 写外貌（发色、瞳色、身材、年龄） | 我们的规定；SillyTavern 的模板反而要求 LLM 写外貌，说明这是 LLM 的默认习惯 | 黑名单正则：`… hair`（颜色、长度）、`… eyes`、`breasts`、身材和年龄类，命中就丢 |
| 写画面外的东西、互相矛盾 | 知识库：「specifying an eye colour and them being closed means that one will be ignored」，「tag what you see」 | 系统提示词里要求「只写这个景别里看得见的」；服务器不好兜 |
| 一栏写太多、多个动作 | 社区：一个人只写一个可见动作，多个动作会糊；官方：冗长的提示词「might not be desirable」 | 每栏截断到上限，超出的丢掉 |
| 混进语法字符 | 见 2.4 | 剥掉 `{}[]\|:#` 和引号、`Text:`；去掉数字权重 |
| 大写、下划线、全角标点 | 官方 FAQ：V4 起区分大小写 | 小写；下划线换空格；全角逗号换半角 |
| 写出越界的服装或姿态 | 【实测】tag 建议接口本身就会建议 `see-through cleavage`、`pov breasts` 这类词，接口不替我们过滤 | 全年龄黑名单（票 06）；**越界的要求在 LLM 这一步就拒绝** |

实测：tag 建议接口里，LLM 容易写的词组和正确写法（模型 `nai-diffusion-5-curated`）：

| LLM 可能写的 | 是不是已知 tag | 正确写法（接口建议的第一项或最贴切的） |
|---|---|---|
| `phone selfie`、`taking selfie`、`selfie pose` | 不是 | `selfie` |
| `holding smartphone` | 不是 | `holding phone` |
| `casual outfit`、`casual clothes` | 不是 | `casual` |
| `happy expression` | 不是 | `smile` 或 `happy` |
| `cafe interior` | 不是 | `cafe, indoors` |
| `idol costume` | 不是 | `idol clothes` |
| `practice room` | 不是 | `dance studio`（V5 有 908，V4.5 有 540；数字的含义见 4.2） |
| `soft lighting`、`natural lighting` | 不是 | `sunlight`、`backlighting`、`dim lighting` 等具体光线 |
| `wink` | 不是 | `one eye closed` |
| `v sign`、`v` | 不是 | `peace sign` |
| `golden hour` | 是，但数字很小（712） | 可以用，`sunset` 更稳 |

确认是已知 tag 的（V5 Curated）：`selfie`、`holding phone`、`smile`、`open mouth`、`blush`、`one eye closed`、`peace sign`、`waving`、`sitting`、`standing`、`walking`、`eating`、`holding cup`、`arm up`、`head tilt`、`leaning forward`、`looking back`、`cafe`、`office`、`train station`、`convenience store`、`bedroom`、`living room`、`aquarium`、`ferris wheel`、`sunset`、`evening`、`night`、`sunlight`、`backlighting`、`indoors`、`outdoors`、`yukata`、`hoodie`、`track jacket`、`sweater`、`pajamas`、`sundress`、`school uniform`、`white shirt`、`idol clothes`、`casual`、`dutch angle`、`from side`、`from above`、`wide shot`、`depth of field`、`blurry background`、`rating:general`。闪耀色彩的偶像（`sakuragi mano`、`kazano hiori`、`arisugawa natsuha`、`sonoda chiyoko`、`mayuzumi fuyuko`、`serizawa asahi` 等）和作品 tag 也都在。

### 4.2 怎么校验

**官方 tag 建议接口**【实测】【官方规格】：`GET https://image.novelai.net/ai/generate-image/suggest-tags?model=<模型>&prompt=<文本>`，不要 token，在 image.novelai.net 的 Swagger 里列着（见 `novelai-api.md` 2.2）。
- 返回 `{"tags": [{"tag", "count", "confidence"}, …]}`。输入正好是已知 tag 时，第一项就是它自己，`confidence` 为 0；不是已知 tag 时返回意思相近的候选，`confidence` 0.5–0.9。
- `count` 封顶 10000，同一个 tag 在不同模型下数字不同（`golden hour`：V5 Curated 712，V4.5 Curated 608；`dance studio`：908 和 540），像是各模型训练集里的出现次数，但**官方没有解释**。
- **按模型区分**：`viewer holding phone` 在 V5 有、V4.5 没有。换模型要重建白名单。
- 一次只能查一个词（整串逗号提示词进去只会按片段给建议，例如 `1girl, solo` 返回的是 `1girl`、`solo` 两个候选，没有「整串是否有效」的结论）。
- 速度：串行查 10 个词约 10 秒（含每次 0.3 秒的间隔），也就是每次约 0.5 秒。**限速官方没写**，没撞到过。
- 它是官方网页的输入联想接口，不是给第三方的校验服务；运行时每张图查十几次，既慢又可能被限速。

**Danbooru API**【Danbooru】【实测】：`/tags.json?search[name]=…`、`/tag_aliases.json`、`/wiki_pages.json`，公开可查，带 alias 和定义。坑在于 **NovelAI 改过名的 tag 和 Danbooru 方向相反**：Danbooru 上 `peace sign` 是 `v` 的别名（0 帖），NovelAI 却要求写 `peace sign`、`v` 根本不认。Danbooru 的 alias 对别的词有用（`wink` → `one eye closed`）。另外 Danbooru 主站有 Cloudflare，社区脚本说只有 curl 风格的 UA 能过（Bigesila-B 的 `check-tag.mjs` 注释），本次用 `curl/8.7.1` 的 UA 正常返回。

**现成词表**【社区】：[DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete)（2800 星，MIT，07-01 还在更新）的 `tags/danbooru.csv` 带帖子数和别名；[PYU224/tagdb-updater](https://github.com/PYU224/tagdb-updater) 每周从 Danbooru 更新。同样有 NovelAI 改名的问题，也不含 NovelAI 自己的 tag（`very aesthetic`、`location`、复杂度 tag 等）。

**建议做法**：
1. 开发时：从 Danbooru 词表里取「地点、时间天气、光线、服装、动作、表情」几类里帖子数较多的通用 tag（比如 1000 帖以上），逐个过一遍 tag 建议接口（指定我们用的模型），留下接口认的，得到一份白名单；再把 LLM 常犯的写法（4.1 的表、Danbooru alias）整理成改写表。两份表进仓库，换模型时重跑脚本。
2. 运行时：小写、剥语法字符、按逗号切、去重 → 查改写表 → 查白名单。白名单外的词：**短的（不超过 3 个词）保留**（V5 能当英文理解），长的丢掉；都记进运行记录，定期看日志补表。外貌、越界黑名单命中的一律丢掉，不管在不在白名单里。
3. 不在运行时调 tag 建议接口，也不让「校验失败」阻断出图。

---

## 5. 对我们分栏的建议

### 5.1 栏位

| 栏 | 谁写 | 写法 | 数量 |
|---|---|---|---|
| 拍法 | LLM 选 | **枚举**：自拍 / 别人帮她拍。服务器按 3.4 换成固定 tag | 1 |
| 景别 | LLM 选 | **枚举**：近景 / 半身 / 大腿以上 / 全身 → `portrait` / `upper body` / `cowboy shot` / `full body`；自拍只允许前两档，越界时服务器改成 `upper body` | 1 |
| 地点和时间 | LLM 写 tag | 地点 1–2 个（`cafe`、`bedroom`、`train station`），室内外 0–1 个（`indoors` / `outdoors`），时段或天气 0–1 个（`night`、`sunset`、`rain`），光线 0–1 个（`sunlight`、`backlighting`）。**光线并进这一栏，不另开** | 2–4 |
| 服装 | LLM 写 tag | 一套衣服：主体 1 个（`hoodie`、`yukata`、`idol clothes`、`school uniform`），可带颜色（`white shirt`），配件 0–2 个；**只写这个景别看得见的**（半身不写鞋和裙长） | 1–4 |
| 动作和表情 | LLM 写 tag | 一个动作或姿势（`sitting`、`holding cup`、`peace sign`、`waving`），表情 1–2 个（`smile`、`open mouth`、`blush`），视线 0–1 个（只在不看镜头时写，如 `looking away`） | 2–4 |
| 中文说明 | LLM 写 | 给她自己回看，不进提示词 | — |

LLM 自由写的 tag 合计不超过 12 个。数字是我们的建议：官方没给数字（2.7），社区只说「每个词要有用」「一个人一个动作」。

要不要再加「机位 / 角度」（`from above`、`from below`、`dutch angle`）：自拍常见俯拍，但这类 tag 会连带改变姿势（社区记录过 `from below` 配某些 tag 时人几乎躺倒），**第一版不开放**，以后看日志再说。

### 5.2 服务器写死、不让 LLM 碰的

拼好的正面大致是：

```
1girl, solo, <角色 tag>, idolmaster shiny colors, <外貌 tag（待票 05 定）>,
<拍法 tag>, <景别 tag>, <地点和时间>, <服装>, <动作和表情>,
rating:general, very aesthetic, masterpiece, no text
<自拍时：防手机的负权重行（可选）>
```

- 人数和 `solo`、角色 tag、作品 tag、外貌 tag。
- 拍法和景别对应的 tag（3.4、5.1）。
- 默认视线 `looking at viewer`（3.4）。
- `rating:general`、质量 tag（V5 用 Standard 那串，模型换 V4.5 Curated 时照官方预设改）。
- 负面：`nsfw,` 加 Human Focus 预设，再加全年龄黑名单（票 06）。
- 所有语法字符的清洗、小写、去重、每栏截断、外貌和越界黑名单（4.1、4.2）。
- 不加复杂度 tag、不加画师 tag、不加 `photo (medium)` / `photo background`。

### 5.3 写进系统提示词的规则（草稿要点）

给扮演角色的 LLM 的说明里，建议只放这些（短）：
- 每栏写英文小写的 Danbooru tag，逗号分隔，不写句子、不写引号和括号。
- 只写照片里看得见的东西；不写发色、瞳色、发型、身材、年龄。
- 一张照片只有一个动作、一套衣服。
- 每栏给 3–5 个正例（取自白名单，如 `cafe, indoors, sunlight`；`hoodie, white shirt`；`sitting, holding cup, smile`），外加 4.1 表里的几组「不要这样写 → 要这样写」。
- 拍法、景别从固定选项里选。

### 5.4 交给其他票的

- **票 05（外貌一致性）**：本次 8 张只写了 `sakuragi mano` 和作品 tag，没写外貌，发色、瞳色、发型都对；社区（novelai-assistant）实测说版权角色再叠外貌 tag 会「特征权重翻倍、和名字打架」，nai5-prompting 也主张版权角色只写规范名。所以「服务器拼外貌 tag」不一定是加分项，**对比时要包括「只写名字」这一档**，冷门角色再看要不要补外貌。另一个可选项：把她的 tag 放进 `char_captions`（官方说角色提示框能减少特征串到背景里），单人图有没有好处没测。
- **票 06（全年龄守卫）**：`rating:general` 加 `nsfw` 之后仍有 2/8 张露出吊带。候选：负面加 `bra strap, strap slip, cleavage, see-through, underwear`（这些在 V5 tag 表里都存在），服装栏黑名单挡掉泳装、内衣、睡衣以外的贴身衣物等；tag 建议接口本身会建议越界 tag，不能拿它当过滤器。

---

## 查不到或没核实的

- `|`、引号、`Text:` 是网页前端解析的还是服务端也解析：官方没写。建议一律剥掉，所以不影响实现。
- tag 建议接口返回的 `count`、`confidence` 的确切含义和接口限速：官方没写。
- V4 以后 tag 顺序到底影响多大：官方只说「可能」「要紧的放前半段」。
- 「别人帮她拍」、`depth of field` 照片感、全身和外景的自拍、拿着东西的自拍：没出图验证。
- 自拍时加防手机负权重会不会削弱构图：只有 D 写法 2 张，没看出削弱，样本不够。
- V4.5 上自拍的表现：没测（只确认了 tag 存在与否）。
- 官方关于「每个提示词写几个 tag 合适」的建议：没有。
- 社区关于 V4.5 / V5「自拍出现第二部手机、多出来的手」的系统性经验：没找到，只有本次 8 张实测。
