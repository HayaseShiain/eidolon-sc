// PROTOTYPE（prototype/landing-memory-3d）：把三视图切成正面、左侧、右侧（镜像）、背面四张，去底、居中放到 1024×1024 的白底上，给图生 3D 用。
// 输入 ../.scratch/_refs/<id>-turnaround.png，输出 ../.scratch/_refs/tripo/<id>-<视角>.png
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const OUT = "../.scratch/_refs/tripo";
/** 侧面那张脸朝哪边（看过图手填的）。 */
const FACING: Record<string, "left" | "right"> = { mano: "left", kaho: "right", fuyuko: "left", kiriko: "left" };
mkdirSync(OUT, { recursive: true });

for (const id of ["mano", "kaho", "fuyuko", "kiriko"]) {
  const { data, info } = await sharp(`../.scratch/_refs/${id}-turnaround.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const n = w * h;
  let clear = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 10) clear++;
  const mask = new Uint8Array(n);
  if (clear / n > 0.2) for (let i = 0; i < n; i++) mask[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  else {
    const white = (i: number) => {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      return Math.min(r, g, b) > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 20;
    };
    const bg = new Uint8Array(n);
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const i = stack.pop()!;
      if (bg[i] || !white(i)) continue;
      bg[i] = 1;
      const x = i % w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (i >= w) stack.push(i - w);
      if (i < n - w) stack.push(i + w);
    }
    for (let i = 0; i < n; i++) mask[i] = bg[i] ? 0 : 1;
  }
  // 三个人按前景最少的列切开：正面、侧面、背面。
  const cols = new Array(w).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cols[x] += mask[y * w + x];
  const cutAt = (a: number, b: number) => {
    let best = Math.round(a * w);
    for (let x = best; x < b * w; x++) if (cols[x] < cols[best]) best = x;
    return best;
  };
  const c1 = cutAt(0.22, 0.45);
  const c2 = cutAt(0.55, 0.78);
  // 侧面那张脸朝左时看到的是她的左侧；另一侧用镜像顶上。
  const leftSide = FACING[id] === "left";
  const ranges: [string, number, number, boolean][] = [
    ["front", 0, c1, false],
    [leftSide ? "side-left" : "side-right", c1 + 1, c2, false],
    [leftSide ? "side-right" : "side-left", c1 + 1, c2, true],
    ["back", c2 + 1, w, false],
  ];
  for (const [name, ra, rb, mirror] of ranges) {
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let y = 0; y < h; y++)
      for (let x = ra; x < rb; x++)
        if (mask[y * w + x]) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    const out = Buffer.from(data);
    for (let i = 0; i < n; i++) if (!mask[i] || i % w < ra || i % w >= rb) out[i * 4 + 3] = 0;
    const cw = x1 - x0 + 1;
    const ch = y1 - y0 + 1;
    let figure = sharp(await sharp(out, { raw: { width: w, height: h, channels: 4 } }).extract({ left: x0, top: y0, width: cw, height: ch }).png().toBuffer());
    if (mirror) figure = figure.flop();
    // 人占画布高度的 88%，居中，白底。
    const target = Math.round(1024 * 0.88);
    const scaled = await figure.resize({ height: target, width: Math.round((cw / ch) * target), kernel: "lanczos3" }).toBuffer();
    const meta = await sharp(scaled).metadata();
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: scaled, left: Math.round((1024 - meta.width!) / 2), top: Math.round((1024 - meta.height!) / 2) }])
      .flatten({ background: "#ffffff" })
      .png()
      .toFile(`${OUT}/${id}-${name}.png`);
  }
  console.log(id, 'ok');
}
