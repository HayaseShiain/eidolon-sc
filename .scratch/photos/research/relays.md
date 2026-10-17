# 调研：NovelAI 中转的常见协议

对应地图票 `.scratch/photos/issues/02-relay-research.md`，访问日期统一为 **2026-10-17**。

关于来源：

- **一手来源**：NovelAI 官方 Swagger（`image.novelai.net/docs`）；OpenAI 官方 OpenAPI 规范（`openai/openai-openapi`）；new-api、one-api 的源码；中转平台自己的文档页，以及公开的 `/api/pricing` 接口。
- **单个项目的说法**：社区客户端或插件的 README 和源码，注明「个例」。它们只能说明「至少有这样的中转」，说明不了「有多普遍」。
- **未确认**：一手来源里查不到的内容，统一标出来。
- **普遍程度没有统计数据**。下文说「常见」，意思是这次查到的十几个中转和客户端里反复出现，属于推断。

---

## 对决策最要紧的几条

1. **常见形态有四种**（下文分别叫 A、B、C、D）：
   - **A. 原样转发官方接口**：路径是 `/ai/generate-image`，请求体与官方相同（`input` / `model` / `action` / `parameters`），返回 ZIP。
   - **B. OpenAI images 兼容**：`POST /v1/images/generations`，返回 `data[].b64_json` 或 `data[].url`。
   - **C. OpenAI chat 兼容**：`POST /v1/chat/completions`，图片以 Markdown 图片链接、裸 URL 或 data URI 出现在 `message.content` 里，流式时用 SSE。
   - **D. 各家自定义接口**：异步任务加轮询（TTAPI、IdleCloud、Nai2API 的 jobs），或者 GET 直链（Nai2API 的 `/generate?token=…`）。

   同一个中转常常同时开几种。例如线上的 meinianda.top（定制版 New API）在价格说明里写明「同一参数使用 Chat、OpenAI Images 或 NovelAI 原生格式，计费规则一致」。
2. **请求和返回大致长这样**：
   - **A**：与官方完全相同，Bearer 鉴权，返回 `application/zip`，里面是 PNG。官方还支持 `Accept: application/json`，这时返回 201 和 `{"images":[{"image":"<base64>","index":0,"seed":…}]}`。
   - **B**：`{"model":"nai-diffusion-4-5-full","prompt":"…","size":"832x1216","n":1,"response_format":"b64_json", …NovelAI 参数}`。NovelAI 参数的塞法**没有统一做法**：有的平铺在顶层（`negative_prompt`、`steps`、`scale`、`sampler`、`seed`），有的嵌在 `parameters` 对象里，还有的放进 `extra_fields`。
   - **C**：最后一条 user 消息就是提示词；参数写进各家自定的文本语法（`Parameter{…}`、「提示词:…」逐行字段、JSON 字符串），或者放进自定义的顶层对象。
   - **D**：每家都不一样。
3. **支持 A 和 B 两种，基本就能覆盖「填个地址和 key 就能用」的中转**（推断）。理由如下：
   - A 同时覆盖官方接入点。
   - B 是 New API 系网关和多数 OpenAI 兼容中转的共同语言。
   - C 的参数语法各家不同，通用实现最多只能把提示词送过去，负面词、尺寸、种子都送不到。
   - D 是平台私有协议，只能逐家适配。
4. **B 的返回要宽进**：`b64_json`（有没有 `data:` 前缀都要认）、`url`（可能是绝对地址、相对路径或 data URI），都得能读。已有客户端在 images 端点上还会兼容 chat 形状的返回和 NovelAI 的 SSE 事件，说明真有中转这样返回（个例）。OpenAI 现行规范已经把 `response_format` 标为弃用，GPT image 模型一律返回 `b64_json`，所以中转返回 `b64_json` 还是 `url`，完全看它自己的实现。
5. **开源网关的现状**：
   - **new-api 上游没有 NovelAI 渠道**。相关 issue #2066 已在 2026-05-20 以 not planned 关闭。
   - 它的 images 请求只认固定字段，**非标准的顶层字段在重新序列化时会被丢掉**（源码里合并多余字段的代码被注释掉了）。只有渠道开了请求体透传才会原样转发，而有人报告 rc.38 开了透传仍然被丢（issue #7487，仍是 open）。`extra_fields` 是已知字段，会被原样带过去。
   - one-api 同样没有 NovelAI 渠道，2026-01 以后没有推送；只在做了模型映射时才重新序列化、丢字段。
   - 所以经过 New API 系网关时，**负面词、步数、种子可能被静默丢掉**；能不能送到，取决于上游那层转换器是谁写的。
6. **最常见的坑**：
   - **参数被静默忽略或截断**：步数固定或上限 28，`scale` 被收敛到 0–10，尺寸只认几个档位，string 类型的 seed 触发 422。
   - **返回的是 URL**：可能是相对路径，也可能会过期，要在服务端立即下载存好（我们前端 CSP 的 `img-src` 本来就只放行同源和存储桶）。
   - **HTTP 200 却是一张错误图**：Nai2API 排队超过 60 秒会返回一张「服务器繁忙」图片，并带 `x-error: 1` 头；没有账号时默认返回 mock 图。
   - **同参数命中缓存，返回同一张图**。
   - **模型名各家不同**：`nai-diffusion-4-5-full`、`nai-v4.5-full`、`[2K]nai-diffusion-4-5-full:k_dpmpp_2m_sde` 都见过。
7. **慢、要排队，超时不能重试**：
   - 官方每个账号同时只能跑一个生成，所以中转普遍按账号排队。已有客户端的超时设在 180–600 秒。
   - 多个客户端都明确：**超时不重试**，因为上游往往仍在生成、照样扣费。只有 408/429/502/503/504，或错误文案里有「稍后重试」之类字样时，才退避重试。
   - 只有 401/403/404 这类「生成前就被拒」的错误，才适合换下一个连接。
8. **鉴权以 `Authorization: Bearer <key>` 为主**，例外有：
   - TTAPI 用 `TT-API-KEY` 头。
   - NovelAI2api 还接受 `X-API-Token`。
   - Nai2API 的 GET 直链把 token 放在 query 里。
   - 部分中转根本不校验 key（个例）。

   错误体以 OpenAI 的 `{"error":{"message","type","code"}}` 为主。官方是 `{"statusCode","message","details"}`，TTAPI 是 `{"status":"FAILED","message"}`。

---

## 1. 基准：NovelAI 官方图像接口

出处：官方 Swagger 页 https://image.novelai.net/docs/index.html ，机器可读版 https://image.novelai.net/docs/doc.json （Swagger 2.0，标题 "Omegalaser API"）。

- **接入点**：`POST https://image.novelai.net/ai/generate-image`。另有 `POST /ai/generate-image-stream`，返回 `text/event-stream`，事件类型分 intermediate、final、error。请求参数 `parameters.stream` 可取 `msgpack` 或 `sse`。（doc.json）
- **鉴权**：`securityDefinitions.ApiKeyAuth` 为 `Authorization` 头。官方说明要用用户的 Persistent API token。token 以 `pst-` 开头、按 Bearer 发送，这一点见社区 SDK 和插件，例如 https://github.com/2575044704/nai-v4.5-api 、上文的 nai_series 源码。
- **请求体** `image.ImageGenerationRequest`：`input`、`model`、`action`、`parameters`、`url`。`parameters` 的主要字段有：
  - 尺寸和采样：`width`、`height`、`steps`、`scale`、`sampler`、`noise_schedule`、`cfg_rescale`、`seed`、`n_samples`；
  - 提示词：`negative_prompt`、`v4_prompt`、`v4_negative_prompt`（结构是 `caption.base_caption` 加 `char_captions[].char_caption/centers`，另有 `use_coords`、`use_order`、`legacy_uc`）；
  - 其他：`params_version`、`qualityToggle`、`ucPreset`、`image_format`（`png` 或 `webp`），以及参考图（`director_reference_*`、`reference_*`）。（doc.json）
- **返回**：`produces` 为 `application/zip` 和 `application/json`。发 `Accept: application/json` 时返回 **201** 和 `{"images":[{"image": base64, "index", "seed"}]}`（`image.ImageGenerationJsonResponse` / `image.ImageJson`）。默认返回 ZIP，里面是一张或多张 PNG。
- **错误体**：`utils.JsonError` 为 `{"statusCode","message","details"}`。文档只列了 401 和 500。可以带 `x-correlation-id` 头，方便 500 时报告。（doc.json）
- **条款提示**：接口描述里写着 "all generation requests must be initiated by a human action"（doc.json）。这与「谁出钱、条款允不允许」那张票有关，这里只记下原文。
- **V4 起的 `v4_prompt`**：一篇个人实测帖说，V4 以后的模型缺 `v4_prompt` 或 `v4_negative_prompt` 会返回 500（个例：https://dev.to/ilan_kim/calling-the-novelai-v5-api-directly-nai-diffusion-5-full-request-body-paramsversion-4310-133a ）。社区插件的官方通道确实都带着这两个字段，并带 `params_version: 3`（个例：https://github.com/muyouzhi6/astrbot_plugin_nai_series/blob/12e6f986a04e0901d0c81d3b2b77b1c1a24bb3f4/providers.py ）。
- **并发**：每个账号同时只能有一个生成任务，超出返回 429（个例：社区库 README https://pypi.org/project/novelai/ ；SillyTavern issue https://github.com/SillyTavern/SillyTavern/issues/2759 ）。**官方文档未写**。
- **模型**：官方模型页 https://docs.novelai.net/en/image/models/ 说当前是 V5 Full 和 V5 Curated，V4.5 Full 和 Curated 降为上一代；V5 对 Opus 的免费生成首次设了用量上限。**官方页不列 API 模型 ID**。中转和社区节点普遍用 `nai-diffusion-5-full`、`nai-diffusion-5-curated`、`nai-diffusion-4-5-full`、`nai-diffusion-4-5-curated`（https://docs.ttapi.io/api/en/novel/text-to-image 、https://github.com/bedovyy/ComfyUI_NAIDGenerator ）。

## 2. 形态 A：原样转发官方接口

只换 base URL 和 key，路径、请求体、返回都不变。

| 中转或网关 | 路径 | 返回 | 出处 |
|---|---|---|---|
| IdleCloud（官方兼容模式） | `https://api.idlecloud.cc/api/ai/generate-image`（注意多了 `/api` 前缀） | 同步，ZIP | 个例，客户端 README：https://github.com/fuilyha56-wq/nai_artist |
| meinianda.top（定制版 New API） | 价格说明写明支持「NovelAI 原生格式」 | **未确认** | 平台公开接口 https://meinianda.top/api/pricing （`nai-diffusion-4-5-full`、`nai-diffusion-5-full` 的 description 字段）；版本见 https://meinianda.top/api/status （`v1.0.0-rc.37-custom…`） |
| love-for-nai（可自建，接 New API 账号） | `POST /ai/generate-image` | 配了 Gateway 时原样转发 ZIP 或 msgpack 流；没配时转成 OpenAI 请求，再把结果打包成 ZIP | 个例：https://github.com/fuilyha56-wq/love-for-nai |
| Mingyin11/new-api（new-api 的个人分支，0 星） | 对上游调 `{base}/ai/generate-image`；对下游开放 `/ai/generate-image` 和 OpenAI 两种格式 | 解析 ZIP，也兼容裸 PNG 和 JSON `images` | 个例：https://github.com/Mingyin11/new-api/blob/e05d3ef9208e7cea6f075c278cc625c1967af425/relay/channel/novelai/adaptor.go |
| nai.yousebaby.com 的 `/generate` | `POST /generate`，请求体「兼容官方格式」（`input`/`tag`、`model`、`action`、`parameters`） | **不是 ZIP**，是 `{"status","url"}`；`url` 默认是相对路径 `/img/<id>.png`，开 `return_base64` 后变成 data URI | 平台文档：https://nai.yousebaby.com/ |

要点：

- **路径前缀不统一**：有的是 `{base}/ai/generate-image`，有的是 `{base}/api/ai/generate-image`。客户端要么让用户填完整地址，要么按规则拼接。已有插件就是「地址以完整路径结尾就原样用，否则补路径」（个例：nai_artist 的 IdleCloud 靠 base_url 区分同步和异步）。
- **「兼容官方格式」不等于返回也一样**：yousebaby 收官方形状的请求，返回的却是 URL。客户端解析 A 的返回时，最好同时认 ZIP、官方 JSON（`images[].image`）、`{url}` 和 SSE。nai_series 的官方通道就是这样按 content-type 和内容依次判断的（个例，源码见上）。
- **参数是否真被尊重**，A 形态最有希望，因为请求体原样到达 NovelAI。但中转仍可能改写，例如 Nai2API 把 GET 和 OpenAI 通道的步数固定为 28（见第 5 节）。

## 3. 形态 B：OpenAI images 兼容（`/v1/images/generations`）

### 3.1 OpenAI 官方规范（兼容的基准）

出处：OpenAI 官方 OpenAPI 规范 https://github.com/openai/openai-openapi （`openapi.json`，`components.schemas.CreateImageRequest` / `ImagesResponse` / `Image`，2026-10-17 的 main）。

- 请求字段：`prompt`、`model`、`n`（1–10）、`size`（字符串，形如 `1024x1536`）、`quality`、`output_format`、`background`、`moderation`、`stream`、`partial_images`、`user` / `safety_identifier`。
- **`response_format`（`url` | `b64_json`）已标为 deprecated**："Unsupported for GPT image models, which always return base64-encoded images."。`style` 同样弃用。dall-e-2 和 dall-e-3 已在 2026-05-12 下线。
- 返回：`{"created", "data":[{"b64_json" | "url", "revised_prompt"}], "usage", …}`。`url` 只对「支持该参数的模型」返回。
- 规范里**没有**负面词、步数、种子这类字段，所以中转只能另行扩展。

### 3.2 中转怎么写模型名

- 多数直接用 NovelAI 的 ID：`nai-diffusion-4-5-full` 等（meinianda 的 `/api/pricing`、TTAPI、new-api issue #7487、dsh-nai-image 的模型表）。
- 也有用别名的：love-for-nai 的 OpenAI 路径用 `nai-v4.5-full`，原生路径用 `nai-diffusion-4-5-full`（个例，README 同上）。
- 结论：**模型名只能让配置的人自由填写**，不能写死成一个枚举。

### 3.3 NovelAI 特有参数怎么塞（没有统一做法）

| 塞法 | 例子 | 出处 |
|---|---|---|
| **平铺在顶层** | `{"model","prompt","negative_prompt","size","n":1,"response_format":"b64_json","steps","scale","sampler","noise_schedule","cfg_rescale","stream"}` | 个例，客户端源码：https://github.com/muyouzhi6/astrbot_plugin_nai_series/blob/12e6f986a04e0901d0c81d3b2b77b1c1a24bb3f4/providers.py （`OpenAIImagesProvider.generate`），用于 `https://meinianda.top/v1`、`https://love.auroralove.cc/api/v1` 等中转 |
| **嵌在 `parameters` 对象里**（仿官方） | `{"prompt","size":"832x1216","n","model","action":"generate","parameters":{"steps","scale","sampler","noise_schedule","seed","negative_prompt"}}`；多角色时 `parameters` 里再加 `characterPrompts` 和 `v4_prompt` | 个例，从 astrbot_plugin_nai_image v2.7.3 源码整理的契约：https://github.com/mofei-114/dsh-nai-image/blob/d62fc9e08e38985e47ec3b5843e798385a3aecec/docs/%E4%B8%8A%E6%B8%B8%E6%8E%A5%E5%8F%A3%E5%A5%91%E7%BA%A6.md （§3.3–3.11） |
| **三处都认** | `raw_request` 优先于 `parameters`，`parameters` 优先于顶层快捷字段 | 个例：https://github.com/GALIAIS/NovelAI2api （README） |
| **`extra_fields`** | `extra_fields` 里的键合并进官方 `parameters` | 个例：Mingyin11/new-api 的 `ConvertImageRequest`（链接见第 2 节） |
| **只认 prompt 和 size** | 尺寸取自 `size`，其他参数全部用中转的默认值（`scale 6`、`k_euler`、28 步、固定 `uc`） | 个例：Mingyin11/new-api 同上 |

- 尺寸：都用 `size: "宽x高"`。已知有中转会把尺寸收敛到「宽高是 64 的倍数、最长边 ≤1920、面积 ≤3686400」（个例：dsh 契约 §3.5）。
- **种子**：有中转会把 string 类型的随机种子转成数字，结果返回 422，所以有插件干脆不传 seed（个例：nai_series README https://github.com/muyouzhi6/astrbot_plugin_nai_series ）。

### 3.4 返回长什么样

- 标准形状：`{"created", "data":[{"b64_json":"…"}]}` 或 `{"data":[{"url":"…"}]}`。
  - NovelAI2api 的 README 写明返回 `b64_json`。
  - Mingyin11 分支只返回 `b64_json`。
  - love-for-nai 的示例显式传了 `response_format: "b64_json"`。
- **`b64_json` 和 `url` 同时存在时谁优先，规范没写**。已有客户端都是 `b64_json` 优先（个例：dsh 契约 §3.12、nai_series）。
- 已有客户端在 images 端点上**还兼容**这些返回，说明确实有中转这样返回（个例）：
  - `choices[].message.content` 里的 Markdown 图片或 data URI（chat 形状）；
  - `type: "image_generation.completed"` 事件；
  - 直接吐 NovelAI 的 final 事件（`{"image": …, "event_type":"final"}`，源码注释写的是 "Some relays expose NovelAI final-image events directly"）；
  - 开了 `stream` 时的 SSE。

  出处：nai_series `providers.py` 的 `_parse_response`；README 说「两种设置均支持 Images 的 `data[].b64_json`、`data[].url`，以及 Chat 返回的 Markdown 图片链接、图片 data URI、多段 content 数组。接口仍返回 SSE 时自动解析」。
- `b64_json` 一般是裸 base64，不带 `data:image/...` 前缀（dsh 契约 §3.12）。但也有中转在别处返回 data URI（yousebaby），解码前要先剥掉前缀。

## 4. 形态 C：OpenAI chat 兼容（`/v1/chat/completions`）

| 中转 | 提示词和参数怎么给 | 图片怎么回来 | 出处 |
|---|---|---|---|
| nai.yousebaby.com | 最后一条 user 消息是提示词；顶层可带 `size`/`image_size`（只认 `832:1216`、`1216:832`、`1024:1024`）、`negative_prompt`、`sampler`；步数、scale、seed 只能写进提示词里的 `Parameter{key:value,…}` 语法 | 非流式：`message.content` 是**纯文本 URL**；流式：进度放在 `delta.reasoning_content`（10/30/60/90%），最后在 `delta.content` 给 `![image_0](URL)` | 平台文档：https://nai.yousebaby.com/ |
| Nai2API（可自建；nai.sta1n.cn 等站用它） | 最后一条 user 消息必须严格按逐行中文字段写：「提示词:…\n画师串:…\n尺寸:竖图\n提示词引导值:6\n缩放引导值:0\n负面提示词:…」，不合格返回 400；也可以传顶层 `nai` 对象覆盖；**步数由后端固定为 28**；模型 ID 形如 `[2K]nai-diffusion-4-5-full:k_dpmpp_2m_sde` | Markdown 图片链接；流式时先输出「排队中」「已路由账号 #1，正在生成」等文本 | 个例，项目 README：https://github.com/STA1N156/Nai2API |
| ikun 网关 | `prompt`、`negative_prompt`、`size` 编成 JSON 字符串放进 user 消息 | `message.content` 里的 Markdown 图片 URL | 个例：https://github.com/fuilyha56-wq/nai_artist |
| 「7877」本地服务 | 正向词放 user 消息，负面词放 system 消息 | Markdown 图片 URL | 同上 |
| Mingyin11/new-api | 取最后一条消息作提示词，其他参数全部用默认值 | `![generated image](data:image/png;base64,…)` 加一行 Prompt | 个例，源码链接见第 2 节 |
| meinianda.top | 价格说明写明支持 Chat 格式 | **未确认** | https://meinianda.top/api/pricing |

要点：

- **参数语法每家都不同**（`Parameter{}`、逐行中文字段、JSON 字符串、system 放负面词、顶层 `nai` 对象……），通用实现只能可靠地送过去提示词。
- **图片可能出现在多个位置**：Markdown 链接、裸 URL、data URI、多段 content 数组、流式时拆成多块的链接。

## 5. 形态 D：平台自定义接口

- **TTAPI**（商业聚合平台）：
  - 提交：`POST https://api.ttapi.io/novelai/text-to-image`，鉴权头是 **`TT-API-KEY`**，**异步**返回 `{"status":"SUCCESS","data":{"jobId":…}}`。
  - 取结果：轮询 fetch 接口，或者用 `hook_url` 回调。
  - 参数：`prompt`、`model`（V5 和 V4.5 的 full / curated 四个）、`negative_prompt`、`n`（1–4）、`width`、`height`、`seed`、`steps`（默认 23）、`scale`、`sampler`（用显示名，例如 `Euler Ancestral`）、`noise_schedule`、`quality_toggle`、`character_prompts[{prompt, center{x,y}, uc}]`、`vibe_transfer`、`character_reference`。
  - 错误：400 和 401 返回 `{"status":"FAILED","message":…}`。
  - fetch 的返回结构和图片 URL 的有效期，这一页都没写，**未确认**。
  - 出处：https://docs.ttapi.io/api/en/novel/text-to-image
- **IdleCloud 站内模式**：`POST /api/generate_image` 提交，`GET /api/get_result/{job_id}` 轮询（插件默认每 5 秒一次），结果是 base64（个例：nai_artist README）。
- **Nai2API 任务接口**：
  - 提交：`POST /api/web/jobs`，token 放在 body 里。
  - 轮询：`GET /api/jobs/{id}`，`x-user-token` 头，`status` 依次是 `queued`、`running`、`done`、`failed`；完成后下载 `imageUrl`，常是相对路径，例如 `/api/images/img_1/content`。
  - 另有 GET 直链：`/generate?token=…&tag=…&size=竖图…`，返回**裸图片二进制**。
  - 出处：个例，Nai2API README；dsh 契约 §1、§2。

## 6. 鉴权

| 方式 | 谁在用 | 出处 |
|---|---|---|
| `Authorization: Bearer <key>` | 官方（`pst-…`）、New API 系（`sk-…`）、Nai2API 的 OpenAI 接口（`STA1N-…`）、NovelAI2api、nai_series 和 dsh 等客户端的默认做法 | doc.json；各 README |
| `X-API-Token: <pst>` | NovelAI2api 也接受 | https://github.com/GALIAIS/NovelAI2api |
| `TT-API-KEY: <key>` | TTAPI | https://docs.ttapi.io/api/en/novel/text-to-image |
| query 参数 `token=` | Nai2API 的 GET 直链（README 提醒带 token 的 URL 是敏感链接） | Nai2API README |
| 不校验 | 「部分中转站不校验」，插件允许 key 留空 | 个例：https://github.com/mofei-114/dsh-nai-image （README「openai：OpenAI 兼容」一节） |

## 7. 错误和限流

- **错误体形状**：
  - OpenAI 风格 `{"error":{"message","type","code"}}`：New API 系，yousebaby 用 `invalid_request_error`、`rate_limit_error`、`server_error`；
  - 官方 `{"statusCode","message","details"}`；
  - TTAPI `{"status":"FAILED","message"}`；
  - 也有中转返回 `{"error":"字符串"}`。已有客户端两种 `error` 都认（个例：dsh 契约 §3.13）。
- **限流和排队**：
  - yousebaby：所有 token 都被禁用、过期或冷却时返回 429 `rate_limit_error`；token 都在用时请求先排队，排多久没写。
  - Nai2API：每个账号同时只跑 1 张；图片 URL 请求等满 60 秒还没生成，就返回「服务器繁忙」**图片**；OpenAI chat 接口最长等 10 分钟（`OPENAI_CHAT_TIMEOUT_MS` 默认 600000）。
- **状态码会被网关改写**：
  - new-api 把上游非 2xx 统一包成 OpenAI 错误，`code` 为 `bad_response_status_code`（https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/service/error.go ，`RelayErrorHandler`）。
  - 渠道还能配 `status_code_mapping` 改写状态码（https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/relay/image_handler.go ）。
  - 有客户端观察到「网关会把上游瞬时故障包装成 400（bad_response_status_code）」，所以除了看状态码，还按错误文案判断能不能重试（个例：dsh 契约 §6.3，关键词有「服务繁忙」「请稍后重试」「try again later」「overloaded」等）。
- **已有客户端的重试策略**（都是个例，但彼此一致）：
  - 408/429/502/503/504 按 2s、4s、8s 退避重试，最多 2–3 次；
  - **超时不重试**，因为上游通常仍在生成并照常扣费；
  - 只有 401/403/404 才换下一个连接；
  - 下载失败不重新生成。

  出处：dsh 契约 §6；nai_series README 和 `ProviderRouter`。

## 8. 开源网关 new-api / one-api 对 NovelAI 的适配

- **new-api（QuantumNous，main `3e2ce2c`，最新发布 v1.0.0-rc.44，2026-10-12）**：
  - **没有 NovelAI 渠道**。仓库里没有 novelai 相关文件；issue「希望增加novelai的AI绘画接口」#2066 没有维护者回复，2026-05-20 被机器人以 not planned 关闭（https://github.com/QuantumNous/new-api/issues/2066 ）。
  - **用法**：大家用「OpenAI 兼容（type=1）」渠道，把上游指向某个已经把 NovelAI 转成 OpenAI 格式的服务（https://github.com/QuantumNous/new-api/issues/7487 ，环境写着 rc.38、type=1、Upstream NovelAI）。
  - **请求怎么转发**：
    - `ImageRequest` 只声明了固定字段：`model`、`prompt`、`n`、`size`、`quality`、`response_format`、`style`、`user`、`extra_fields`、`background`、`moderation`、`output_format`、`stream`、`image`、`mask` 等。其余字段在反序列化时收进 `Extra`，但 `MarshalJSON` 里合并 `Extra` 的循环被注释掉了，注释是「不能合并ExtraFields！！！」（https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/relaykit/dto/openai_image.go ）。
    - OpenAI 适配器的 `ConvertImageRequest` 对生成请求直接返回这个结构体，再由 `image_handler.go` 序列化（https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/relay/channel/openai/adaptor.go ）。所以**默认情况下 `negative_prompt`、`steps`、`seed`、`parameters` 这类非标准顶层字段会被丢掉**；`extra_fields` 是已知字段，会原样带到上游。
  - **透传**：`image_handler.go` 在全局或渠道开了 pass-through 时直接转发原始请求体（这个分支 2026-07 起就在）。但 issue #7487（2026-09-20，open，无维护者回复）报告 rc.38 开了 `pass_through_body_enabled` 仍然被丢。**两者矛盾，未确认**哪个准。
  - **参数覆盖**：渠道的 `param_override` 能给每个请求塞固定参数，但做不到按请求变。
  - **返回原样透传**：`OpenaiImageHandler` 把上游 JSON 原样写回，只用来数 `url` 和 `b64_json` 的条数计费（https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/relay/channel/openai/relay_image.go ）。所以经过 new-api 后，返回 `b64_json` 还是 `url`，**取决于它背后的那层转换器**。上游如果直接回 ZIP，这里会因为不是 JSON 而报 `bad_response_body`（从代码推断）。
  - **定制分支**：线上能见到定制版同时开 Chat、Images、原生三种格式（meinianda.top，`v1.0.0-rc.37-custom…`）。个人分支 Mingyin11/new-api 自己写了 NovelAI 渠道，但请求体是旧的 V3 形状（只有 `input`，没有 `v4_prompt`），对 V4.5 能不能用**未确认**。
- **one-api（songquanpeng，最后推送 2026-01-09）**：
  - 没有 NovelAI 适配。
  - `ImageRequest` 只有 8 个字段（https://github.com/songquanpeng/one-api/blob/8df4a2670b98266bd287c698243fff327d9748cf/relay/model/image.go ）。
  - 只在做了模型映射或走 Azure 时重新序列化（这时丢掉多余字段），否则原样转发请求体（https://github.com/songquanpeng/one-api/blob/8df4a2670b98266bd287c698243fff327d9748cf/relay/controller/image.go ）。

## 9. 常见坑（汇总）

1. **参数被静默忽略**：
   - New API 系默认丢掉非标准字段（第 8 节）。
   - Mingyin11 分支除了尺寸和张数，其余全用默认值。
   - Nai2API 的 OpenAI 和 URL 通道步数固定为 28。
   - 有中转把 `scale` 收敛到 0–10（dsh 契约 §3.4）。
   - yousebaby 只认三种尺寸，别的尺寸直接报 400。

   无论接哪种中转，都**不能假设负面词、种子、步数一定生效**。
2. **步数和尺寸的计费门槛**：多家中转以 28 步、约 1024×1024 为界，超过就加价或干脆不支持。
   - meinianda：「支持 1–28 步」。
   - Nai2API：「超过 28 步或像素数超过 1024 × 1024 时……按官方 Anlas 公式计费」。
   - nai_artist：「steps 保持 28 以内以免额外扣点」。
3. **返回的是 URL**：
   - URL 可能是相对路径（yousebaby 的 `/img/<id>.png`、Nai2API 的 `/api/images/…/content`），要相对 base URL 拼成完整地址。
   - **有效期没有一家写明**（未确认）。有客户端的更新日志提到要把 Reverse Proxy 返回的「临时 URL」先拷到本地，「过期或读不到的 URL 直接判失败」（个例：https://github.com/platberlitz/sillytavern-image-gen 的 README 更新日志）。
   - 对我们来说：拿到 URL 后要在服务端立即下载，存到自己的地方。前端 CSP 的 `img-src` 只放行同源和存储桶，第三方 URL 本来也显示不了。
4. **HTTP 200 却是错误图或假图**：
   - Nai2API 排队超时返回「服务器繁忙」图片；
   - `MOCK_WHEN_NO_ACCOUNT` 默认 `true`，没有账号时返回 mock 预览图；
   - 它的任务接口用响应头 `x-error: 1` 标记错误占位图（Nai2API README；dsh 契约 §2.3）。
5. **缓存**：Nai2API 同参数命中缓存，返回同一张图，照样扣 0.1 点（`nocache=1` 才强制重画）。如果中转在服务端开了缓存，同一提示词可能反复拿到同一张照片。
6. **模型名不统一**：标准 ID、`nai-v4.5-full` 这类别名、带分辨率前缀和采样器后缀的复合名都有（第 3.2、4 节）。
7. **base URL 怎么拼不统一**：用户可能填站点根地址、`…/v1`，或者完整的 `…/v1/images/generations` / `…/api/ai/generate-image`。已有客户端的做法：
   - 以完整路径结尾就原样用；
   - 以 `/v1` 结尾就补 `/images/generations`；
   - 其他情况补 `/v1/images/generations`。

   出处：dsh 契约 §3.1；nai_series 也会去掉结尾的 `/v1` 再拼。
8. **种子类型**：string 类型的 seed 被转成数字，导致 422（nai_series README）。
9. **慢**：
   - 每个账号同时只能跑一个生成，中转普遍排队；
   - 已有客户端的超时：180 秒（dsh / astrbot 默认，可调到 30–600）、300 秒（nai_series）、低档 IdleCloud 建议 180 秒（nai_artist）；
   - 超时后上游仍会扣费，所以**不要自动重试**（第 7 节）。
10. **同一个中转、同一个 key，不同端点的行为可能不同**：Nai2API 网页通道支持 1–50 步，OpenAI 通道固定 28 步；love-for-nai 的原生路径在没配 Gateway 时其实是转成 OpenAI 请求再打包成 ZIP。

## 10. 支持哪几种能覆盖绝大多数中转（推断，不替你做决定）

| | A 原样转发 | B OpenAI images | C OpenAI chat | D 自定义 |
|---|---|---|---|---|
| 配置项 | 地址 + key + 模型 | 地址 + key + 模型 | 地址 + key + 模型 + 每家的参数语法 | 逐家适配 |
| 官方接入点 | 就是它 | 不适用 | 不适用 | 不适用 |
| 负面词、尺寸、种子能否送到 | 原样送到（中转仍可能改写） | 看中转：平铺、`parameters`、`extra_fields` 三种塞法里命中一种才生效 | 通用实现基本送不到 | 看平台 |
| 返回解析 | ZIP / 官方 JSON / `{url}` / SSE | `b64_json` / `url` / data URI，偶尔是 chat 形状或 SSE | Markdown / 裸 URL / data URI / SSE | 看平台 |
| 这次见到的中转 | IdleCloud、meinianda、love-for-nai、Mingyin11、yousebaby（半个） | meinianda、auroralove、love-for-nai、NovelAI2api、Mingyin11、new-api type=1 渠道的用户 | yousebaby、Nai2API 系、ikun、7877、Mingyin11、meinianda | TTAPI、IdleCloud、Nai2API |

- **A + B**：两种都是只填地址和 key 就能用。A 同时覆盖官方接入点，B 覆盖 New API 系聚合平台。这次见到的「对外卖 key」的中转，至少开了其中一种，只有 Nai2API 系例外：它只开 chat 和自定义接口。
- **B 的请求体**可以同时平铺在顶层，又嵌一份在 `parameters` 里，这样多命中几种实现。但中转会不会因为未知字段报错，**未确认**。目前没见到因多余字段报错的记录，只见到被静默丢掉的。
- **C** 如果要支持，通用实现只能「把整段英文提示词放进 user 消息、从回复里抠图片」，负面词和尺寸送不到。
- **D** 不适合通用支持。
- 用户手上那个中转是哪种，要用它的地址实测（两三次请求就够）：
  - 先试 `GET {base}/v1/models`；
  - 再分别试 A 和 B 各一次；
  - 记下返回形状，以及负面词、尺寸、种子有没有生效（同一个 seed 出两次图，看是否相同）。

## 未确认 / 需要实测的

- 各中转返回的图片 URL 有效期（没有一家写明）。
- new-api 渠道开了透传后，images 请求的非标准字段到底能不能送到（源码和 issue #7487 矛盾）。
- B 形态中转遇到未知字段是忽略还是报错。
- meinianda 等定制版 New API 的「NovelAI 原生格式」返回的是 ZIP 还是 JSON。
- TTAPI fetch 接口的返回结构、图片是 URL 还是 base64。
- 官方 429（并发）和 402（Anlas 不足或订阅不够）的确切文案和状态码：官方 Swagger 只列了 401 和 500。

## 出处列表

一手来源：

- NovelAI 官方图像 API Swagger：https://image.novelai.net/docs/index.html 、https://image.novelai.net/docs/doc.json
- NovelAI 官方模型页：https://docs.novelai.net/en/image/models/
- OpenAI 官方 OpenAPI 规范：https://github.com/openai/openai-openapi （`openapi.json`）
- new-api 源码（main `3e2ce2c`）：
  - https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/relaykit/dto/openai_image.go
  - https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/relay/image_handler.go
  - https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/relay/channel/openai/adaptor.go
  - https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/relay/channel/openai/relay_image.go
  - https://github.com/QuantumNous/new-api/blob/3e2ce2c8856e32ca7054d673f8cd059ae466e80c/service/error.go
- new-api issue：https://github.com/QuantumNous/new-api/issues/2066 、https://github.com/QuantumNous/new-api/issues/7487
- one-api 源码：https://github.com/songquanpeng/one-api/blob/8df4a2670b98266bd287c698243fff327d9748cf/relay/model/image.go 、https://github.com/songquanpeng/one-api/blob/8df4a2670b98266bd287c698243fff327d9748cf/relay/controller/image.go
- 平台自己的文档或接口：
  - TTAPI https://docs.ttapi.io/api/en/novel/text-to-image
  - nai.yousebaby.com https://nai.yousebaby.com/
  - meinianda.top https://meinianda.top/api/pricing 、https://meinianda.top/api/status

个例（社区项目的 README 或源码）：

- Nai2API：https://github.com/STA1N156/Nai2API
- love-for-nai：https://github.com/fuilyha56-wq/love-for-nai
- nai_artist：https://github.com/fuilyha56-wq/nai_artist
- astrbot_plugin_nai_series：https://github.com/muyouzhi6/astrbot_plugin_nai_series （`providers.py` @ `12e6f98`）
- dsh-nai-image 及其整理的 astrbot_plugin_nai_image 契约：https://github.com/mofei-114/dsh-nai-image （`docs/上游接口契约.md` @ `d62fc9e`）
- NovelAI2api：https://github.com/GALIAIS/NovelAI2api
- Mingyin11/new-api：https://github.com/Mingyin11/new-api （`relay/channel/novelai/adaptor.go` @ `e05d3ef`）
- sillytavern-image-gen：https://github.com/platberlitz/sillytavern-image-gen
- ComfyUI_NAIDGenerator：https://github.com/bedovyy/ComfyUI_NAIDGenerator
- 个人实测帖：https://dev.to/ilan_kim/calling-the-novelai-v5-api-directly-nai-diffusion-5-full-request-body-paramsversion-4310-133a
- 并发 429：https://pypi.org/project/novelai/ 、https://github.com/SillyTavern/SillyTavern/issues/2759
