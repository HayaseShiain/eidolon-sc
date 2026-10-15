// PROTOTYPE（prototype/landing-memory-3d）：从三视图人设图雕出体素小人。
// 正面、侧面、背面三个剪影求交（visual hull），表面每块按露出来的那一面朝向，从对应的那张视图取颜色。
// 用法：node scripts/_proto-voxelize.mts [高度体素数，默认 64]
// 输入：../.scratch/_refs/<id>-turnaround.png；输出：public/prototype-memory/voxels/<id>.json

import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const H = Number(process.argv[2] ?? 64);
/** 侧面那张脸朝哪边（看过图手填的）。 */
const FACING: Record<string, "left" | "right"> = { mano: "left", kaho: "right", fuyuko: "left", kiriko: "left" };
const OUT = "public/prototype-memory/voxels";
mkdirSync(OUT, { recursive: true });

type Img = { data: Buffer; w: number; h: number; mask: Uint8Array };

async function load(file: string): Promise<Img> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const n = w * h;
  let clear = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 10) clear++;
  const mask = new Uint8Array(n);
  if (clear / n > 0.2) {
    for (let i = 0; i < n; i++) mask[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  } else {
    // 白底：从四边往里灌，接近白色、连着边的都是底。
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
  return { data, w, h, mask };
}

type View = { x0: number; x1: number; y0: number; y1: number; cx: number };

/** 按列切出三个人：在宽度三分之一、三分之二附近各找前景最少的一列下刀（头发挨得很近时也切得开）。 */
function views(img: Img): View[] {
  const cols = new Array(img.w).fill(0);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) cols[x] += img.mask[y * img.w + x];
  const cut = (a: number, b: number) => {
    let best = Math.round(a * img.w);
    for (let x = best; x < b * img.w; x++) if (cols[x] < cols[best]) best = x;
    return best;
  };
  const c1 = cut(0.22, 0.45);
  const c2 = cut(0.55, 0.78);
  const three: [number, number][] = [[0, c1 - 1], [c1 + 1, c2 - 1], [c2 + 1, img.w - 1]].map(([a, b]) => {
    let x0 = a;
    let x1 = b;
    while (x0 < x1 && cols[x0] <= 10) x0++;
    while (x1 > x0 && cols[x1] <= 10) x1--;
    return [x0, x1];
  });
  return three.map(([x0, x1]) => {
    let y0 = img.h;
    let y1 = 0;
    for (let y = 0; y < img.h; y++)
      for (let x = x0; x <= x1; x++)
        if (img.mask[y * img.w + x]) {
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    // 横向的中心按腿那一段（最下面 22%）定：头发、手臂左右不对称，腿是对称的。
    let sum = 0;
    let cnt = 0;
    for (let y = Math.floor(y1 - (y1 - y0) * 0.22); y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (img.mask[y * img.w + x]) {
          sum += x;
          cnt++;
        }
    return { x0, x1, y0, y1, cx: cnt ? sum / cnt : (x0 + x1) / 2 };
  });
}

/** 简单的 k-means，把前景的颜色收成一小套调色板，方块的颜色不糊。 */
function palette(img: Img, k: number): number[][] {
  const samples: number[][] = [];
  for (let i = 0; i < img.w * img.h; i += 7) if (img.mask[i]) samples.push([img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]]);
  let centers = Array.from({ length: k }, (_, j) => samples[Math.floor((j / k) * samples.length)]);
  for (let it = 0; it < 12; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      const j = nearest(centers, s);
      acc[j][0] += s[0];
      acc[j][1] += s[1];
      acc[j][2] += s[2];
      acc[j][3]++;
    }
    centers = acc.map((a, j) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : centers[j]));
  }
  return centers.map((c) => c.map(Math.round));
}
function nearest(centers: number[][], c: number[]) {
  let best = 0;
  let bd = Infinity;
  centers.forEach((p, j) => {
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = j;
    }
  });
  return best;
}

for (const id of Object.keys(FACING)) {
  const img = await load(`../.scratch/_refs/${id}-turnaround.png`);
  const [front, side, back] = views(img);
  const pal = palette(img, 24);
  const s = (front.y1 - front.y0 + 1) / H; // 每个体素多少像素：三张同一比例，按正面的高度定
  const ground = Math.max(front.y1, side.y1, back.y1);
  const tallest = Math.min(front.y0, side.y0, back.y0);
  const Hv = Math.ceil((ground - tallest + 1) / s) + 1;
  const Wv = Math.ceil(Math.max(front.x1 - front.x0, back.x1 - back.x0) / s) + 4;
  const Dv = Math.ceil((side.x1 - side.x0) / s) + 4;

  /** 一个格子：前景占比和代表色（调色板编号）。描线（很暗的颜色）只算三分之一票。 */
  const cell = (cx: number, cyTop: number): { cover: number; ci: number } => {
    const x0 = Math.round(cx - s / 2);
    const x1 = Math.round(cx + s / 2);
    const y0 = Math.round(cyTop);
    const y1 = Math.round(cyTop + s);
    const votes = new Map<number, number>();
    let fg = 0;
    let all = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
        all++;
        const i = y * img.w + x;
        if (!img.mask[i]) continue;
        fg++;
        const c = [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
        const j = nearest(pal, c);
        const dark = c[0] + c[1] + c[2] < 160;
        votes.set(j, (votes.get(j) ?? 0) + (dark ? 0.35 : 1));
      }
    let ci = 0;
    let bv = -1;
    for (const [j, v] of votes) if (v > bv) [ci, bv] = [j, v];
    return { cover: all ? fg / all : 0, ci };
  };
  // 体素 (x, y, z) 在三张图上对应的格子。y 从地面往上；+x 是她的左手边（正面图的右边），+z 是她的正面。
  const rowTop = (y: number) => ground + 1 - (y + 1) * s;
  const F = (x: number, y: number) => cell(front.cx + (x - Wv / 2 + 0.5) * s, rowTop(y));
  const B = (x: number, y: number) => cell(back.cx - (x - Wv / 2 + 0.5) * s, rowTop(y));
  const S = (z: number, y: number) => cell(side.cx + (FACING[id] === "left" ? -1 : 1) * (z - Dv / 2 + 0.5) * s, rowTop(y));

  const TH = 0.45;
  const fGrid = Array.from({ length: Wv }, (_, x) => Array.from({ length: Hv }, (_, y) => F(x, y)));
  const bGrid = Array.from({ length: Wv }, (_, x) => Array.from({ length: Hv }, (_, y) => B(x, y)));
  const sGrid = Array.from({ length: Dv }, (_, z) => Array.from({ length: Hv }, (_, y) => S(z, y)));
  // 每一行的横截面不是长方形：按这一行正面、侧面剪影的范围套一个圆角的超椭圆，头发不会雕成两片「翅膀」。
  const extent = (grid: { cover: number }[][], n: number, y: number) => {
    let lo = n;
    let hi = -1;
    for (let i = 0; i < n; i++)
      if (grid[i][y].cover > TH) {
        lo = Math.min(lo, i);
        hi = Math.max(hi, i);
      }
    return hi < lo ? null : { c: (lo + hi) / 2, r: (hi - lo) / 2 + 0.5 };
  };
  const rowX = Array.from({ length: Hv }, (_, y) => extent(fGrid, Wv, y));
  const rowZ = Array.from({ length: Hv }, (_, y) => extent(sGrid, Dv, y));
  const ROUND = 2.6;
  const inside = (x: number, y: number, z: number) => {
    const ex = rowX[y];
    const ez = rowZ[y];
    if (!ex || !ez) return false;
    return Math.abs((x - ex.c) / ex.r) ** ROUND + Math.abs((z - ez.c) / ez.r) ** ROUND <= 1.08;
  };
  const filled = (x: number, y: number, z: number) =>
    x >= 0 && y >= 0 && z >= 0 && x < Wv && y < Hv && z < Dv && fGrid[x][y].cover > TH && bGrid[x][y].cover > TH && sGrid[z][y].cover > TH && inside(x, y, z);

  const voxels: number[] = [];
  for (let x = 0; x < Wv; x++)
    for (let y = 0; y < Hv; y++)
      for (let z = 0; z < Dv; z++) {
        if (!filled(x, y, z)) continue;
        const pz = !filled(x, y, z + 1);
        const nz = !filled(x, y, z - 1);
        const px = !filled(x + 1, y, z) || !filled(x - 1, y, z);
        const py = !filled(x, y + 1, z) || !filled(x, y - 1, z);
        if (!pz && !nz && !px && !py) continue; // 埋在里面的不画
        // 正面露出来的取正面图；背面露出来的取背面图；侧面取侧面图；只露顶的：靠前一半取正面，靠后一半取背面。
        const ci = pz ? fGrid[x][y].ci : nz ? bGrid[x][y].ci : px ? sGrid[z][y].ci : z >= Dv / 2 ? fGrid[x][y].ci : bGrid[x][y].ci;
        voxels.push(x, y, z, ci);
      }
  const hex = pal.map((c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""));
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify({ size: [Wv, Hv, Dv], front: H, palette: hex, voxels }));
  console.log(id, { size: [Wv, Hv, Dv], surface: voxels.length / 4, views: [front, side, back].map((v) => [v.x0, v.x1, v.y0, v.y1]) });
}
