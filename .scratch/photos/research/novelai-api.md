# 调研：NovelAI 官方图像 API 现状（2026-10）

对应票：`.scratch/photos/issues/01-novelai-api-research.md`。调研日期 2026-10-17。

来源标记：
- **【官方文档】** docs.novelai.net。
- **【官方博客】** journal.novelai.net（原 blog.novelai.net）。
- **【官方规格】** image.novelai.net 和 api.novelai.net 自带的 Swagger/OpenAPI（`https://image.novelai.net/docs/doc.json`、`https://api.novelai.net/docs-json`）。
- **【官方条款】** <https://novelai.net/terms>（页面写 Effective: December 8th, 2025）。
- **【官方客户端】** 2026-10-17 从 <https://novelai.net/image> 抓下来的前端 JS（Next.js build `TfctsWXpff2fKS`），从压缩代码里读出来的。这是官方自己的实现，比社区库可信，但不是文档承诺，随时可能改；chunk 文件名每次部署都会变，下文给的文件名只对这一版有效。
- **【社区】** 第三方库或第三方讨论，只作佐证。
- **【实测】** 本次不带 token 直接请求的结果（没有花任何 Anlas）。

---

## 对决策最要紧的几条

1. **最新模型是 NovelAI Diffusion V5**（2026-08-21 发布），分 Curated 和 Full 两种；2026-10-08 起 Full 多了一个「Medium」档。API 模型名：`nai-diffusion-5-curated`、`nai-diffusion-5-full`、`nai-diffusion-5-full-medium`（各自另有 `-inpainting` 版本）。V4.5（`nai-diffusion-4-5-curated` / `-full`）、V4、V3 都还在用，没有下线。官方文档里**没写**模型名，模型名出自官方客户端代码。【官方文档】【官方博客】【官方客户端】
2. **接入点**是 `POST https://image.novelai.net/ai/generate-image`，鉴权用 `Authorization: Bearer pst-…`（持久 API token，在 novelai.net 设置里点「Get Persistent API Token」拿；同一时间只能有一个，新建一个旧的就失效）。请求体 `{input, model, action, parameters}`；V4 以后的模型，正文提示词放在 `parameters.v4_prompt.caption.base_caption`，负面放在 `v4_negative_prompt`，多角色放在 `char_captions[]`。返回一个 zip，里面是 `image_0.png` 或 `.webp`；另外有流式接口。【官方规格】【官方客户端】
3. **Opus 不花 Anlas 的条件**：Opus 订阅有效，`width*height ≤ 1048576`（也就是 1024×1024 以内），`steps ≤ 28`，没有用角色参考图，一次请求里只有 1 张免费。**V5 另外受「Opus 用量条」限制**：免费的 V5 生成要从用量条里扣，100% 大约 1730 张（23 步、1MP），每天回 11% 到 14%，大约 7 天从空回满；条扣成负数之后改扣 Anlas。V4.5 及更早的模型仍然不限张数。【官方文档】【官方博客】【官方客户端】
4. **花钱的时候按什么算**（官方客户端公式）：832×1216、23 步，V4.5 每张 17 Anlas，V5 每张 26 Anlas（V5 乘了 1.5），V5 Medium（14 步）每张 17 Anlas。官方给的参考价是 10,000 Anlas 约等于 14 美元，折下来 V5 一张大约 0.036 美元。用角色参考图每张另加 5 Anlas，而且这张图就不算 Opus 免费了。【官方客户端】【官方文档】【官方博客】
5. **并发**：官方文档没写数字。官方 2023-12 的公告说，免费生成按账号限速，并且会强制「同时只能生成一张」，第三方客户端也绕不过去；官方网页客户端自己也会拦，正在生成时再点会提示「Already generating an image」。社区报告同一账号并发时返回 429。**按一个账号同一时间只跑一张来设计，在我们这边排队。**【官方公告（X）】【官方客户端】【社区】
6. **条款不允许把一个订阅拿来给公众共用**。ToS 明确禁止：「让第三方远程访问账号」（5.3.2）、「把账号放在公开域名上」（5.3.1）、「出租、出售、转授权」（5.3.5、9.1.2）、「让他人用你的账号信息使用服务」（9.1.3）、「分享账号信息」（8.1）；只在「Unless permitted / Unless expressively allowed and agreed」时例外，也就是要和 Anlatan 另签书面协议。官方 API 文档的说法是「第三方应用要向**用户**要他自己的持久 token」，**这正好是「用户自带 key」的模式**。地图里写的「部署者那一侧可能只剩中转」需要回头重议。【官方条款】【官方规格】
7. **用户自带 token 是官方认可的接入方式**，前提是：每次生成都由人发起（API 文档原话：all generation requests must be initiated by a human action），不能自动化刷量（9.1.6），token 的主人必须年满 18 岁（5.2）。我们是用户明确要照片时才生成，符合要求。【官方规格】【官方条款】
8. **官方服务端没有内容过滤，也没有安全开关可以设**。官方给的只是：Curated 模型训练集「更干净」，是「避免意外生成敏感图、直播时最安全的选择」；官方网页客户端对 **Full** 模型会自动在负面提示词最前面加 `nsfw`（Curated 不加，因为客户端把 Curated 列为 `safeModels`）。全年龄只能靠我们自己守：建议用 Curated，正面加 `rating:general`，负面加 `nsfw` 再叠官方 UC 预设，并且在提示词生成之前就把越界请求拦下来。【官方文档】【官方客户端】
9. **没有官方 SDK**。社区的 `novelai-python` 主线最后一次发版是 2025-06，作者已声明「non-active」，V5 支持还在 2026-10-16 才开的、尚未合并的 PR #131 里；`Aedial/novelai-api` 停在 2025-06，不支持 V5。**建议直接发 HTTP**（项目已经是 Python + httpx 风格），社区库只当接口细节的参考。【社区】
10. **闪耀色彩角色和作品 tag 模型都认识**：`sakuragi mano`、`serizawa asahi`、`morino rinze`、`hachimiya meguru`、`ikaruga luca`、`suzuki hana`、`nanakusa nichika`、`aketa mikoto`，以及作品 tag `idolmaster shiny colors`，都在 V5 和 V4.5 的 tag 建议接口里作为已知 tag 出现（实测）。写法是 Danbooru 风格：小写、下划线换成空格，顺序按官方建议「1girl, 角色, 作品, 其他」。官方没有写训练数据里有哪些角色。【实测】【官方文档】

---

## 1. 模型

### 1.1 现有模型【官方文档】

来源：<https://docs.novelai.net/en/image/models>

| 模型 | 状态 | 要点 |
|---|---|---|
| NovelAI Diffusion V5 Full | 当前，最新 | 训练集更全、筛选更少；提示词上限约 1471 个有效 token，文字渲染另外约 750 个；V5 的免费生成受 Opus 用量条限制 |
| NovelAI Diffusion V5 Curated | 当前，最新 | 训练集更小、更干净；「great for general use, and if you want to make extra sure you don't generate any sensitive images on accident. It's the safest choice when streaming video!」；约 703 个有效 token，文字渲染约 374 个 |
| V4.5 Full / V4.5 Curated | 当前（上一代） | T5 分词，约 512 个 token；**不支持大部分 Unicode（日文、emoji）**；Opus 免费不限张数 |
| V4 Full / V4 Curated | 当前（更早） | 同上，约 512 个 T5 token |
| Anime V3 / Furry V3 | 当前（SDXL 系） | 基础分辨率 832×1216 |
| Anime V2、Furry Beta V1.3、Anime V1 Curated/Full | **已下线**（模型列表里不再出现），权重已开源 | — |

V5 的新东西（【官方博客】<https://journal.novelai.net/image-generation-novelai-diffusion-v5-is-here-c2df7c6b8d2d/>，2026-08-21）：自研架构，大小是 V4.5 的两倍多；32 通道 VAE；自然语言理解更好；**官方支持英文和日文提示词**（中文、德文等能用，但不是训练重点）；alpha 透明；多角色最多 22 个（文档写法），角色可以自由摆位；更好地渲染英、日、中文字；能一张出整页漫画。发布时**没有** Precise Reference（角色参考）、Vibe Transfer，Curated 的局部重绘暂用 V4.5 的。

V5 Full 的 Effort 档位（【官方博客】<https://journal.novelai.net/novelai-diffusion-v5-full-effort-toggle/>，2026-10-08；【官方文档】<https://docs.novelai.net/en/image/effort>）：
- High：就是原来的 V5 Full。
- Medium：蒸馏模型，**步数固定 14，采样器固定 Euler Ancestral，不能自定义负面提示词，也不能换 UC 预设**，能调 Prompt Guidance，但不能调 Rescale。官方说在默认设置下比 High 23 步「省约 42% 的用量」，盲测质量相当。想在 Medium 上排除什么，官方建议在正面里用负权重，例如 `-3::hat::`。
- 只有 V5 Full（及其局部重绘）有 Medium 档。

### 1.2 API 模型名【官方客户端】【社区】

官方文档和 Swagger 都没列模型枚举（image.novelai.net 的 `ImageGenerationRequest.model` 只写了 `type: string`）。下面这些出自官方客户端 chunk `1kcqqvyilqyxf.js`（模型能力表 `getModelSupportInfo`），社区库 `novelai-python` 的 `v5-update` 分支（`src/novelai_python/sdk/ai/_enum.py`）与之一致：

| 模型名 | 说明 |
|---|---|
| `nai-diffusion-5-full` / `nai-diffusion-5-full-inpainting` | V5 Full（High） |
| `nai-diffusion-5-full-medium` / `nai-diffusion-5-full-medium-inpainting` | V5 Full Medium |
| `nai-diffusion-5-curated` / `nai-diffusion-5-curated-inpainting` | V5 Curated |
| `nai-diffusion-4-5-full` / `nai-diffusion-4-5-curated`（以及 `-inpainting`） | V4.5 |
| `nai-diffusion-4-full`、`nai-diffusion-4-curated-preview` | V4 |
| `nai-diffusion-3`、`nai-diffusion-furry-3` | V3 |

### 1.3 各模型能做什么（官方客户端能力表，2026-10-17 这一版）

| 能力 | V5（Curated / Full） | V4.5 |
|---|---|---|
| 多角色提示词（`characterPrompts`） | 有，客户端上限 32 | 有，上限 6 |
| 自由摆位（`freeformCharacterPosition`） | 有 | 没有（5×5 网格） |
| 角色参考图（`characterReferences`） | **没有** | 有 |
| Vibe Transfer | **没有** | 有 |
| 透明背景 | 有 | 没有 |
| 可选噪声计划 | 没有 | 有（native 以外的几种） |
| `opusUsageLimit` | **是** | 否 |
| 流式返回 | 有 | 有 |

官方文档的 Precise Reference 页也写着「Precise Reference is only available on our V4.5 models」（<https://docs.novelai.net/en/image/precisereference>），和客户端一致。**结论：想靠角色参考图稳住外貌，目前只能用 V4.5**；V5 只能靠角色 tag 加外貌描述。

### 1.4 默认参数【官方客户端】

客户端 `getModelDefaultParams`：

| 参数 | V5（Curated / Full） | V5 Full Medium | V4.5 |
|---|---|---|---|
| `params_version` | 4 | 4 | 4 |
| `width` × `height` | 832 × 1216 | 同 V5 | 832 × 1216 |
| `scale`（Prompt Guidance） | 7 | 7 | 5 |
| `sampler` | `k_euler_ancestral` | 固定 `k_euler_ancestral` | `k_euler_ancestral` |
| `steps` | 23 | 固定 14 | 23 |
| `n_samples` | 1 | 1 | 1 |
| `cfg_rescale` | 0 | 不支持 | 0 |
| `noise_schedule` | 由采样器决定（Euler 系是 `karras`） | 同 | 同 |
| `ucPresetId` / `qualityPresetId` | 默认 `heavy` / `standard` | `heavy` 固定 | 同 |

采样器的取值（客户端枚举）：`k_euler`、`k_euler_ancestral`、`k_dpmpp_2s_ancestral`、`k_dpmpp_2m`、`k_dpmpp_sde`、`k_dpmpp_2m_sde`、`ddim_v3` 等。官方文档推荐 DPM++ 2M 和 Euler Ancestral（<https://docs.novelai.net/en/image/sampling>）；V3 以后的模型 Guidance 建议 5 到 6（<https://docs.novelai.net/en/image/stepsguidance>）。

---

## 2. 接入点和鉴权

### 2.1 三套 API【官方规格】

image.novelai.net 的 Swagger 描述原文（<https://image.novelai.net/docs/index.html>，规格在 `https://image.novelai.net/docs/doc.json`）：

> Currently, you have access to three APIs: Primary NovelAI API: https://api.novelai.net/docs/ · Image Generation API: https://image.novelai.net/docs/index.html · Text Generation API: https://text.novelai.net/docs/index.html
>
> When building applications that leverage the NovelAI API, you need to request a user's Persistent API token for integration and use it in the Authorization header. … All API users must adhere to the NovelAI Terms of Service.

**生图用 image.novelai.net**。api.novelai.net 上也还挂着一个 `/ai/generate-image`，但它的 `model` 枚举只到 `nai-diffusion-3`，属于旧接口（<https://api.novelai.net/docs-json>）。官方客户端的生图地址也是 `https://image.novelai.net/ai/generate-image` 和 `/ai/generate-image-stream`（chunk `2rdp03_8cyuh_.js`）。

### 2.2 image.novelai.net 上和生图有关的接口【官方规格】

| 方法和路径 | 用途 |
|---|---|
| `POST /ai/generate-image` | 生图，返回 zip（或 `Accept: application/json` 时返回 base64 的 JSON） |
| `POST /ai/generate-image-stream` | 流式生图 |
| `POST /ai/encode-vibe` | 把图编码成 vibe（V4/V4.5 用） |
| `POST /ai/upscale`、`POST /ai/augment-image` | 放大、图像工具 |
| `GET /ai/generate-image/suggest-tags` | tag 建议（实测不带 token 也能调） |
| `GET /user/subscription` | 订阅档位、到期时间、Anlas 余额、Opus 用量条 |
| `GET /user/priority` | 任务优先级余额 |
| `POST /user/create-persistent-token` | 创建持久 token |

### 2.3 鉴权【官方规格】【官方客户端】

- 请求头：`Authorization: Bearer <token>`。Swagger 里 `POST /user/create-persistent-token` 的描述：「Creates a persistent access token (PAT) … which can be used as a long-lived API key via `Authorization: Bearer pst-<token>`. Requires JWT authentication; a request authenticated via an existing PAT is rejected. If a token already exists and overwrite is not set, returns 409.」
- 用户怎么拿：网页设置里有「Get Persistent API Token」按钮。客户端文案：「Note: You can only have a single persistent token at a time. Creating a new one will invalidate the old one. You will not be able to view this token again after closing this window.」（chunk `1kcqqvyilqyxf.js` 的本地化字符串）
- 可选请求头：`x-correlation-id`（6 位字母数字，出 500 时可以报给官方）。官方客户端还会带 `x-initiated-at`（ISO 时间）。

### 2.4 请求编码：JSON 还是 multipart【官方规格】【官方客户端】【社区】

- Swagger 写的请求体是 JSON（`in: body`，`image.ImageGenerationRequest`）。
- 官方客户端现在默认发 `multipart/form-data`：JSON 放在名为 `request` 的 part 里，图片（img2img、mask、参考图）作为单独的 blob part；同时保留一个调试开关 `debugLegacyImageGenRequest`，打开后改发 `Content-Type: application/json`（chunk `0wi7fejx317_y.js` 里的 `t8` 函数）。客户端还有一套图片缓存：参数里带 `image_cache_secret_key` 之类，命中缓存就不重传图片；服务端返回 400 `INVALID_CACHE_KEYS` 时再补传。
- **我们只做文生图、不传图片，直接发 JSON 就行**。社区库 PR #131 也保留了 JSON 路径（`test_legacy_params_version_3_sends_json`）。V5 用 JSON 能不能成功，本次没有 token，**没能实测**；中转那边要实测。

---

## 3. 请求体

### 3.1 顶层【官方规格】

```json
{
  "input": "<正面提示词，带质量标签后缀>",
  "model": "nai-diffusion-5-curated",
  "action": "generate",
  "parameters": { … }
}
```

`action` 取值是 `generate` / `img2img` / `infill`（api.novelai.net 规格的枚举，image.novelai.net 规格只写了 string）。

### 3.2 `parameters` 的字段【官方规格】

image.novelai.net 规格里 `image.RequestParameters` 列出的字段（原样）：`add_original_image, cfg_rescale, color_correct, controlnet_condition, controlnet_model, controlnet_strength, deliberate_euler_ancestral_bug, director_reference_descriptions, director_reference_images, director_reference_information_extracted, director_reference_secondary_strength_values, director_reference_strength_values, dynamic_thresholding, extra_noise_seed, height, image, image_format (png|webp), img2img, legacy, legacy_v3_extend, mask, n_samples, negative_prompt, noise, noise_schedule, params_version, prefer_brownian, prompt, qualityToggle, reference_image, reference_image_multiple, reference_information_extracted(_multiple), reference_strength(_multiple), sampler, scale, seed, skip_cfg_above_sigma, sm, sm_dyn, steps, straight_alpha, stream (msgpack|sse), strength, tag_hint_qt, tag_hint_transparent_background, tag_hint_uc_preset, ucPreset, upscale, upscaled_enhance, v4_negative_prompt, v4_prompt, width`。

几个字段的官方说明：
- `skip_cfg_above_sigma`：「(Summer Sampler update) triggers Variety Boost」。
- `deliberate_euler_ancestral_bug`：默认 true，保持旧行为。
- `director_reference_*`：角色参考（CR）用。`director_reference_images` 要求 1024×1536、1536×1024 或 1472×1472，不够的部分补黑边；`director_reference_descriptions[].caption.base_caption` 填 `"character"` 或 `"character&style"`；`director_reference_strength_values` 0 到 1；`director_reference_secondary_strength_values` 对应 Fidelity 滑块，0 到 1。
- **规格和官方客户端有出入**：客户端现在发的是 `ucPresetId`（字符串，如 `"heavy"`）和 `qualityPresetId`（如 `"standard"`），不再发规格里的整数 `ucPreset`/`qualityToggle`；还会发 `use_coords`、`legacy_uc`、`normalize_reference_strength_multiple`、`characterPrompts`、`autoSmea`、`inpaintImg2ImgStrength` 这些规格里没有的字段（社区库测试 `WEB_CLIENT_V5_KEYS` 记录了 V5 实际发出的完整字段集）。服务端还认不认旧的整数字段，**查不到**。

### 3.3 V4 及以后的提示词结构【官方规格】【官方客户端】

规格：`v4_prompt` / `v4_negative_prompt` 都是 `V4ConditionInput = {caption: {base_caption, char_captions: [{char_caption, centers: [{x, y}]}]}, use_coords, use_order, legacy_uc}`。

官方客户端怎么填（chunk `42wv5qb9evl5c.js`，`buildNormalGenerationParams` 附近）：
- `v4_prompt.caption.base_caption` = 加过质量标签的正面提示词（和顶层 `input` 相同）。
- `v4_prompt.caption.char_captions` = 每个角色提示词一项，`centers` 是 0 到 1 的坐标（V5 自由摆位，V4/V4.5 吸附到 5×5 网格）。
- `v4_prompt.use_coords` = 用户是否手动摆位（默认 false），`v4_prompt.use_order = true`。
- `v4_negative_prompt.caption.base_caption` = 负面提示词（含 UC 预设），`char_captions` 是每个角色的负面，`legacy_uc = false`。
- 顶层 `negative_prompt` 也带同样的负面提示词。

客户端里内嵌的一份 V5 示例（chunk `436sreshl2bl8.js`，原样节选）：

```json
"v4_prompt": {"caption": {"base_caption": "1girl, cloud, contrail, wind, looking afar, light blue eye, location, very aesthetic, masterpiece, no text",
  "char_captions": [{"char_caption": "girl, pink hair", "centers": [{"x": 0.5, "y": 0.5}]}]},
  "use_coords": false, "use_order": true, "legacy_uc": false},
"v4_negative_prompt": {"caption": {"base_caption": "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page",
  "char_captions": [{"char_caption": "", "centers": [{"x": 0.5, "y": 0.5}]}]},
  "use_coords": false, "use_order": false, "legacy_uc": false}
```

多角色的官方写法（<https://docs.novelai.net/en/image/multiplecharacters>）：人数 tag（`1girl`、`2girls`）放在 base prompt；角色提示词里只写 `girl`/`boy`/`other`，不写数字。我们只拍她一个人：可以只用 base_caption，也可以 base 写场景、一个 char_caption 写她，这样外貌描述不容易串到背景里。

### 3.4 质量标签和 UC 预设【官方文档】【官方客户端】

质量标签开关（`qualityPresetId`）会在正面**末尾**加一段（<https://docs.novelai.net/en/image/qualitytags>；客户端 `qualityPresetsForModel` 一致）：

| 模型 | standard | light |
|---|---|---|
| V5 Full / Curated | `, very aesthetic, masterpiece, no text` | `, very aesthetic, amazing quality, no text` |
| V4.5 Full | `, very aesthetic, masterpiece, no text`（文档另多一个 `location`） | — |
| V4.5 Curated | `, very aesthetic, masterpiece, no text, -0.8::feet::, rating:general`（文档版本略有不同） | — |

客户端是在发请求之前把后缀拼进 `input` 和 `base_caption` 的；`tag_hint_qt` 只是告诉服务端用了哪个预设。**直接调 API 时要自己拼。**

UC 预设（<https://docs.novelai.net/en/image/undesiredcontent>），V5 Full 和 V5 Curated 相同：
- Heavy：`lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page`
- Light：`lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, very displeasing, jpeg artifacts, 0::ai-generated::`
- Human Focus：Heavy 再加 `@_@, mismatched pupils, glowing eyes, bad anatomy`

**客户端会自动在负面前面加 `nsfw`**（chunk `1kcqqvyilqyxf.js`，`solveUc`）：条件是模型不在 `safeModels` 里、UC 预设不是 none、用户正面里没写 "nsfw"。`safeModels` 就是各个 Curated 模型（V4 Curated Preview、V4.5 Curated、V5 Curated 及其局部重绘）。也就是说，官方网页上用 Full 模型时，负面实际是 `nsfw, lowres, …`；社区库测试里抓到的 V5 Full Heavy UC 也是这一串。

### 3.5 尺寸、步数、种子【官方文档】【官方客户端】

- 尺寸：默认 832×1216（竖图）。Opus 免费上限是像素数 ≤ 1048576（见第 5 节）。尺寸要按模型的最小倍数对齐（客户端 `getModelMinimumSizeMultiple`，常见是 64）。
- 步数：默认 23，Opus 免费上限 28；V5 Medium 固定 14。
- 种子：`seed` 是整数，社区库的上限是 `4294967295 - 7`。同种子同设置也不保证每次完全一样（采样器非确定，<https://docs.novelai.net/en/image/seed>）。
- `n_samples`：默认 1。Opus 免费只覆盖其中 1 张。

---

## 4. 返回格式、错误、限流

### 4.1 返回【官方规格】【官方客户端】

- `POST /ai/generate-image`：`produces: application/zip, application/json`。客户端把返回体当 zip 解开，取 `image_` 开头、`.png` 或 `.webp` 结尾的文件（chunk `0wi7fejx317_y.js`）；格式由 `image_format` 决定（`png` | `webp`），社区库抓到的 V4.5 网页请求用的是 webp。规格还写了：发 `Accept: application/json` 时返回 201 和 `{"images": [{"image": "<base64>", "index": 0, "seed": 123}]}`。
- `POST /ai/generate-image-stream`：规格写的是 SSE，事件分 intermediate / final / error；`parameters.stream` 可以选 `msgpack` 或 `sse`。官方客户端用 `msgpack`：每帧 4 字节大端长度加一个 msgpack map（`event_type`、`samp_ix`、`step_ix`、`image`）。我们只要最终图，用非流式更简单。
- 客户端请求超时设的是 120 秒（`fetchWithTimeout(…, 12e4)`）。
- **生成的图里带元数据**：官方仓库 <https://github.com/NovelAI/novelai-image-metadata> 说明，提示词和设置以 stealth pnginfo 的形式写在 alpha 通道里，另有普通 PNG 元数据和一个用来验证「是 NovelAI 模型生成的」签名（`signed_hash`）。把原图直接发给用户，就会连我们拼的提示词一起发出去；转码（例如去掉 alpha 的 WebP/JPEG）可以去掉。

### 4.2 错误【官方规格】【实测】【社区】

- 错误体：`{"statusCode": 401, "message": "Unauthorized"}`（规格 `utils.JsonError`；【实测】带无效 token 或不带 token 请求 `/ai/generate-image`，返回的就是这一串）。
- 规格里列的状态码：image.novelai.net 只列了 201、401、500；api.novelai.net 的同名接口列了 400（参数校验）、401、402（「An active subscription is required」）、409、500。
- 400 `INVALID_CACHE_KEYS`：只在用图片缓存时出现（官方客户端）。
- 402：社区库注释写的是 Anlas 不够（`novelai-python` 的 `upscale.py`：「402: not enough Anlas」）。
- 429：社区库把它当作「并发生成被锁」（`ConcurrentGenerationError`）；SillyTavern 的 issue 里报错原文是「concurrent generation is locked」（<https://github.com/SillyTavern/SillyTavern/issues/2759>，那个是文本生成）。**官方没有文档说明 429 的格式，也没说有没有 Retry-After。**

---

## 5. 费用

### 5.1 订阅档和 Anlas【官方文档】【官方博客】

来源：<https://docs.novelai.net/en/subscription>、<https://journal.novelai.net/opus-usage-limit-explained/>

- Tablet 10 美元/月、Scroll 15 美元/月：每月 1000 订阅 Anlas。Opus 25 美元/月：每月 10,000 订阅 Anlas，外加「免费生成」。官方说「the 10,000 Anlas bundled with it would cost $14 on their own」。
- 订阅 Anlas 每次续费补满到档位额度，不叠加；买来的 Anlas 不过期，订阅 Anlas 先扣。2026-09-22 起订阅一结束，剩余订阅 Anlas 立刻清零（<https://journal.novelai.net/anlas-policy-change/>）。
- 每个身份只能有一个有效订阅（Opus 用量 FAQ：「Our system limits each identity to one active subscription」）。
- 免费试用（Paper）：验证过邮箱的账号有 30 次 1024×1024 以内的免费生图。

### 5.2 Opus 免费生成的确切条件

文档原文（Opus Tier 一节）：「generate images free of Anlas cost, as long as they're generated one at a time, without any other image used as a base, are at least "Normal Sized", and have a "Steps" value of 28 or less. When using a model higher than V4.5, going over your usage limit will make all images cost Anlas until your limit refills.」同页脚注是「For images of up to 1024x1024 pixels and up to 28 steps when generating a single image」。正文里的「at least」和脚注、其他页（「stays under the normal threshold」）矛盾，应该是笔误。

官方客户端的判断（chunk `1kcqqvyilqyxf.js` 的 `imageIsOpusFree`，加上 chunk `33ul2lw58_w11.js` 的 `checkStableDiffusionPrice`）：

```js
function imageIsOpusFree(p){ return !p.characterRef && p.width*p.height <= 1048576 && p.steps <= 28 }
// 计价时：imageIsOpusFree && tier>=3（Opus）&& 订阅有效 && !(该模型受用量条限制 && usage.isNegative) → n_samples 减 1
```

所以：Opus、≤1048576 像素、≤28 步、没有角色参考图、只算 1 张；V5 另外要求用量条没有扣成负数。img2img、局部重绘按客户端公式会乘以 strength 来计价；文档说「without any other image used as a base」才免费，客户端的判断里没体现这一条，以文档为准。

### 5.3 V5 的 Opus 用量条【官方博客】【官方文档】

来源：<https://journal.novelai.net/subscription-updates-usage-limits-2025-88a208d5d9c5/>（2026-08-20）、<https://journal.novelai.net/opus-usage-limit-explained/>（2026-09-15）、<https://docs.novelai.net/en/faq>（Opus Usage Limits 一节）

- 只对 **V5** 生效；「all other models will remain unaffected with unlimited generations」。只有不花 Anlas 的那部分（普通尺寸、≤28 步）从用量条扣；本来就要花 Anlas 的生成不扣用量条。
- 每张扣多少按它「本来要花的 Anlas」折算，所以分辨率和步数越小扣得越少；官方说降分辨率比降步数更省。
- 容量：100% 约 1730 张（23 步、1MP）；约 17 张/1%（客户端 `usageImagesForPercent = 17.3 × percent`）；每月约 7000 张。
- 回充：连续回充，不按天重置；新订阅第一个月约 11%/天，之后约 14%/天，空到满 7 到 9 天。续费不会瞬间回满。
- 扣到负数之后：用订阅 Anlas 或买来的 Anlas 继续生成；「Anlas generations are processed at the highest priority」。
- 2026-10-13 起可以买 Usage Boost：5.99 美元加 100%，Extra Usage 条最多 400%（<https://journal.novelai.net/novelai-diffusion-v5-opus-usage-boost/>）。
- 查用量：`GET /user/subscription` 返回里的 `usage = {isNegative, percent, purchasedPercent, timeUntilNextPercent}`（规格 `usagelimit.Status`：`isNegative`「if true, its unavailable」，`percent` 0 到 100+，`purchasedPercent` 0 到 300）。

### 5.4 花 Anlas 时的计价公式【官方客户端】

chunk `33ul2lw58_w11.js` 的 `checkStableDiffusionPrice`，V3/V4/V4.5/V5 这一支：

```js
pixels = width*height  // 小于 65536 按 65536 算
perImage = ceil(2.951823174884865e-6*pixels + 5.753298233447344e-7*pixels*steps*f) * (smea_dyn ? 1.4 : smea ? 1.2 : 1)
//   f：V5 Full Medium 为 1/1.06521739，其余为 1
if (V5) perImage *= 1.5
perImage = max(ceil(perImage * strength), 2)   // strength：文生图为 1
if (perImage > 140) → 不允许（ANLAS_MAX = 140）
total = perImage * (n_samples - Opus 免费那 1 张)
```

用这个公式算出来的例子（单张）：

| 设置 | Anlas |
|---|---|
| V4.5，832×1216，23 步 | 17 |
| V4.5，832×1216，28 步 | 20 |
| V5，832×1216，23 步 | 26 |
| V5，832×1216，28 步 | 30 |
| V5 Medium，832×1216，14 步 | 17 |
| V5，1024×1536，23 步 | 39 |
| V5，640×640，23 步 | 11 |

按「10,000 Anlas ≈ 14 美元」折算，V5 默认设置一张约 0.036 美元，V4.5 约 0.024 美元。官方说 Medium 比 High 23 步省约 42%，用这个公式只算出省约 35%，两者对不上，**以实际扣费为准**。

其他加价（【官方文档】）：
- Precise Reference（角色参考）：每个参考每张图加 5 Anlas，而且用了它就不算 Opus 免费（客户端 `!p.characterRef`）。
- Vibe Transfer：编码一次 2 Anlas；超过 4 个 vibe，每多一个加 2 Anlas（客户端 `vtAdditionalPrice = 2*max(0, n-4)`）。

### 5.5 查余额【官方规格】【官方客户端】

`GET https://image.novelai.net/user/subscription`：
- `tier`：0 Paper、1 Tablet、2 Scroll、3 Opus（客户端用 `tier >= 3` 判断 Opus；api.novelai.net 的换档接口枚举是 0 到 3）。
- `active`、`expiresAt`（Unix 秒）。
- Anlas 余额 = `trainingStepsLeft.fixedTrainingStepsLeft`（订阅 Anlas）加 `trainingStepsLeft.purchasedTrainingSteps`（买来的 Anlas）。字段名沿用了当年「模块训练步数」的叫法，客户端购买页把这两个字段分别显示成「Your Subscription Anlas」和「Your Paid Anlas」。
- `usage`：见 5.3。

官方客户端里还有一个 `GenerateImagePrice` 地址（`https://api.novelai.net/ai/generate-image/request-price`），但 api.novelai.net 的规格里没有这个接口，**没有文档，不建议依赖**。

---

## 6. 并发

- **官方文档和规格都没写并发上限。**
- 官方公告（NovelAI 官方 X 账号，2023-12-08，<https://x.com/novelaiofficial/status/1733120947698188771>；本次 X 页面打不开，文字取自搜索引擎收录的全文）：「we have implemented account-based rate limits on free image generations」「Limits to the concurrent generation of free images can no longer be circumvented through third-party clients, unfortunately affecting the simultaneous generation of multiple images in separate tabs」，并重申 ToS 禁止用自动化绕过限制。
- 官方客户端：正在生成时再点生成，会直接弹「Already generating an image」（chunk `42wv5qb9evl5c.js`）。
- 社区：同一账号并发会返回 429（PyPI `novelai` 包说明 <https://pypi.org/project/novelai/>：「by default, NovelAI only allows one concurrent generating task at a time」，旧版本靠同时打两个后端绕过，「deprecated … starting from Mar 21, 2024」之后就不行了）。
- 官方 FAQ：用 Anlas 生成的请求优先级最高；`GET /user/priority` 能看任务优先级余额（`maxPriorityActions`、`nextRefillAt`、`taskPriority`），规格里没解释优先级怎么影响排队。

**对设计的含义**：同一个 token 同一时间只发一张。自带 token 的用户本来就是一人一个 token；部署者那一侧如果走中转，中转自己怎么排队，要实测。

---

## 7. 内容和全年龄

- **官方服务端没有内容过滤，也没有可以设的安全开关。** 规格的请求参数里没有任何 safety、filter、rating 之类的字段；官方 FAQ 自称「By using our own trained AI models we offer an unprecedented level of freedom to the user」。
- 官方能给的只有：
  - **Curated 模型**：训练集「cleaner and more focused」，「if you want to make extra sure you don't generate any sensitive images on accident. It's the safest choice when streaming video!」（<https://docs.novelai.net/en/image/models>）。注意它只是「更不容易意外生成」，不是过滤器。
  - **rating tag**：官方 V4.5 Curated 和 V4 Curated 的质量预设里就有 `rating:general`，官方博客示例提示词里也在用（<https://journal.novelai.net/novelai-diffusion-v4-5-full-release-678318c86205/>）。V5 的质量预设里没有它，但 tag 体系是延续的。
  - **网页客户端的负面 `nsfw`**：Full 模型自动在负面最前面加 `nsfw`（见 3.4）。
  - **负权重**：V4.5 起可以在正面写 `-2::nsfw::` 这类负权重（官方博客介绍过负权重的用法，没有专门拿 nsfw 举例）；V5 Medium 不能自定义负面提示词，官方推荐的就是负权重。
- 官方 V4 Curated 的 Heavy UC 里还放过 `gigantic breasts`，说明官方自己也会在负面里压身材相关的 tag，但没有给出全年龄的推荐写法。**查不到官方针对「全年龄」的负面提示词推荐。**
- ToS 本身没有生成内容方面的限制条款（只要求用户年满 18 岁，Explore 社区另有禁止 NSFW 的规则）。

**基于以上事实，全年龄只能我们自己守**（以下是建议，不是官方说法）：
1. 模型优先用 **V5 Curated**（如果要用角色参考图，就用 V4.5 Curated）。
2. 正面固定加 `rating:general`，不让 LLM 写的提示词里出现身材、裸露类 tag（服务端白名单或黑名单过滤）。
3. 负面固定 `nsfw,` 加官方 Heavy 或 Human Focus 预设，再加一组我们自己的禁词；V5 Curated 允许自定义负面。
4. 越界的拒绝放在生成提示词**之前**（她用自己的口吻拒绝），不要指望模型兜底。
5. 有条件的话，生成后再过一道图像审核（本次没调研具体方案）。

---

## 8. 条款

来源：<https://novelai.net/terms>（Effective: December 8th, 2025）。和本项目有关的条款原文：

- **5.1** 「we grant you an account exclusive license … Your subscription lets you access the Services up to one account, on any number of devices.」
- **5.2** 「You must be 18 years or older …」
- **5.3** 「Unless permitted in the Terms, you must not: 5.3.1 Host an account on a publicly available domain; 5.3.2 Allow third parties to access the account remotely; … 5.3.5 Rent, lease, sell, sublicense, assign, or transfer any portion of the account or your rights of the Services in the account.」
- **8.1** 「You are responsible for all activity that occurs via your account … You may not (1) share your account information (except with an authorized account administrator) … or (2) use another person's account.」
- **9.1** 列为 misconduct 的：「9.1.2 Copy, modify, host, sublicense, or resell the Services; 9.1.3 Enable or allow others to use the Services or Software using your account information; 9.1.4 Unless expressively allowed and agreed, you may not access or attempt to access the Services in any unauthorized or unsupported manner; … 9.1.6 Unless expressively allowed and agreed, you may not use of botnets or automated systems in the Services that disrespect the limitations provided by our Service or otherwise place excessive strain on our Services」
- **10.2** 「We may terminate your access to the Services with or without any cause, with or without notice」。
- 生成的内容归用户（1.3、1.4）；FAQ 提醒公开或商用前自己检查有没有侵权。
- API 规格：「According to our Terms of Service, all generation requests must be initiated by a human action. Automating text or image generation to create excessive load on our systems is not allowed.」

**解读：**
- **部署者用自己一个订阅（或它的 token）服务公众，按字面违反 5.3.1、5.3.2、8.1、9.1.3，收费的话还涉及 5.3.5、9.1.2。** 例外只有「permitted in the Terms」或「expressively allowed and agreed」，也就是要和 Anlatan 另签书面协议。本次没找到任何公开的 B2B 或合作项目（官方客户端代码里有一个 `UserType.B2B` 账号类型，说明内部有这种账号，但没有公开入口）；想走这条路只能发邮件问 support@novelai.net。违规的后果是账号被封（9.2、10.2）。
- **用户自带自己的 token 是官方明确设想的接入方式**（API 文档：「request a user's Persistent API token for integration」）。要注意：每次生成都由这个用户本人触发；不替用户批量或自动生成；token 只用于这个用户自己的请求。token 的主人要满足 18 岁这一条，但这是 NovelAI 和它的用户之间的事；我们的站点有未成年偶像角色，跟这条无关。
- **中转**：中转商本身就是把账号给多人共用，对 NovelAI 来说违反 9.1.2 和 9.1.3。这是中转商的风险，不是我们的条款义务，但意味着中转随时可能因为封号断掉、换号。部署者那一侧走中转能不能接受，留给拍板票判断。

---

## 9. 库

| 库 | 来源 | 状态（2026-10-17） | 结论 |
|---|---|---|---|
| 官方 SDK | — | **没有**。NovelAI 的 GitHub 组织（<https://github.com/NovelAI>）只有元数据脚本、分词器、用户脚本示例等，没有 API 客户端 | — |
| `novelai-python`（LlmKira，Apache-2.0，49 星） | <https://github.com/LlmKira/novelai-python> | main 最后一次发版是 `pypi_0.7.12`（2025-06-13），最后一次提交 2025-07-09；README 声明（2025-06-04）作者「non-active」。V5 支持在 **2026-10-16 开的 PR #131（`v5-update` 分支，未合并）**：模型枚举、`params_version 4`、multipart、流式、Opus 用量条、Python 3.12 到 3.14，还自带一个默认「24 小时 2500 张」的本地限额（README 没说依据）| 不建议引入：主线没有 V5，PR 没合并，依赖重（curl_cffi 伪装浏览器指纹等）。**当作接口细节的参考很有用** |
| `novelai-api`（Aedial，MIT，170 星） | <https://github.com/Aedial/novelai-api> | 最后一次提交 2025-06-01（「Add v4.5」），**没有 V5** | 不建议 |

**建议：直接用 httpx 发 JSON。** 我们只用文生图，请求体就是第 3 节那几十个字段；返回一个 zip（或 `Accept: application/json` 拿 base64）；余额和用量一个 GET。自己写比引入一个半停更、还要跟官方客户端字段赛跑的库简单。

---

## 10. 模型认不认识闪耀色彩的角色

- **官方没有公开训练数据里有哪些角色，也没有专门讲角色名 tag 怎么写。** 官方文档只说：
  - tag 建议的圆点透明度表示模型对这个 tag 的熟悉程度（<https://docs.novelai.net/en/image/basics>）；
  - 推荐顺序是「1boy, 1girl, characters, series, everything else in any order」（<https://docs.novelai.net/en/image/tags>）；
  - V4 以后的模型区分大小写，tag 一律小写，用「, 」分隔（FAQ）。
- 官方没说 tag 来自 Danbooru，但写法（小写、空格代替下划线、`角色 (作品)` 消歧义）和 Danbooru 一致。
- **【实测】** `GET https://image.novelai.net/ai/generate-image/suggest-tags?model=<模型>&prompt=<文本>`（不需要 token）：
  - `model=nai-diffusion-5-full` 和 `nai-diffusion-4-5-full` 都把这些作为已知 tag 返回：`sakuragi mano`、`serizawa asahi`、`morino rinze`、`hachimiya meguru`、`ikaruga luca`、`suzuki hana`、`nanakusa nichika`、`aketa mikoto`；作品 tag `idolmaster shiny colors`；还有 `producer (idolmaster shiny colors)`。
  - 输入乱码（`zzqx foobarqu`）时不会原样回显，所以上面这些是词表里真实存在的 tag。只输入前缀 `sakuragi` 时，`sakuragi mano` 也会出现在建议里。
  - 动画版另有 tag，如 `sakuragi mano (anime)`、`morino rinze (anime)`，指 2024 年的动画画风。
  - 返回的 `count`、`confidence` 字段官方没解释（实测完整匹配时 `confidence` 是 0，`count` 好几个都是 10000，像是封顶值），**不能拿来判断模型画得有多像**。「认识到什么程度、衣装能不能对上」只能拿真 token 出图看。
- 外貌稳定性：V5 没有角色参考图，只能靠「角色 tag + 作品 tag + 外貌 tag（发色、发型、瞳色）」来稳住；V4.5 可以加角色参考图（存储桶里有立绘可以当参考），但每张图要多花 5 Anlas，而且不算 Opus 免费。
- V5 支持日文提示词，V4/V4.5 的 T5 不支持日文字符（<https://docs.novelai.net/en/image/models>）。角色 tag 用罗马字就行，不需要日文。

---

## 查不到或没能核实的

- V5 用纯 JSON 请求能不能成功（官方客户端默认发 multipart，规格写 JSON）：没有 token，没能实测。
- 服务端还认不认规格里的整数 `ucPreset`、`qualityToggle`，还是只认 `ucPresetId`、`qualityPresetId`。
- 429 的确切格式、有没有 `Retry-After`、免费生成按账号限速的具体数值。
- V5 什么时候会有 Vibe Transfer 和角色参考图（官方只说「more V5 features will follow」）。
- 官方针对全年龄或防 NSFW 的负面提示词推荐（只有上面那些间接证据）。
- 任何公开的 B2B、商用或合作授权渠道。
- 中转接口和官方的差异（中转不是官方产品，只能实测）。
