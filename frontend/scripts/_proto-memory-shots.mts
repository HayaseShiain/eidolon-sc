// 一次性：原型截图，用完删。
import { chromium } from "playwright";

const variants = (process.argv[2] ?? "voxel,pixel,paper").split(",");
const points = (process.argv[3] ?? "0,0.15,0.25,0.36,0.48,0.6,0.7,0.8,0.95").split(",").map(Number);
const vp = process.argv[4] === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: vp });
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
for (const v of variants) {
  await page.goto(`http://localhost:3000/memory-prototype?variant=${v}${process.argv[5] ?? ""}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  for (const p of points) {
    await page.evaluate((p) => {
      const s = [...document.querySelectorAll<HTMLElement>("div")].find((d) => d.style.height === "900vh")!;
      const top = s.getBoundingClientRect().top + scrollY;
      scrollTo(0, top + p * (s.offsetHeight - innerHeight));
    }, p);
    await page.waitForTimeout(1600);
    await page.screenshot({ timeout: 180000, path: `../.scratch/_accept/${process.argv[5] ? "lineup-" : ""}${v}-${vp.width}-${String(Math.round(p * 100)).padStart(3, "0")}.png` });
  }
}
await browser.close();
