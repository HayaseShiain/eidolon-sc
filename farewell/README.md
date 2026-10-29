# 告别站

演示站停机以后留在原域名上的静态站：落地页（去掉了登录）和统计页 `/thanks`。只在 `farewell` 分支上，不合进 `main`。
应用本身（`frontend/`、`backend/`）照旧可以自己部署，见仓库根目录的 README。

## 本地

```sh
npm install
npm run dev        # 开发
npm test           # 落地页模型和字体子集的测试
npm run build      # 静态导出到 out/
```

改了文案（`src/i18n/zh.ts`）或角色快照以后，重新生成字体子集再提交：`node scripts/landing-fonts.mts`（要有 uv）。

## 数据

`data/` 下的 JSON 都是停机前导出的快照，由 `scripts/export.py` 生成（口径写在脚本开头）：

```sh
python scripts/export.py snapshot                 # 本机：角色列表、落地页素材、礼物名
python scripts/export.py stats <库文件>           # VPS 上：统计页的数，只读地打开库
```

停机前把 `export.py` 拷到 VPS 上跑 `stats`，把生成的 `stats.json` 拿回来放进 `data/`，重新构建、提交。

## 部署（Vercel）

- Root Directory：`farewell`；Production Branch：`farewell`。`vercel.json` 的 `ignoreCommand` 让别的分支不构建。
- 安全头和老地址的跳转（`/about`、`/login`、`/conversations` 等都回首页）都在 `vercel.json`。
- 立绘、招呼音频、3D 体素这些素材仍在 `https://stand.hmhnk.top`（对象存储和 CDN 继续保留）。
