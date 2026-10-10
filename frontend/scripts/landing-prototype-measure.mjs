// PROTOTYPE：量落地页原型的首屏 JS（压缩后传输字节）和手机 4G 节流下的 LCP。
// 先 `npm run prototype:landing` 起好 next start，再 `node scripts/landing-prototype-measure.mjs [url] [runs]`。
//
// 节流照 Lighthouse 移动端默认：RTT 150 ms、下行 1.6 Mbps、上行 750 Kbps、CPU 4 倍降速；
// 视口 390×844、DPR 3、触屏。每轮新开上下文，不带缓存。

import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/landing-prototype?panel=0";
const runs = Number(process.argv[3] ?? 3);

const browser = await chromium.launch();
const results = [];

for (let n = 0; n < runs; n++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const requests = new Map();
  cdp.on("Network.requestWillBeSent", (e) => requests.set(e.requestId, { url: e.request.url, t: e.timestamp, type: e.type }));
  cdp.on("Network.responseReceived", (e) => {
    const r = requests.get(e.requestId);
    if (r) r.type = e.type;
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = requests.get(e.requestId);
    if (r) r.bytes = e.encodedDataLength;
  });

  await page.addInitScript(() => {
    window.__lcp = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__lcp.push({ t: e.startTime, tag: e.element?.tagName, cls: e.element?.className, text: e.element?.textContent?.slice(0, 30), size: e.size });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  const loadAt = Date.now();
  // 等到 OGL 加载完、画布淡入（requestIdleCallback 之后）。
  await page.waitForFunction(() => document.querySelector(".lp-root")?.classList.contains("lp-gl-on"), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const lcp = await page.evaluate(() => window.__lcp);
  const nav = await page.evaluate(() => {
    const e = performance.getEntriesByType("navigation")[0];
    return { ttfb: e.responseStart, dcl: e.domContentLoadedEventEnd, load: e.loadEventEnd };
  });
  const fonts = await page.evaluate(() =>
    performance.getEntriesByType("resource").filter((r) => r.initiatorType === "css" || /\.woff2/.test(r.name)).length,
  );

  const scripts = [...requests.values()].filter((r) => r.type === "Script" && r.bytes);
  // 首屏 JS = load 事件之前请求的脚本；之后的是空闲时动态加载的 OGL（和点偶像才加载的立绘）。
  const loadTs = Math.min(...[...requests.values()].map((r) => r.t)) + nav.load / 1000;
  const initial = scripts.filter((r) => r.t <= loadTs);
  const later = scripts.filter((r) => r.t > loadTs);
  const sum = (xs) => xs.reduce((a, r) => a + r.bytes, 0);
  const fontBytes = sum([...requests.values()].filter((r) => r.type === "Font" && r.bytes));
  results.push({
    lcp: lcp.at(-1),
    nav,
    initialJsKB: +(sum(initial) / 1024).toFixed(1),
    laterJs: later.map((r) => ({ url: r.url.replace(/^.*\/_next\//, ""), kB: +(r.bytes / 1024).toFixed(1) })),
    initialScripts: initial.length,
    fontKB: +(fontBytes / 1024).toFixed(1),
    fontFiles: fonts,
    tier: await page.evaluate(() => document.documentElement.dataset.lpTier),
  });
  void loadAt;
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
const lcps = results.map((r) => r.lcp?.t ?? NaN).sort((a, b) => a - b);
console.log(`LCP 中位数 ${lcps[Math.floor(lcps.length / 2)].toFixed(0)} ms；首屏 JS ${results[0].initialJsKB} KB（压缩后传输）`);
