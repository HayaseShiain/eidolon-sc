// PROTOTYPE：用代码「捏」体素小人（第四轮）。只在 prototype/landing-memory-3d 分支，不进 main。
// 形状是设计出来的，不是从图上算出来的：在体素网格里用圆角方块、椭球、胶囊、锥台加和挖，再改颜色、贴像素画。
// 三视图只当参考看。身体分成几个部件（身子、头、左右手臂），各自绕关节点转，手臂能动。
// 坐标：体素中心在整数格上；y 从地面往上，+x 是她的左手边（正面看在右边），+z 是她的正面。

import * as THREE from "three";

import { disposeTree, lift, shadowBlob, type Figure } from "./figures";

export type V3 = [number, number, number];
export type Shape = { min: V3; max: V3; inside: (x: number, y: number, z: number) => boolean };
export type Paint = string | ((x: number, y: number, z: number) => string);

// —— 形体。

export const box = (a: V3, b: V3): Shape => ({
  min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
  max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  inside: () => true,
});

/** 超椭球：p=2 是椭球，越大越方。 */
export const blob = (c: V3, r: V3, p = 2): Shape => ({
  min: [c[0] - r[0], c[1] - r[1], c[2] - r[2]],
  max: [c[0] + r[0], c[1] + r[1], c[2] + r[2]],
  inside: (x, y, z) => Math.abs((x - c[0]) / r[0]) ** p + Math.abs((y - c[1]) / r[1]) ** p + Math.abs((z - c[2]) / r[2]) ** p <= 1,
});

/** 胶囊：a 到 b 的线段，半径从 ra 渐变到 rb。 */
export const capsule = (a: V3, b: V3, ra: number, rb = ra): Shape => {
  const r = Math.max(ra, rb);
  const ab = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len2 = ab.lengthSq();
  return {
    min: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r],
    max: [Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
    inside: (x, y, z) => {
      const t = Math.min(1, Math.max(0, ((x - a[0]) * ab.x + (y - a[1]) * ab.y + (z - a[2]) * ab.z) / len2));
      const px = a[0] + ab.x * t - x;
      const py = a[1] + ab.y * t - y;
      const pz = a[2] + ab.z * t - z;
      const rr = ra + (rb - ra) * t;
      return px * px + py * py + pz * pz <= rr * rr;
    },
  };
};

/** 竖着的锥台：底面 y0 半径 (rx0, rz0)，顶面 y1 半径 (rx1, rz1)，横截面是超椭圆。 */
export const frustum = (cx: number, cz: number, y0: number, y1: number, r0: [number, number], r1: [number, number], p = 2): Shape => {
  const rx = Math.max(r0[0], r1[0]);
  const rz = Math.max(r0[1], r1[1]);
  return {
    min: [cx - rx, y0, cz - rz],
    max: [cx + rx, y1, cz + rz],
    inside: (x, y, z) => {
      const t = (y - y0) / (y1 - y0);
      const ax = r0[0] + (r1[0] - r0[0]) * t;
      const az = r0[1] + (r1[1] - r0[1]) * t;
      return Math.abs((x - cx) / ax) ** p + Math.abs((z - cz) / az) ** p <= 1;
    },
  };
};

/** 形体再加一个条件。 */
export const where = (s: Shape, pred: (x: number, y: number, z: number) => boolean): Shape => ({ ...s, inside: (x, y, z) => s.inside(x, y, z) && pred(x, y, z) });

// —— 部件。

export class Part {
  readonly vox = new Map<string, { p: V3; c: string }>();
  constructor(readonly pivot: V3) {}
  private each(s: Shape, f: (x: number, y: number, z: number, key: string) => void) {
    for (let x = Math.floor(s.min[0]); x <= Math.ceil(s.max[0]); x++)
      for (let y = Math.floor(s.min[1]); y <= Math.ceil(s.max[1]); y++)
        for (let z = Math.floor(s.min[2]); z <= Math.ceil(s.max[2]); z++) if (s.inside(x, y, z)) f(x, y, z, `${x},${y},${z}`);
  }
  add(s: Shape, paint: Paint) {
    this.each(s, (x, y, z, k) => this.vox.set(k, { p: [x, y, z], c: typeof paint === "string" ? paint : paint(x, y, z) }));
    return this;
  }
  /** 只填空着的格子（先做的东西不被盖掉）。 */
  fill(s: Shape, paint: Paint) {
    this.each(s, (x, y, z, k) => {
      if (!this.vox.has(k)) this.vox.set(k, { p: [x, y, z], c: typeof paint === "string" ? paint : paint(x, y, z) });
    });
    return this;
  }
  carve(s: Shape) {
    this.each(s, (_x, _y, _z, k) => this.vox.delete(k));
    return this;
  }
  /** 只改已有体素的颜色。 */
  paint(s: Shape, paint: Paint) {
    this.each(s, (x, y, z, k) => {
      const v = this.vox.get(k);
      if (v) v.c = typeof paint === "string" ? paint : paint(x, y, z);
    });
    return this;
  }
  /** 贴一张像素画：每一列从前往后（dir=+1 时从 +z 那边）找到第一个体素，改成画上的颜色。`.` 不贴。 */
  decal(rows: string[], pal: Record<string, string>, x0: number, yTop: number, dir: 1 | -1 = 1) {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch === ".") return;
        const x = x0 + i;
        const y = yTop - j;
        let best: { p: V3; c: string } | null = null;
        for (const v of this.vox.values()) if (v.p[0] === x && v.p[1] === y && (!best || (v.p[2] - best.p[2]) * dir > 0)) best = v;
        if (best) best.c = pal[ch] ?? "#ff00ff";
      }),
    );
    return this;
  }
}

/** 左右各做一次：s=-1 是她的右手边（正面看在左边），s=1 是左手边。 */
export const both = (f: (s: 1 | -1) => void) => {
  f(-1);
  f(1);
};

// —— 拼成会动的小人。

export type Model = {
  /** 脚底到头顶（不算头上的东西）有多少格：按它定体素大小，几个人一样高。 */
  height: number;
  body: Part;
  head: Part;
  armL: Part;
  armR: Part;
  /** 两臂平时的姿势：[绕 x, 绕 z]。 */
  pose?: { l: [number, number]; r: [number, number] };
};

const HEIGHT = 1.6;

function partMesh(part: Part, size: number) {
  const cube = new THREE.BoxGeometry(size, size, size);
  const normals = cube.getAttribute("normal");
  const shade = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const k = normals.getY(i) > 0.5 ? 0.85 : normals.getY(i) < -0.5 ? 0.6 : 1;
    shade.set([k, k, k], i * 3);
  }
  cube.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  const solid = (x: number, y: number, z: number) => part.vox.has(`${x},${y},${z}`);
  const surface = [...part.vox.values()].filter(({ p: [x, y, z] }) => !solid(x + 1, y, z) || !solid(x - 1, y, z) || !solid(x, y + 1, z) || !solid(x, y - 1, z) || !solid(x, y, z + 1) || !solid(x, y, z - 1));
  const mesh = new THREE.InstancedMesh(cube, lift(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.22), surface.length);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  surface.forEach(({ p, c }, n) => {
    m.makeTranslation((p[0] - part.pivot[0]) * size, (p[1] - part.pivot[1]) * size, (p[2] - part.pivot[2]) * size);
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, color.set(c));
  });
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.position.set(part.pivot[0] * size, part.pivot[1] * size, part.pivot[2] * size);
  g.add(mesh);
  return g;
}

export function sculptFigure(model: Model): Figure {
  const size = HEIGHT / model.height;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  group.add(shadowBlob(0.42));
  body.add(partMesh(model.body, size));
  const head = partMesh(model.head, size);
  body.add(head);
  const arms = [partMesh(model.armR, size), partMesh(model.armL, size)];
  arms.forEach((a) => body.add(a));
  const pose = model.pose ?? { l: [0, 0], r: [0, 0] };
  const base = [pose.r, pose.l];
  return {
    group,
    aim(_camAz, yaw) {
      body.rotation.y = yaw;
    },
    update(time, hop, up) {
      head.rotation.z = Math.sin(time * 1.3) * 0.04;
      head.rotation.x = Math.sin(time * 0.9) * 0.025;
      body.position.y = Math.abs(Math.sin(time * 1.8)) * 0.006;
      arms.forEach((a, k) => {
        const [bx, bz] = base[k];
        a.rotation.x = bx * (1 - up) - up * 2.5 + Math.sin(time * 1.8 + k * Math.PI) * 0.05;
        a.rotation.z = bz * (1 - up) + (k ? 1 : -1) * hop * 0.8;
      });
    },
    dispose: () => disposeTree(group),
  };
}
