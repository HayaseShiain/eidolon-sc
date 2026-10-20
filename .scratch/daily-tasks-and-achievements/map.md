# 每日任务与成就

Label: wayfinder:map

来源：GitHub issue #149「对礼物&好感度系统的大功能」。

## Destination

两份可以直接拆票实现的规格，所需的决定全部定下、实现顺序也定好：

- **每日任务**（`.scratch/daily-tasks/spec.md`）：每天在北京时间 0 点换一批任务，制作人做完领奖励，奖励是抽奖次数或礼物，多一条拿礼物的路。
- **成就**（`.scratch/achievements/spec.md`）：制作人和偶像们往来累积到一定程度时解锁，可以分几个阶段，每个阶段解锁一次、领一次奖励。

先做每日任务、上线看效果，再做成就。

## Notes

- 术语以 `GLOSSARY.md` 为准。「每日任务」「成就」是定图时的暂定名，正式叫什么在「拍板：每日任务是什么」「拍板：成就是什么、怎么算」里定，定了再写进词汇表的「好感度与礼物」一节。说角色、对话、回合、用户、制作人，不说小偶像、聊天、账号。
- 每张拍板类（grilling）票都要调用 grilling 和 domain-modeling 两个 skill。原型票调用 prototype，原型放在 `prototype/<name>` 分支。前端相关的先读 `frontend/AGENTS.md` 的「shadcn 纪律」，视觉以 `DESIGN.md` 为准；给用户看的文案要少。
- 这张地图只做计划，交付物是规格，不是实现。地图、票和规格放在计划分支 `feat/daily-tasks-and-achievements`；调研结论放在 `research/<name>` 分支，只推送、不开 PR。
- 定图时已定（2026-10-20 的 grilling）：
  - 目的地是两份规格，各对应一个 `feat/` 分支，按「每日任务 → 成就」的顺序做。
  - 目的是多给用户一些抽奖机会、多一些拿礼物的途径。送礼照旧不受对话每天 +6 的上限约束，礼物可以直接把好感度拉高；任务和成就给多少，不要求换算下来低于 +6。
  - 奖励只给背包里的东西（抽奖次数、礼物、重置卡之类，具体在奖励票里定），不直接加好感度：好感度是她的感受，只由回合和收到的礼物改变。
  - 跟着「好感度和礼物」的开关走：关掉或没配判断模型时，每日任务和成就整块不出现，进度原样留着；不另加开关。
- 定图时查到的现状：
  - 抽奖次数和重置卡存在 `gift_balances`（`draws`、`given_on` 北京日期、`reset_cards`），背包是 `gift_backpacks(user_id, gift_id, count)`（`gifts.py`）。抽奖次数是读取时按 `given_on` 补发的，没有定时器；补发封顶 `MAX_DRAWS`（7），但用 `max` 保留超出的部分，所以别的来源加的次数可以超过 7。没有现成的「给某位用户加 N 次抽奖」的入口，`_give`、`_start` 是私有的，要求持锁、在事务里。新表要在 `database.py` 的 `USER_DATA` 或 `NOT_USER_DATA` 里登记。
  - 「一天」按北京时间（`affinity.DAY_TIMEZONE`、`day_of`、`next_day`），抽奖和对话加好感度的每日上限都用它。
  - 能看出「今天做过什么」的记录：回合是 `messages`（`role='user'`）连 `conversations`；接通的通话是 `calls.connected_at`；送礼是 `conversation_events`（`kind='gift'`）。时间都是 UTC 的 ISO 文本。`messages` 不区分是不是用自带密钥的回合（只有运行记录知道，保留 90 天）。打字回合和通话里的回合能靠 `messages.hurt` 是否为空分开。
  - 这些记录都会随删除历史对话一起删掉；统计页（`stats.py`）只数还在的记录，删了就少。
  - 数据包导入的对话、回合、通话、送礼照原样写回、带原来的时间，表里没有标记来源，和这里产生的记录分不开（ADR-0025 说数据包可以伪造）。
  - 角色隐藏只存在浏览器里（`frontend/src/lib/listPreferences.ts`），服务器不知道；冷却在 `affinities.cooling`，`GiftState.characters` 带每位角色是否冷却中。
  - 「好感度和礼物」开关：后端 `LiveConfig.affinity_on`（配了判断模型且开关开着）；前端靠 `GET /api/gifts` 的 `open` 等返回值推断。
  - 常驻后台循环照 `reach_outs.keep_reaching_out`、`service_status.keep_probing` 的写法在 `Backend.start()` 里起。
  - 礼物页是 `frontend/src/components/gifts/GiftsPage.tsx`（抽奖台 `DrawDesk` 是文件内函数），其余组件在同目录：`DrawDialog`、`MyGifts`、`GiftTile`、`GivePanel`、`GivenToast`、`ResetCards`。

## Decisions so far

<!-- 每张关闭的票一行：名字链接加一句要点 -->

## Not yet specified

- 成就的奖励、放在哪里、长什么样：等「拍板：成就是什么、怎么算」定了成就清单和怎么记进度，再升成奖励票和原型票。

## Out of scope

- 小游戏：这一轮不做，以后单独开一张地图。定图前聊过的方向：每个游戏是一个自成一体的模块，代码随部署带上，管理者在后台逐个启用（不做运行时安装）；胜负由服务器判定；奖励不归游戏管，统一由礼物模块换成抽奖次数并设每天的总上限；不开 Auth 接口给外部接入，因为外部上报的结果可以伪造。
- 签到：每天自动发的那 1 次抽奖已经相当于签到。
- 购买、充值：抽奖次数和礼物不能用钱换（礼物 spec 已定）。
- 排行榜和用户之间的比较。
- 推送提醒：没有 Web Push、邮件，沿用搭话那张地图的结论。
- 管理者给某一位用户补发奖励：和「管理者不能单独给某一位用户发抽奖次数或礼物」一致。
