// PROTOTYPE（prototype/landing-memory-3d）：把混元 3D 生成的 GLB 转成体素小人。
// 每个三角面取顶点、边中点和重心几个采样点，落进体素网格；颜色按贴图坐标从底色贴图上取，收进调色板后按格子投票。
// 用法：node scripts/_proto-glb-voxelize.mts [高度体素数，默认 64]
// 输入：../.scratch/_refs/tripo/<id>.glb；输出：public/prototype-memory/voxels-hy/<id>.json（格式同 _proto-voxelize.mts）

import { mkdirSync, writeFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

const H = Number(process.argv[2] ?? 64);
const OUT = `public/prototype-memory/voxels-hy${H === 64 ? "" : H}`;
mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function quatApply(q: number[], v: number[]) {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

function kmeans(samples: number[][], k: number) {
  let centers = Array.from({ length: k }, (_, j) => samples[Math.floor(((j + 0.5) / k) * samples.length)]);
  const near = (c: number[]) => {
    let best = 0;
    let bd = Infinity;
    centers.forEach((p, j) => {
      const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
      if (d < bd) [best, bd] = [j, d];
    });
    return best;
  };
  for (let it = 0; it < 14; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      const j = near(s);
      acc[j][0] += s[0];
      acc[j][1] += s[1];
      acc[j][2] += s[2];
      acc[j][3]++;
    }
    centers = acc.map((a, j) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : centers[j]));
  }
  return { centers: centers.map((c) => c.map(Math.round)), near };
}

for (const id of (process.env.ONLY ?? "mano,kaho,fuyuko,kiriko").split(",")) {
  const doc = await io.read(`../.scratch/_refs/tripo/${id}.glb`);
  const root = doc.getRoot();
  const node = root.listNodes().find((n) => n.getMesh())!;
  const prim = node.getMesh()!.listPrimitives()[0];
  const q = node.getRotation();
  const pos = prim.getAttribute("POSITION")!;
  const uv = prim.getAttribute("TEXCOORD_0")!;
  const idx = prim.getIndices();
  const tex = prim.getMaterial()!.getBaseColorTexture()!;
  const { data: img, info } = await sharp(Buffer.from(tex.getImage()!)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const color = (u: number, v: number) => {
    const x = Math.min(info.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * info.width)));
    const y = Math.min(info.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * info.height)));
    const i = (y * info.width + x) * 3;
    return [img[i], img[i + 1], img[i + 2]];
  };

  // 顶点转到世界坐标（节点只有旋转）。
  const n = pos.getCount();
  const P = new Float32Array(n * 3);
  const UV = new Float32Array(n * 2);
  const tmp: number[] = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const w = quatApply(q, pos.getElement(i, tmp).slice());
    P.set(w, i * 3);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], w[k]);
      max[k] = Math.max(max[k], w[k]);
    }
    UV.set(uv.getElement(i, tmp).slice(0, 2), i * 2);
  }
  const s = (max[1] - min[1]) / H;
  const W = Math.ceil((max[0] - min[0]) / s) + 2;
  const Hv = H + 1;
  const D = Math.ceil((max[2] - min[2]) / s) + 2;
  const cell = (p: number[]) => [Math.floor((p[0] - min[0]) / s) + 1, Math.min(H, Math.floor((p[1] - min[1]) / s)), Math.floor((p[2] - min[2]) / s) + 1];

  // 采样：按三角面的大小细分，每个小三角取重心，采样间距不超过半个体素（大三角面只取固定几个点会漏，
  // 平的地方三角面大，后脑的头发就漏出一个个洞，透出里面的暗色）。只取三角面里面的点，不取边上的：
  // 贴图上 UV 岛之间是填充色，取在边上会采到它。
  const tris = idx ? idx.getCount() / 3 : n / 3;
  const vi = (t: number, k: number) => (idx ? idx.getScalar(t * 3 + k) : t * 3 + k);
  const samples: { key: number; c: number[] }[] = [];
  const dist = (i: number, j: number) => Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]);
  for (let t = 0; t < tris; t++) {
    const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
    const m = Math.max(1, Math.ceil(Math.max(dist(a, b), dist(b, c), dist(c, a)) / (s * 0.5)));
    const sample = (u: number, v: number) => {
      const wa = 1 - u - v, wb = u, wc = v;
      const p = [0, 1, 2].map((k) => P[a * 3 + k] * wa + P[b * 3 + k] * wb + P[c * 3 + k] * wc);
      const tu = UV[a * 2] * wa + UV[b * 2] * wb + UV[c * 2] * wc;
      const tv = UV[a * 2 + 1] * wa + UV[b * 2 + 1] * wb + UV[c * 2 + 1] * wc;
      const [x, y, z] = cell(p);
      samples.push({ key: (x * Hv + y) * D + z, c: color(tu, tv) });
    };
    for (let i = 0; i < m; i++)
      for (let j = 0; i + j < m; j++) {
        sample((i + 1 / 3) / m, (j + 1 / 3) / m);
        if (i + j < m - 1) sample((i + 2 / 3) / m, (j + 2 / 3) / m);
      }
  }
  const pal = kmeans(samples.filter((_, i) => i % 13 === 0).map((s) => s.c), 32);
  // 每个格子的颜色：加权投票，和这个格子平均色差得越远的采样票越重。只按票数，眼睛、睫毛、嘴这些小而对比强的
  // 特征会被大片的肤色吞掉；加了权它们才留得下来。
  const groups = new Map<number, number[][]>();
  for (const smp of samples) {
    let g = groups.get(smp.key);
    if (!g) groups.set(smp.key, (g = []));
    g.push(smp.c);
  }
  const votes = new Map<number, Map<number, number>>();
  for (const [key, cs] of groups) {
    const mean = [0, 1, 2].map((k) => cs.reduce((a, c) => a + c[k], 0) / cs.length);
    const m = new Map<number, number>();
    for (const c of cs) {
      const d = Math.hypot(c[0] - mean[0], c[1] - mean[1], c[2] - mean[2]);
      const w = 1 + 6 * (d / 120) ** 1.5;
      const j = pal.near(c);
      m.set(j, (m.get(j) ?? 0) + w);
    }
    votes.set(key, m);
  }
  // —— 着色：从 6 个方向把模型正交渲染成高分辨率的颜色和深度图（每个体素 SS×SS 个像素），每个体素按它露在外面的面，
  // 从那个方向的图上取颜色，只取深度正好落在这个体素上的像素：体素表面就是从外面真正看得到的样子。
  // 只按表面采样投票时，一个格子里会混进鼻梁侧面、刘海背面、模型内部这些看不见的面，脸上的细节被冲淡。
  const SS = 6;
  const VX = new Float32Array(n), VY = new Float32Array(n), VZ = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    VX[i] = (P[i * 3] - min[0]) / s + 1;
    VY[i] = Math.min(H, (P[i * 3 + 1] - min[1]) / s);
    VZ[i] = (P[i * 3 + 2] - min[2]) / s + 1;
  }
  type View = { axis: 0 | 1 | 2; sign: 1 | -1; uw: number; vw: number; depth: Float32Array; color: Uint8Array };
  const dims = [W, Hv, D];
  const views: View[] = [];
  for (const axis of [0, 1, 2] as const)
    for (const sign of [1, -1] as const) {
      const [ua, va] = axis === 0 ? [2, 1] : axis === 1 ? [0, 2] : [0, 1];
      const uw = dims[ua] * SS, vw = dims[va] * SS;
      views.push({ axis, sign, uw, vw, depth: new Float32Array(uw * vw).fill(NaN), color: new Uint8Array(uw * vw * 3) });
    }
  const coord = [VX, VY, VZ];
  for (let t = 0; t < tris; t++) {
    const tri = [vi(t, 0), vi(t, 1), vi(t, 2)];
    for (const v of views) {
      const [ua, va] = v.axis === 0 ? [2, 1] : v.axis === 1 ? [0, 2] : [0, 1];
      const u = tri.map((i) => coord[ua][i] * SS), w = tri.map((i) => coord[va][i] * SS), d = tri.map((i) => coord[v.axis][i]);
      const area = (u[1] - u[0]) * (w[2] - w[0]) - (w[1] - w[0]) * (u[2] - u[0]);
      if (Math.abs(area) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor(Math.min(...u))), x1 = Math.min(v.uw - 1, Math.ceil(Math.max(...u)));
      const y0 = Math.max(0, Math.floor(Math.min(...w))), y1 = Math.min(v.vw - 1, Math.ceil(Math.max(...w)));
      for (let yy = y0; yy <= y1; yy++)
        for (let xx = x0; xx <= x1; xx++) {
          const sx = xx + 0.5, sy = yy + 0.5;
          const b0 = ((u[1] - sx) * (w[2] - sy) - (w[1] - sy) * (u[2] - sx)) / area;
          const b1 = ((u[2] - sx) * (w[0] - sy) - (w[2] - sy) * (u[0] - sx)) / area;
          const b2 = 1 - b0 - b1;
          if (b0 < 0 || b1 < 0 || b2 < 0) continue;
          const dd = b0 * d[0] + b1 * d[1] + b2 * d[2];
          const k = yy * v.uw + xx;
          const cur = v.depth[k];
          if (!Number.isNaN(cur) && (dd - cur) * v.sign <= 0) continue;
          v.depth[k] = dd;
          const [a, b, c] = tri;
          const c3 = color(UV[a * 2] * b0 + UV[b * 2] * b1 + UV[c * 2] * b2, UV[a * 2 + 1] * b0 + UV[b * 2 + 1] * b1 + UV[c * 2 + 1] * b2);
          v.color.set(c3, k * 3);
        }
    }
  }
  if (process.env.DUMP) {
    const v = views.find((v) => v.axis === 2 && v.sign === (process.env.DUMP === "back" ? -1 : 1))!;
    const flipped = Buffer.alloc(v.uw * v.vw * 3);
    for (let r = 0; r < v.vw; r++) flipped.set(v.color.subarray((v.vw - 1 - r) * v.uw * 3, (v.vw - r) * v.uw * 3), r * v.uw * 3);
    await sharp(flipped, { raw: { width: v.uw, height: v.vw, channels: 3 } }).png().toFile(`../.scratch/_accept/view-${process.env.DUMP === "back" ? "back" : "front"}-${id}.png`);
  }
  // 皮肤：亮、暖（红明显高于蓝），绿不比红低太多。雾子的灰紫头发、真乃的浅棕头发都不算。
  const isSkin = (c: number[]) => c[0] > 200 && c[0] - c[2] >= 15 && c[1] / c[0] >= 0.82 && c[1] >= c[2] - 5;
  const palette: string[] = [];
  const paletteIndex = new Map<string, number>();
  const colorIndex = (c: number[]) => {
    const hex = "#" + c.map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0")).join("");
    let i = paletteIndex.get(hex);
    if (i === undefined) {
      i = palette.length;
      palette.push(hex);
      paletteIndex.set(hex, i);
    }
    return i;
  };
  const occupied = new Set(votes.keys());
  const has = (x: number, y: number, z: number) => occupied.has((x * Hv + y) * D + z);
  // 填小坑和细缝：空格子六个面里至少四面挨着实心的，填上；腰以上（头发）再加一条：左右（或前后）两边两格之内
  // 都是实心的，也填上。头发发束之间的细缝在网格上又深又窄，看进去是模型里面的暗色，不填就是一个个黑点。
  const solidWithin2 = (x: number, y: number, z: number, ax: number, az: number) =>
    (has(x + ax, y, z + az) || has(x + 2 * ax, y, z + 2 * az)) && (has(x - ax, y, z - az) || has(x - 2 * ax, y, z - 2 * az));
  for (let pass = 0; pass < 3; pass++) {
    const add: number[] = [];
    for (const key of occupied) {
      const z = key % D;
      const y = Math.floor(key / D) % Hv;
      const x = Math.floor(key / D / Hv);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const ex = x + dx, ey = y + dy, ez = z + dz;
        if (ex < 0 || ey < 0 || ez < 0 || ex >= W || ey >= Hv || ez >= D || has(ex, ey, ez)) continue;
        const around = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].filter(([ax, ay, az]) => has(ex + ax, ey + ay, ez + az)).length;
        const slot = ey > H * 0.45 && (solidWithin2(ex, ey, ez, 1, 0) || solidWithin2(ex, ey, ez, 0, 1));
        if (around >= 4 || slot) add.push((ex * Hv + ey) * D + ez);
      }
    }
    for (const k of add) occupied.add(k);
  }
  let vox: [number, number, number, number][] = [];
  let fromViews = 0;
  for (const key of occupied) {
    const z = key % D;
    const y = Math.floor(key / D) % Hv;
    const x = Math.floor(key / D / Hv);
    const p3 = [x, y, z];
    // 这个体素看得见的那些像素：按 4 位一档分桶，取票最重的那一桶的平均色（脸上另有加权，见下）。不用全身统一的小调色板：眼睛的颜色在里面没有自己的一格，会被并进肤色。
    const px: number[][] = [];
    for (const v of views) {
      const q = [...p3];
      q[v.axis] += v.sign;
      if (has(q[0], q[1], q[2])) continue; // 这一面朝着别的体素，看不见
      const [ua, va] = v.axis === 0 ? [2, 1] : v.axis === 1 ? [0, 2] : [0, 1];
      for (let j = 0; j < SS; j++)
        for (let i = 0; i < SS; i++) {
          const k = (p3[va] * SS + j) * v.uw + p3[ua] * SS + i;
          const dd = v.depth[k];
          if (Number.isNaN(dd) || dd < p3[v.axis] - 0.5 || dd > p3[v.axis] + 1.5) continue;
          // 离这个体素朝外那一面越近的像素票越重：发束之间凹下去的缝更深，不该盖过表面。
          const outer = p3[v.axis] + (v.sign > 0 ? 1 : 0);
          const near = Math.exp(-Math.abs(dd - outer) * 1.5);
          px.push([v.color[k * 3], v.color[k * 3 + 1], v.color[k * 3 + 2], (v.axis === 1 ? 0.15 : 1) * near, v.axis * 2 + (v.sign > 0 ? 0 : 1)]);
        }
    }
    let rgb: number[];
    if (px.length) {
      fromViews++;
      const mean = [0, 1, 2].map((c) => px.reduce((a, p) => a + p[c], 0) / px.length);
      // 头上皮肤的格子（脸）：比皮肤暗的像素（睫毛、瞳孔、嘴）票数大幅加重。缩小以后一只眼睛只剩两三格，
      // 不加重的话瞳孔、睫毛会和肤色平均掉，脸就空了（像素画缩图的老办法：缩小时夸张五官）。
      const skinLike = y > H * 0.66 && isSkin(mean);
      const lum = (p: number[]) => 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2];
      const meanL = lum(mean);
      const buckets = new Map<number, { w: number; sum: number[]; n: number }>();
      for (const p of px) {
        const b = (p[0] >> 4) * 256 + (p[1] >> 4) * 16 + (p[2] >> 4);
        const d = Math.hypot(p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]);
        const e = buckets.get(b) ?? { w: 0, sum: [0, 0, 0], n: 0 };
        // 只有脸上加权；头发、衣服按多数，不然贴图里的描线会被投成一个个深色点。
        // 从正上方、正下方看会看进发束之间的缝，看到模型里面没画好的颜色：这两个方向的像素只算一小票。
        // 头发、衣服上稍微偏向亮一点的颜色：贴图里画的描线、发束间的暗线，体素小人用不着。
        e.w += p[3] * (skinLike ? 1 + 4 * (d / 120) ** 1.5 + 25 * (Math.max(0, meanL - lum(p) - 20) / 100) ** 1.2 : Math.max(0.35, 1 + (lum(p) - meanL) / 80));
        e.sum[0] += p[0];
        e.sum[1] += p[1];
        e.sum[2] += p[2];
        e.n++;
        buckets.set(b, e);
      }
      let best = { w: -1, sum: [0, 0, 0], n: 1 };
      for (const e of buckets.values()) if (e.w > best.w) best = e;
      rgb = best.sum.map((c) => Math.round(c / best.n));
      if (process.env.DEBUGV && y > H * 0.7 && z < D * 0.35 && 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2] < 120 && Math.random() < 0.3) {
        const byView = new Map<number, number>();
        for (const p of px) byView.set(p[4], (byView.get(p[4]) ?? 0) + 1);
        console.log("dark", [x, y, z], rgb, "views(+x,-x,+y,-y,+z,-z):", [...byView.entries()].sort().map(([k, c]) => ["+x", "-x", "+y", "-y", "+z", "-z"][k] + "=" + c).join(" "));
      }
    } else {
      // 先空着（-1），下面从周围有颜色的格子借。
      vox.push([x, y, z, -1]);
      continue;
    }
    vox.push([x, y, z, colorIndex(rgb)]);
  }
  // 6 个方向都没取到颜色的格子（表面比这一格深一点，落在深度窗口外）：从周围已经有颜色的格子里取最多的那种，
  // 一圈圈往里传。不再用表面采样的投票：那会把贴图里的描线投成深色点。
  for (let pass = 0; pass < 6; pass++) {
    const at = new Map<number, number>();
    for (const [x, y, z, ci] of vox) if (ci >= 0) at.set((x * Hv + y) * D + z, ci);
    let left = 0;
    vox = vox.map(([x, y, z, ci]) => {
      if (ci >= 0) return [x, y, z, ci];
      const count = new Map<number, number>();
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const c = at.get(((x + dx) * Hv + y + dy) * D + z + dz);
            if (c !== undefined) count.set(c, (count.get(c) ?? 0) + 1);
          }
      let best = -1;
      let bc = 0;
      for (const [c, k] of count) if (k > bc) [best, bc] = [c, k];
      if (best < 0) left++;
      return [x, y, z, best];
    });
    if (!left) break;
  }
  for (const v of vox) {
    if (v[3] >= 0) continue;
    let ci = 0;
    let bv = -1;
    for (const [j, c] of votes.get((v[0] * Hv + v[1]) * D + v[2]) ?? []) if (c > bv) [ci, bv] = [j, c];
    v[3] = colorIndex(pal.centers[ci]);
  }
  console.log(id, "colored from views", fromViews, "/", votes.size);

  // 混元 3D 导出的模型都是脸朝 +z，不用翻。
  // 去杂点（脸除外）：一个格子周围 26 格里没有一格和它颜色相近、而周围有至少 5 格彼此相近，就换成那种颜色。
  // 头发发束之间的暗缝会让个别格子投成深色。脸不碰：眼睛里睫毛、瞳孔、高光颜色各不相同，一碰就抹成肤色。
  {
    const rgbOf = (i: number) => [1, 3, 5].map((k) => parseInt(palette[i].slice(k, k + 2), 16));
    const near = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 40;
    const skinish = isSkin;
    // 只和表面上的格子比：里面一层看不见，常常也是暗的，会让表面上的杂点看起来「有同伴」。
    const exposed = ([x, y, z]: number[]) => !has(x + 1, y, z) || !has(x - 1, y, z) || !has(x, y + 1, z) || !has(x, y - 1, z) || !has(x, y, z + 1) || !has(x, y, z - 1);
    const at = new Map<number, number>();
    for (const v of vox) if (exposed(v)) at.set((v[0] * Hv + v[1]) * D + v[2], v[3]);
    let changed = 0;
    vox = vox.map(([x, y, z, ci]) => {
      if (!at.has((x * Hv + y) * D + z)) return [x, y, z, ci];
      const own = rgbOf(ci);
      const ns: number[][] = [];
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            if (!dx && !dy && !dz) continue;
            const c = at.get(((x + dx) * Hv + y + dy) * D + z + dz);
            if (c !== undefined) ns.push(rgbOf(c));
          }
      if (ns.some((n) => near(n, own))) return [x, y, z, ci];
      let best: number[] | null = null;
      let bc = 0;
      for (const n of ns) {
        const k = ns.filter((m) => near(m, n)).length;
        if (k > bc) [best, bc] = [n, k];
      }
      if (!best || bc < 5 || (y > H * 0.6 && skinish(best))) return [x, y, z, ci];
      changed++;
      return [x, y, z, colorIndex(best)];
    });
    console.log(id, "despeckled", changed);
  }


  writeFileSync(`${OUT}/${id}.json`, JSON.stringify({ size: [W, Hv, D], front: H, palette, voxels: vox.flat() }));
  console.log(id, { tris, size: [W, Hv, D], voxels: vox.length });
}
