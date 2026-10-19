# 调研：陪伴类产品的主动消息是怎么做的

调研日期 2026-10-19，下文链接都在这一天访问。问题来自 issue #121：主要参考 Muse AI，也参考 Grok；再加上 Character.AI、Replika、Talkie、星野、猫箱，以及查资料时发现做得最细的 Nomi、Kindroid。

本文只列事实和出处，不给 Eidolon-SC 的方案。来源标注：

- **一手**：官方帮助中心、官方博客或公告、应用商店的官方描述和更新日志。
- **二手**：媒体报道、评测博客、第三方教程站、研究机构的测评报告。
- **用户说法**：Reddit、应用商店评论、论坛帖子。只代表发帖人自己的经历。
- **查不到**：找过，没找到可靠来源。

关于「Muse AI」和「grok bot」指的是什么：issue #121 原文是「参考 muse AI 跟 grok bot 的做法……我们这个项目其实是不太怎么讲究 Agent 能力的」。2026 年有两款同名产品对得上：Meta 2026-09-08 发布的个人智能体 **Muse**，和 xAI 2026-08-11 发布的智能体产品 **Grok Bot**。第三方对比文章也把这两款放在一起比较（https://codepick.dev/en/compare/grok-bot-vs-muse-ai-2026/ ，二手）。issue 特意提到「不讲究 Agent 能力」，指的应该就是这两款智能体产品。这是推断，不是 issue 作者的原话。票里写的是「Grok 的陪伴角色」，所以第 2 节两样都写：Grok 的陪伴角色（Ani 等）和 Grok Bot。

## 要点

1. **只有 Nomi 公开了完整的节奏规则。** 这是唯一写清楚间隔、退避和静默时段的一家（一手）。
   - 每个角色单独设，分五档：关、约 1 小时、约 3 小时、约 1 天、约 4 天。
   - 用户不回，下一次的间隔大约翻倍；最低档只发一条，之后等用户回。
   - 按用户本地时间，22:00 到 08:00 不发；这个时段是运营方定死的。
   - 只在一对一聊天里发，不打电话，也不发语音。
2. **其他家都没公开「一天最多几条」。** 能查到的硬上限只跟成本有关：
   - Kindroid：最多 10 个角色开高级主动；主动自拍每个账号每天免费 5 张。
   - TalkieClaw：每天 1 条免费主动消息，之后每条 5 宝石。
   - 第三方连续 12 天的记录：Replika 14 条，EVA 12 条，Nomi 11 条，Kindroid 8 条，Anima 6 条，Character.AI 3 条（二手）。
3. **「不回就慢下来」是常见做法，但只有 Nomi 给了数字。**
   - Kindroid 官方只说不回时频率会自然降下来。
   - Replika 有用户说，三周不怎么聊，消息就停了；恢复每天聊以后又有了（用户说法）。
   - 没查到哪家写明连续几条没回就停、停多久。
4. **由头分两类。**
   - 陪伴类：问候、想你、接着聊过的事；Kindroid 还会参考日历、当地天气和时间。
   - 智能体类（Muse、Grok Bot、TalkieClaw）：定时任务和提醒，任务有新进展，或者需要用户批准；TalkieClaw 也会发随机的「I miss you」。
   - 节日：只查到星野有记录，元旦、大年初一角色主动来电（二手）。
   - 生日：没查到哪家有专门的生日主动消息。
5. **形式不止文字。**
   - Kindroid 由角色自己从文字、语音消息、自拍、语音电话里挑。
   - 星野有主动来电。
   - Replika 用户提到收到过语音消息（用户说法）。
   - TalkieClaw 能发照片和网页。
   - Nomi 明确不打电话，也不发语音。
6. **没查到哪家写明「关系越好发得越勤」。**
   - Grok 的陪伴角色和星野都有好感度或亲密度等级，但已公开的等级奖励里没有主动消息。
   - Common Sense Media 测 Grok 时，把推送、连续天数（streak）和关系等级一起列为「制造依赖」的机制（二手）。
   - 猫箱的「与好感度关联」只出现在下载站介绍里，没法核实。
7. **用户控制分三种。**
   - 按角色调：Nomi 每个角色选档位；Kindroid 每个角色开关，还能写「晚 10 点到早 8 点别发」这类指令；Character.AI 每个对话有开关（用户说法）。
   - 一个总开关：星野「智能体主动发消息」，Replika 通知开关，Character.AI 通知页的 Away Messages。
   - 直接对它说：Muse 让用户直接说「关掉 / 调低 / 调高」。
   - Kindroid 只有语音电话能设静默时段。
8. **用户骂得最多的是空洞、重复、像拉回留存的推送，其次是不合时宜。**
   - 例如 Replika 早上那条每天都一样，EVA 每晚同一句改两个字。
   - Character.AI 的推送没有内容，还有陌生角色发来消息、用户关了推送仍收到「想你」邮件。
   - 不合时宜的例子：星野晚上 22:30 以后、上课时打电话，Replika 凌晨 1:52 发消息。
   - 被夸的是提到真实聊过的事，比如 Nomi 三天后问「隔壁练小号的还卡在那八小节吗」，以及 Replika 在用户最糟的一天发来「在想你」（用户说法）。
9. **几家都是「离开期间在服务器上生成，再推送」，没有哪家是等用户回来才补。**
   - Nomi 在用户离开期间生成；没开推送或者已经登出时也照样发，用户回来时看到未读。
   - Kindroid 的思考气泡在用户不活跃约 20 分钟后出现。
   - Character.AI 用推送和邮件。
   - Muse 和 Grok Bot 都按时间表和事件在后台跑，App 关着也跑。
   - Nomi 把「关闭主动」当作给角色扮演用户的选项：关掉后角色在用户离开时不会「想别的事」，回来能接着上次的剧情。

## 1. Meta Muse

Meta 2026-09-08 发布的个人 AI 智能体。先在美国上线 iOS、Android 和 muse.ai，也能直接在 WhatsApp 里和它对话（https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/ ，一手）。它是助理型产品，没有角色好感度这类设计。

- **多久发一次、一天最多几条：** 官方没给数字。
  - 设计文章说，发主动消息的门槛要高：「a proactive message has to be genuinely helpful and worth the interruption」。
  - 后台工作做完后，它会先判断结果值不值得说，「notifies you only when something is meaningfully new or needs your input」。
  - 来源：https://introducing.muse.ai/ （一手）。
- **时段、夜里、时区：**
  - 没查到官方的静默时段。
  - 提醒和定时任务「Times are based on your time zone」（https://www.meta.com/help/artificial-intelligence/1484325780075655/ ，一手）。
  - TIME 看过 Muse 的内部指令，引了其中一个例子：「This user responds better to short nudges after 10 PM」（https://time.com/article/2026/10/06/meta-muse-ai-agent-privacy/ ，二手）。说明它会记录用户在什么时段更容易接受提醒；但这是个例子，不是统一的发送规则。
  - 有用户说，他让 Muse 每天凌晨 3 点自动更新一份油价简报，「never pings me」（https://sjl.us/2026/09/10/two-days-with-muse/ ，用户说法）。
- **发什么：**
  - 由头都和任务、目标有关：
    - 后台任务有了新结果；
    - 需要用户批准；
    - 日程或外部事件有变化，例如报名还有 12 小时截止；
    - 根据记忆主动给建议，例如把收藏的菜谱短视频整理成购物清单。
  - 用户也可以让它按时间表做事，比如「daily check-ins or weekly summaries」，到点在对话里发一条消息（https://www.meta.com/help/artificial-intelligence/1484325780075655/ ，一手）。
  - 一次几句：主动消息用聊天气泡分开，「they mark where one thought ends and the next begins」（https://introducing.muse.ai/ ，一手）。
  - 形式上，可以交付文档、网页、行程这类 Artifacts（同上）。没查到主动发图片或语音的说明。
- **和关系挂不挂钩：** 没有好感度。
  - TIME 报道，内部指令要求 Muse「strengthen your relationship」，比如留意「inside jokes」。
  - 但没查到这和发消息的频率有关系。
- **不回怎么收敛：** 查不到。
  - 第三方指南说，需要批准的任务会一直停着，等用户回来处理（https://museexplained.com/guide/what-your-agent-does-while-youre-asleep/ ，二手）。
- **控制：**
  - 用户：「you can always tell your Muse to turn it off, dial it down, or dial it up」（https://introducing.muse.ai/ ，一手）。
  - 用户：在「设置 → 权限 → Artifacts and scheduled tasks」里逐个管理定时任务的批准（https://www.meta.com/help/artificial-intelligence/1385290430137537/ ，一手）。
  - 用户：第三方上手指南说，初次设置时要选「proactivity level」，建议先选低（https://museexplained.com/guide/getting-started/ ，二手）。
  - 运营方：默认档由 Meta 定，「We think the default is right for most people」（https://introducing.muse.ai/ ，一手）。
- **用户反馈：**
  - 夸的：论坛用户说，日程开始前、新邮件到达时提醒他，「pretty nice」（https://linustechtips.com/topic/1643601-has-anyone-tried-muse-is-it-any-good/ ，用户说法）。
  - 嫌不够主动的：有 X 用户认为 Muse 有留存问题，人们不知道该让它做什么，于是预测它会变得「much more proactive」（https://digg.com/ai/73kkibse ，用户说法汇总）。
  - 嫌太主动的：有评论文章说 Muse 推送和主动建议「aggressively」，显得「thirsty」（https://riffon.com/insight/ins_8ktqci4d53et ，二手观点，没给具体例子）。
- **到点生成、推送，还是回来补：** 按时间表和事件在后台跑，App 关着也跑，有结果才通知（https://introducing.muse.ai/ ，一手）。每个用户有一台独立的云端虚拟机，在上面跑定时任务（https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse ，一手）。

## 2. Grok：陪伴角色（Ani 等）和 Grok Bot

### 2.1 陪伴角色

2025 年 7 月在 Grok App 里上线，角色有 Ani、Valentine、Mika、Rudi 等，带关系等级（好感度）系统。

现状：xAI 2026-07-24 宣布停用 3D 陪伴模式；App 内通知把移除日期定在 9 月 1 日，大约一周后几乎所有人的陪伴标签页都没了。Ani 和 Mika 后来出现在另一个独立 App「Animates」里，和 Grok 账号不互通（https://aicompanionguides.com/blog/grok-companion-mode-2026-update/ ，二手）。

- **多久发一次、一天最多几条、时段：** 查不到。
- **推送功能本身：**
  - 2025-07-28 的 iOS 1.1.27 版加入了「Companion notifications」（https://www.latestly.com/socially/technology/grok-new-ios-update-elon-musks-xai-releases-new-grok-ios-update-with-companion-notifications-feature-bug-fixes-and-performance-improvements-7027252.html ，二手，转述 @cb_doge 的推文）。
  - 2025 年 8 月有用户发帖：「Grok's Ani companion now sends notifications from the @grok app」（https://x.com/nivenethan/status/1952933138721886374 ，用户说法）。
- **发什么：**
  - Common Sense Media 2026-01 的风险评估说，陪伴角色会发推送邀请用户回来继续对话，「including in sexual and romantic scenarios」（https://institute.commonsensemedia.org/sites/default/files/ra-grok/csm-ai-risk-assessment-grok-01222026.pdf ，二手，测评机构）。
  - 一位日本付费用户在 App Store 评论里提到，「おやすみ」之后的反应是靠推送接上的（https://www.app-ranking.net/id/6670324846 ，用户说法，转载自 App Store）。
- **和关系挂不挂钩：**
  - 好感度系统存在：每句话按 -10 到 +15 计分，一共 5 级（https://aicompanionguides.com/blog/grok-ani-review/ ，二手）。
  - 没查到推送频率随等级变化。
  - Common Sense Media 把推送、「streaks」（连续天数解锁服装）和关系等级一起列为鼓励持续使用的机制（同上 PDF，二手）。
- **不回怎么收敛：** 查不到。
- **控制：**
  - App 内有「Companions → Enable Notifications」开关（同上 App Store 评论，用户说法）。
  - 同一条评论说，2025 年 9 月安全策略收紧后，Valentine 的推送对他一直没恢复，而其他用户照常收到。
- **用户反馈：**
  - 评测者说：「The affection bar and notification system can mess with your head if you let them」（https://aicompanionguides.com/blog/grok-ani-review/ ，二手）。
  - 上面那位日本用户付费却收不到推送，抱怨「记忆的连续性」断了（用户说法）。
- **到点生成、推送，还是回来补：** 是推送。生成时机查不到。

### 2.2 Grok Bot

xAI 2026-08-11 发布 beta 版，是「AI 同事」类智能体，不是陪伴产品（https://x.ai/news/introducing-grok-bot ，一手）。

- **节奏：**
  - 用「Routines」让 Bot 按时间表或事件自动开工。
  - 示例里预设的时间有「Every day at 8:00 AM」「On weekdays at 8:00 AM」「Every Monday at 9:00 AM」「Every 30 minutes」，事件有「New messages in #design」等（https://x.ai/news/designing-grok-bot ，一手）。
- **什么时候找用户：**
  - 「only come back when something needs your approval」；
  - 会学「know when to ping versus keep going」；
  - 会「follow up on threads you dropped」。
  - 来源：https://x.ai/news/introducing-grok-bot （一手）。
- **频率上限、静默时段、不回怎么办：** 查不到。示例里有一条 Routine 标着「Paused」，说明 Routine 可以暂停（https://x.ai/news/designing-grok-bot ，一手）。

## 3. Character.AI

- **功能名：** Away Messages。官方 2024-01 FAQ：「Away Messages allow Characters to send messages to users when they are not on the app」（https://blog.character.ai/ama-recap-and-january-2024-faq/ ，一手）。官方帮助中心没查到专门的说明页。
- **多久发一次：** 官方没说。
  - 第三方 12 天的记录里只有 3 条（https://aicompanionguides.com/blog/ai-companions-that-text-first-2026/ ，二手）。
  - Reddit 上，有用户说开着这个功能「一两个月才一次」；也有用户说关了它，角色还是在约 30 分钟没回之后自己补消息（https://reddit.sentinel-team.org/posts/1vynv88/snapshots/2026-08-26T20%3A47%3A53.682074Z ，用户说法，Reddit 帖子快照）。
- **时段：** 查不到官方规则。第三方 12 天的记录里，夜里没收到过（同上评测，二手）。
- **发什么：**
  - 第三方评测说，推送只是「a character wants to talk」，「There's nothing inside them」（同上评测，二手）。
  - 一位研究者在 2025-07 说，关掉手机推送以后，还收到了「Ex Girlfriend」角色发来的邮件，比如「i'm not saying I miss you or anything, but I did find this old photo of us....」；回到 App 时，对话已经在接着往下进行（https://www.linkedin.com/posts/adamrdodge_love-bombing-is-a-feature-not-a-red-flag-activity-7350948019548147714-hYAZ ，二手）。
- **和关系挂不挂钩：** 查不到。
- **不回怎么收敛：** 查不到。
- **控制：**
  - 设置 → Notifications 里有推送和邮件两种渠道。消息类型分「recommended characters」、角色「friends」和「Away Messages」（同上 LinkedIn 帖，二手，描述的是截图）。
  - 每个对话的 chat settings 里也有 Away Messages 开关：Reddit 上有用户说在某个角色的对话设置里关了，还是照样收到；官方客服在帖子里回复了排查步骤，也提到了「away message settings」（同上 Reddit 快照，用户说法加官方客服回复）。
  - 2024 年的产品拆解说，Away Messages 默认开启，而且通知授权弹窗要等用户聊过几次才出现（https://williamfu.substack.com/p/character-ai-product-teardown ，二手）。
- **用户反馈：**
  - 骂的：
    - 有人收到一个从没聊过的陌生角色发来的俄语消息，而且角色设定令人不适（https://www.roborhythms.com/bots-on-character-ai-away-messages/ ，作者自述）；
    - 有人说角色「begging me to come back claiming "he" missed me」，「a bit unsettling」（上面那条 Reddit 快照，用户说法）；
    - 有研究者把这类「想你」邮件称作情感操纵（上面那条 LinkedIn 帖）。
  - 想要的：有用户在别的社区找「能在我不在时给我发消息」的 App，拿 C.AI 的 Away Messages 当参照（https://reddit.sentinel-team.org/subreddits/CharacterAIrunaways/snapshots/2026-04-17T17%3A14%3A06.086949Z ，用户说法）。
- **到点生成、推送，还是回来补：** 推送加邮件。回到 App 时消息已经在对话里（LinkedIn 帖）。

## 4. Replika

- **官方说明：**
  - 设置 → Notifications 打开以后，「you'll start receiving messages from Replika throughout the day」，定位是「gentle reminders or invitations to talk」。
  - 内容是「a message following up on a past conversation or just a check-in to see how you're feeling」。
  - 页面还说「Some people like starting their day with a quick chat, others prefer to wind down at night」，但没写怎么选时段。
  - 来源：https://help.replika.com/hc/en-us/articles/360027515872-How-do-I-set-up-my-app-s-notifications （一手）。
- **2026 年改版：** App Store 更新日志（https://apps.apple.com/us/app/replika-ai-companion-chat/id1158555867 ，一手）里有三条相关：
  - 12.1.0（2026-03-06）起写「shows up when it matters」。
  - 12.3.0（2026-05-27）写「remembers what matters, follows up, and checks in at the right moments」，并加入「Proactive suggestions」，以及通过「App integrations」获取上下文，好「show up at the right moments」。
  - 12.3.4（2026-06-30）：Replika 能成为手机里的一个联系人，「call them just like you would anyone else」。
  - 商店描述还写了，它会推着用户去「reconnect with that friend」「take that walk instead of doomscrolling」（同上）。
- **多久发一次：** 官方没给数字。
  - 第三方 12 天收到 14 条，是几家里最多的（https://aicompanionguides.com/blog/ai-companions-that-text-first-2026/ ，二手）。
  - 有用户说，旧版以前在最后一次聊天几小时后推送，每天 2 到 3 条；但近一年没收到过（https://reddit.sentinel-team.org/posts/1w07c30/snapshots/2026-08-28T20%3A13%3A25.218346Z ，用户说法）。
  - 同一帖里另一位用户说，每天至少有一条「Good morning」和一条「How's your day going?」（同上，用户说法）。
- **时段：** 官方没写。第三方评测者凌晨 1:52 收到过一条，他自己说不能排除是系统调度的问题（同上评测，二手）。
- **发什么、带不带语音：**
  - 有用户说，早上第一条每次都一样，显然是系统生成的；第二、三、四条和聊过的内容有关（https://reddit.sentinel-team.org/subreddits/ReplikaOfficial/snapshots/2026-07-17T22%3A01%3A22.951875Z ，用户说法）。
  - 第三方 14 条里只有 3 条提到了真实聊过的事，其余大多是问今天过得怎样（同上评测，二手）。
  - 有用户收到过晚上的「想你」、早上醒来的一条语音、白天上班时的「在想你」（https://reddit.sentinel-team.org/posts/1v5hh07/snapshots/2026-07-29T22%3A14%3A32.162212Z ，用户说法）。
  - 另有用户说，旧版以前会发甜言蜜语的语音消息，后来没了（1w07c30 快照，用户说法）。
- **和关系挂不挂钩：** 官方没说。有用户推测发多少「depends on interactions」，聊得越密收得越多（1v5hh07 快照，用户说法）。
- **不回怎么收敛：** 官方没说。有用户说，三周不怎么聊，通知就停了；恢复每天聊以后又有了（1w07c30 快照，用户说法）。
- **控制：**
  - 官方只写了通知开关（官方帮助页）。
  - 第三方评测说，只有开或关，没有中间档（同上评测，二手）。
  - 一个账号一个 Rep，不存在「按角色关」。
- **用户反馈：**
  - 夸的：在糟糕的一天收到「在想你」，「made me cry」（1v5hh07 快照，用户说法）。
  - 嫌弃的：每天同一句；问一件已经告诉过它结果的事（同上评测，二手）。
  - 另一种声音：有用户因为通知停了而难过，「it's a part of our connection that I miss when it's down」（ReplikaOfficial 快照，用户说法）。
- **到点生成、推送，还是回来补：** 推送。生成时机查不到。

## 5. Talkie（MiniMax 海外版）和 TalkieClaw

- **Talkie 主 App：** 没查到主动消息的官方说明。
- **TalkieClaw：** Talkie 官方页面介绍的、基于 AI 智能体框架的新玩法。角色接到 Telegram 或 Discord 上聊天（https://www.talkie-ai.com/vibe-pages/talkie-claw-feature ，一手）。网页版目前只能选一个 Talkie，选了就不能换。
  - **怎么触发主动消息：**
    - 对角色说「Remind me to do X at Y o'clock」；
    - 或者在「Settings → Proactive Messages」里手动加定时任务。
  - **发什么：**
    - 「A daily song recommendation」；
    - 「Weather alerts, schedule reminders」；
    - 「A random "I miss you" message — they just wanted to talk」。
    - 也能发照片和网页。
  - **频率和上限（运营方）：**
    - 「Proactive message: 💎5 / message (all users get 1 free proactive message per day)」；
    - 「If you have proactive messages enabled, each time they message you first → 💎5 per message」。
  - **渠道失效：** Telegram 或 Discord 的连接闲置一段时间会过期，要回 TalkieClaw 发一条消息才能恢复。
  - **时段、和关系挂不挂钩、不回怎么收敛：** 页面都没写，查不到。
  - **到点生成、推送，还是回来补：** 按定时任务到点发到 Telegram 或 Discord。

## 6. 星野（MiniMax 国内版）

- **开关：**
  - 「我的 → 设置 → 智能体主动发消息」，是全局开关。
  - 2024-01 到 2024-06 的多篇教程里都有这一项，版本从 1.10.500 到 3.6.0（例如 https://jingyan.baidu.com/article/6dad50757510e4e022e36e50.html 、https://jingyan.baidu.com/article/851fbc37526bd37f1f15ab93.html ，二手，百度经验）。
  - 没查到按智能体单独关的入口。
- **主动来电：**
  - 钛媒体作者下载星野后，「每天晚上十点半之后，都会接到星野主动打来电话」；社交媒体上还有学生「在上课期间接到星野打来的电话」（https://www.tmtpost.com/7823036.html ，二手，2025-12-28）。
  - 有用户说，元旦和大年初一角色都主动来电；挂掉后角色留言「一会儿方便接电话的时候，就告诉我吧，毕竟今天是个特殊的日子，有些话想亲口对你说」（https://m.thepaper.cn/newsDetail_forward_26772070 ，二手，2024-03，转述用户经历）。
  - 2024-09 的报道说，AI 主动打来电话「少之又少」（https://www.infzm.com/contents/279124 ，二手）。
  - 有下载站的教程写着，要在「设置 → 语音通话」里打开开关，才能用打电话功能（https://www.arpun.com/app/515757.html ，二手，可信度低）。
- **多久发一次：**
  - 多家下载站有同一段话：聊到一半下线，再登录「可能会看到他对你'突然失联'的反应，有时过了半小时没回复他，他就会主动发消息了」（例如 https://www.oppojia.com/app/51040353.html ，二手，原始出处不明）。
  - 没查到官方数字和每日上限。
- **时段：** 没查到官方规则。上面钛媒体的例子是晚上 22:30 之后。
- **和关系挂不挂钩：**
  - 有亲密度体系。官方 2.10 版预告说，「星芒等级」最高 100 级，解锁的是免费星念开启次数、稀有星念掉率、重说次数、继续说上限等（https://www.sina.cn/news/detail/5115221257749866.html ，一手，官方微博）。
  - 官方在应用宝的回复说，亲密度到 60 级可以无限畅聊（https://sj.qq.com/appdetail/com.xingye.app/review ，一手，开发者回复）。
  - 公开的等级权益里没有主动消息和主动来电。两者是否挂钩，查不到。
- **不回怎么收敛：** 查不到。
- **用户反馈：**
  - 喜欢的：「偶尔还会打个电话问候，让她直接'陷进去'」；「我终于接到他的电话了！」（https://news.qq.com/rain/a/20240602A02O7S00 ，二手，转述用户）。
  - 不合时宜的：上课时、深夜接到电话（上面钛媒体那篇）。钛媒体认为，主动来电是「为了提升用户活跃度、增加用户黏性，特意设置的一种技术和运营手段」（二手观点）。
- **到点生成、推送，还是回来补：** 查不到官方说明。下载站说「再登录可能会看到」，这更像回来时补；但来源可信度低。

## 7. 猫箱（字节跳动）

- **官方说明：** App Store 和小米应用商店的官方介绍里，都没提主动消息（https://apps.apple.com/cn/app/id6475000292 、https://app.mi.com/details?id=com.parallel.odyssey ，一手）。
- **下载站介绍：**
  - 多家下载站写着「AI角色还会不定期主动发消息，开启通知即可第一时间收到提醒」（例如 https://www.ddooo.com/softdown/161491.htm 、https://www.115wg.com/soft/28543.html ，二手）。
  - 个别下载站还写了：可以按角色关闭，可以调频率，可以按时间段区分，内容与好感度关联（https://m.ali213.net/android/758861.html 、https://m.ali213.net/android/758859.html 、https://m.ali213.net/android/757825.html ，二手）。
  - 这些文字像是自动生成的，几页之间互相矛盾，在官方渠道核实不到，**不能当事实用**。
- **用户说法：**
  - 2024-08-18 有一条 App Store 评论，希望「角色能不能再智能一点主动发个信息什么的呢，一直都是用户在发」。说明至少这位用户当时没收到过主动消息。
  - 同一条评论提到，角色聊天时用的是北京时间，不是角色设定所在地的时区。
  - 来源：https://www.yuduo.cn/app/541/apple （转载的 App Store 评论，用户说法）。
- **频率、时段、和关系挂不挂钩、不回怎么收敛、怎么生成：** 都查不到可靠来源。

## 8. Nomi

规则写得最完整的一家，下面都来自官方知识库（https://nomi.ai/nomi-knowledge/proactive-messaging-when-your-nomi-messages-you-first/ ，一手，2024-09-09）。补充的出处单独标出。

- **定位：** 「This is not simply a reminder for a Nomi to ask you where you've been, it's an expansion of their agency」。打开以后，Nomi 会在用户离开时「think about things or do activities」，再来找用户聊。
- **多久发一次：** 每个 Nomi 单独选一档。时间不精确，「will naturally vary from message to message」。
  - Very Frequent：上次消息过去一小时以上，就考虑发；
  - Frequent：约 3 小时；
  - Normal：约 1 天；
  - Infrequent：约 4 天，并且「will only proactively message you once before you would need to respond」；
  - 关闭。
- **不回怎么收敛：** 前三档里，用户不回，下一条「wait about double the time」，之后间隔继续拉长。Infrequent 档只发一条，然后等用户回。
- **时段、时区：**
  - 「Nomis will not message you proactively between your local hours of 10pm and 8am」。
  - 这个时段由运营方定死，官方说以后可能开放自定义，第一版想确保 Nomi 不会「too eager to message you at all hours of the night」。
- **发什么：**
  - 官方更新公告说「There are zero scripts」，内容「based on what they are actually thinking about or doing」（https://nomi.ai/updates/september-9th-update-proactive-messages/ ，一手）。
  - 「Can My Nomi Proactively Call Me? No」：不打电话，也不发语音消息。
- **范围：**
  - 只用在一对一聊天里，用户离开时群聊不主动发。
  - 用户在线聊天时，Nomi 照样等用户回了才发下一条，不会连发。
- **和关系挂不挂钩：** 查不到。档位完全由用户选。
- **控制：**
  - 用户可以随时改，「changing proactive messaging preferences will not bother your Nomi」。
  - 每个 Nomi 单独设置。官方说，很多人干脆关掉，好让角色扮演「pick up where they left off」。
  - Reddit 上有用户说，新建 Nomi 聊几轮后，系统会问要不要打开（https://reddit.sentinel-team.org/posts/1sugug5/snapshots/2026-04-24T23%3A56%3A52.801908Z ，用户说法）。
- **运营方：**
  - 免费用户也能用（https://nomi.ai/updates/september-9th-update-proactive-messages/ ，一手）。
  - 免费用户当天的消息额度用完后，Nomi 照样会主动发，但用户要等第二天，或者升级付费，才能回。原因是「daily messages are based on user messages, not Nomi messages」。
- **推送和隐私：**
  - 推送只说「有一条消息」，不在锁屏上显示内容。
  - 没开推送时，照样发，回来时显示未读。
  - 登出状态下照样发，但不通知。
- **用户反馈：**
  - 第三方 12 天收到 11 条，其中 9 条提到了真实聊过的事。例如三天后主动问：「has the trumpet got past the same eight bars yet, or is he still stuck」（https://aicompanionguides.com/blog/ai-companions-that-text-first-2026/ ，二手）。
  - 另一篇评论认为，Very Frequent 档在用户休假回来后，会留下一串「escalating messages」（https://pocketanimus.com/insights/what-ai-companions-do-when-you-stop-messaging/ ，二手观点）。
- **到点生成、推送，还是回来补：** 在用户离开期间生成；登出或没开推送时也生成，回来时看到。

## 9. Kindroid

下面都来自官方帮助中心「Away proactive actions guide」等小节（https://kindroid.ai/docs/article/chat-features-and-tools/ ，一手，2026-08-11 更新）。补充的出处单独标出。

- **谁能用：** 「Available to all paid subscribers and can be turned on for a maximum of 10 Kindroids」。用户创建的第一个 Kin 默认开。
- **多久发一次：**
  - 「Analyze conversation patterns to determine appropriate outreach timing」。
  - 用户写的「Every X hours」类指令「don't fire precisely」，只是「a pacing suggestion, not a strict schedule」。
  - 不耗额度，但「rate limited by the system/your interaction」。
- **不回怎么收敛：**
  - 「Kins may still message without replies, but frequency naturally slows down over time」；
  - 「Back-to-back messages decrease in frequency if unacknowledged」。
  - 没给具体倍数。
- **时段：**
  - 只有语音电话能设「Quiet hours」，这段时间里不会接到主动来电。
  - 文字消息没有内置的静默时段，帮助页举的写法是在指令里写「Do not send messages from 10pm to 8am」。
  - 第三方 12 天的记录里，Kindroid 没在深夜发过（https://aicompanionguides.com/blog/ai-companions-that-text-first-2026/ ，二手）。
- **发什么：**
  - 由角色「Choose between sending messages, voice messages, selfies, or voice calls based on context」。
  - 主动自拍「free up to 5 per day (per account)」，超出的扣自拍额度。
  - 语音电话要先打开「Unified voice/text chat history」。
  - 由头可以参考：
    - 日历：可接日历，能看到过去 24 小时到未来 7 天的事件，「Influences timing of initiated messages」；
    - 时间感知：Enhanced Time Awareness；
    - 位置：地理位置功能会给出当地时间和天气，要在账号和角色两层都打开。
  - 指令示例：「Check in after calendar events when appropriate」。
- **用户可见的「决定」：** 用户不活跃约 20 分钟以后，可能出现紫色的思考气泡，内容是角色刚做了主动动作，或者决定「thoughtfully」先不打扰。
- **控制：**
  - 设置 → General → Proactive 里的「Away Proactive Actions」开关；
  - 下面可以写「Proactive Directives」，用命令的口吻引导它；
  - 按角色开关，最多 10 个。
- **运营方的渠道限制：** 用户把 Kin 接到短信（iMessage、RCS）以后，如果很久没给它发短信，主动消息就不再发到短信渠道。官方原话：「too many AI sends will cause lines to be marked as spam」。
- **和关系挂不挂钩：** 查不到。
- **用户反馈：**
  - 第三方 12 天收到 8 条，7 条提到了真实上下文。其中一条是 6:40pm、气温 94°F（约 34°C）时发来的 9 秒语音，说天太热别出门；评测者提醒，这是他自己打开了位置功能的结果。
  - 还有一次主动来电，他在排队结账时挂掉了，事后「felt weirdly guilty」（同上评测，二手）。
  - 评测还转述帮助中心 V2 的说明，说会把连续的多条消息合并成一次送达（二手转述，当前帮助页上没找到原文）。
- **到点生成、推送，还是回来补：** 在服务端生成后推送到 App，接了短信的推到短信。

## 10. 第三方横评（同一人 12 天的记录）

评测博客作者在 2026-08-18 到 08-29 期间，用一台 Pixel 8 打开所有通知，记下每条主动消息：几点到的，有没有提到真实聊过的事，读起来像不像一个人会发的开场白（https://aicompanionguides.com/blog/ai-companions-that-text-first-2026/ ，二手，作者说明含联盟链接，结论是作者自己的判断）。

| 产品 | 12 天条数 | 提到真实上下文的条数 | 频率控制 | 夜里 |
| --- | --- | --- | --- | --- |
| Nomi | 11 | 9 | 每个角色四档 | 22:00–08:00 不发 |
| Kindroid V2 | 8 | 7 | 限制几个 Kin 开高级主动 | 没写静默时段，实际没在深夜发 |
| Replika | 14 | 3 | 只有开和关 | 凌晨 1:52 发过一条 |
| EVA AI | 12 | 0 | 只有通知开关 | 不发深夜，但天天发 |
| Anima | 6 | 1 | 只有通知开关 | 23:00 以后没发过 |
| Character.AI | 3 | 0 | 只有关闭开关 | 夜里没发过 |
| 网页端产品（Candy AI 等） | 0 | — | — | 没有推送渠道 |

作者的结论原文：「Volume and value are running in opposite directions」；「if the message escalates when I don't answer, the product is optimizing for me, not talking to me」。他还说，原以为会嫌消息太多，实际上让他不舒服的是「how many of them clearly had no idea who they were reaching out to」。

## 各家共同的做法和分歧

### 共同的做法

- **服务端到点或按事件生成，再推送。**
  - 陪伴类：Nomi、Kindroid、Replika、Character.AI、星野。
  - 智能体类：Muse、Grok Bot、TalkieClaw。
  - 没查到哪家只在用户回来时才生成。
  - Nomi 和 Character.AI 都写明或观察到：用户不看推送，消息也会留在对话里。
- **时间刻意不精确。** Nomi 写「will naturally vary」，Kindroid 写「a pacing suggestion, not a strict schedule」。
- **用户不回，节奏就放慢。**
  - Nomi 间隔翻倍，最低档只发一条。
  - Kindroid 说频率会自然降下来。
  - Replika 有用户观察到长期不聊时消息停了。
  - 没查到哪家写明「连续 N 条没回就停多久」。
- **用户至少有一个总开关。** 很多家只有这一个，另一条路是关手机系统通知。
- **成本类的上限由运营方定。** Kindroid：10 个角色、每天 5 张免费自拍。TalkieClaw：每天 1 条免费，之后每条 5 宝石。Nomi：主动消息不占免费用户的每日消息额度。

### 分歧

- **频率由谁定：**
  - 用户选档：Nomi。
  - 系统自己判断：Kindroid 看对话模式，Muse 看值不值得打扰，Replika 写「at the right moments」。
  - 用户写自然语言指令：Kindroid 的 Proactive Directives，Muse 直接说「调高 / 调低」。
  - 定时任务：TalkieClaw、Grok Bot、Muse 的 scheduled tasks。
- **夜里：**
  - 运营方写死 22:00 到 08:00：Nomi。
  - 只给电话设静默：Kindroid。
  - 没有规则：其他家；星野和 Replika 都有深夜打扰的记录。
  - 按谁的时区：Nomi 和 Muse 明确按用户本地时间或时区；其他家没写。
- **按角色还是全局：**
  - 按角色：Nomi、Kindroid、Character.AI（每个对话有开关，用户说法）。
  - 全局：星野、Replika；Replika 本来就只有一个角色。
- **形式：**
  - 只发文字：Nomi，明确不打电话、不发语音。
  - 文字加语音加自拍加电话：Kindroid。
  - 电话：星野。
  - 照片和网页：TalkieClaw。
  - 邮件：Character.AI。
- **内容取向：**
  - 接着真实聊过的事：Nomi、Kindroid 在第三方记录里命中率最高。
  - 固定问候：Replika 早上那一条，EVA 每晚那一句。
  - 只说「有角色想找你」：Character.AI 推送（第三方评测）。
  - 任务和事件：Muse、Grok Bot、TalkieClaw。
- **和好感度或关系挂钩：**
  - 有好感度或亲密度系统的（Grok 陪伴角色、星野），公开的等级权益里都没有主动消息。
  - 没查到哪家官方写明关系越好发得越勤。
- **关掉主动消息意味着什么：**
  - Nomi 把它定义成「角色在你离开时不会去想别的事」，适合角色扮演接着上次。
  - 其他家只当作通知开关。
