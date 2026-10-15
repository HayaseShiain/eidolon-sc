// PROTOTYPE：第 5 幕 3D 场景里的四位角色，三种做法。只在 prototype/landing-memory-3d 分支，不进 main。
// - voxel：我的世界式的方块小人，按 Q 版图手配颜色、手画脸。
// - pixel：Q 版图缩成像素画、每个像素挤成一块小方块（像我的世界里拿在手上的物品），加一圈描边。
// - paper：原图做成一块亚克力立牌：白边、白背面、透明底座。
// 三种都站在原点、脚底 y=0、正面朝 +z。

import * as THREE from "three";

import { MODELS } from "./models";
import { sculptFigure } from "./sculpt";
import { voxelHd } from "./voxel";

export type Style = "hunyuan" | "hunyuan-80" | "hunyuan-64" | "sculpt" | "carved" | "voxel" | "voxel-lo" | "pixel" | "paper";

export type Figure = {
  group: THREE.Group;
  /** camAz：镜头的方位角；yaw：她要朝的方向（平时等于 camAz，传话时转向对方）。 */
  aim(camAz: number, yaw: number): void;
  /** hop：收到时跳一下（0–1 的鼓包）；up：举手接住（0–1）。 */
  update(time: number, hop: number, up: number): void;
  dispose(): void;
};

const HEIGHT = 1.6;

export async function buildFigure(style: Style, id: string): Promise<Figure> {
  if (style === "hunyuan") return carvedFigure(id, "voxels-hy96");
  if (style === "hunyuan-80") return carvedFigure(id, "voxels-hy80");
  if (style === "hunyuan-64") return carvedFigure(id, "voxels-hy");
  if (style === "sculpt") return MODELS[id] ? sculptFigure(MODELS[id]()) : carvedFigure(id);
  if (style === "carved") return carvedFigure(id);
  if (style === "voxel") return voxelHd(id);
  if (style === "voxel-lo") return voxelFigure(id);
  const img = await loadImage(`/prototype-memory/${id}.png`);
  return style === "pixel" ? pixelFigure(img) : paperFigure(img);
}

// ———————————————————————————————— 共用

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

/** 图里不透明部分的外框。 */
function cropOf(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 40) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function shadowBlob(radius: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(10,6,24,0.55)");
  grad.addColorStop(1, "rgba(10,6,24,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  return m;
}

/** 角色自己亮一点：夜色的紫光下肤色发灰。在自发光里加上一份自己的底色。 */
export function lift<M extends THREE.Material>(m: M, k = 0.45): M {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
 totalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(2)};`);
  };
  return m;
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        (m as THREE.MeshBasicMaterial).map?.dispose();
        m.dispose();
      }
    }
  });
}

// ———————————————————————————————— 方块小人

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;
type Spec = {
  hair: string;
  hairDark: string;
  skin: string;
  eye: string;
  top: string;
  topFront?: Draw;
  sleeve: string;
  cuff?: string;
  skirt: string;
  skirtFront?: Draw;
  skirtWide: boolean;
  leg: Draw;
  /** 后面的头发往下垂几个像素（从下巴算）。 */
  hairLen: number;
  extras?: (add: (w: number, h: number, d: number, x: number, y: number, z: number, color: string) => THREE.Mesh) => void;
  face?: Draw;
};

const P = HEIGHT / 23; // 一个像素多大：脚到头顶 21 像素，加头上的东西

const px = (g: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
};
const plaid = (base: string, line: string, line2: string): Draw => (g, w, h) => {
  px(g, base, 0, 0, w, h);
  for (let x = 1; x < w; x += 3) px(g, line, x, 0, 1, h);
  for (let y = 1; y < h; y += 2) px(g, line2, 0, y, w, 1);
};
const legOf = (skin: string, sock: string, shoe: string, sockFrom: number, shoeAccent?: string): Draw => (g, w, h) => {
  px(g, skin, 0, 0, w, h);
  px(g, sock, 0, sockFrom, w, h - sockFrom - 1);
  px(g, shoe, 0, h - 1, w, 1);
  if (shoeAccent) px(g, shoeAccent, 0, h - 1, 1, 1);
};

const SPECS: Record<string, Spec> = {
  mano: {
    hair: "#ecb98f",
    hairDark: "#c98f68",
    skin: "#fde7da",
    eye: "#8c5a45",
    top: "#2c3352",
    topFront: (g, w) => {
      px(g, "#f3f3f6", 0, 0, w, 1);
      px(g, "#f3f3f6", 1, 1, w - 2, 1);
      px(g, "#7cc7cd", 2, 1, 2, 2);
      px(g, "#4f9fae", 2, 2, 2, 1);
    },
    sleeve: "#2c3352",
    cuff: "#f3f3f6",
    skirt: "#a9d4e0",
    skirtFront: plaid("#b9dde7", "#5aa6b8", "#eef7fa"),
    skirtWide: true,
    leg: legOf("#fde7da", "#f6f6f8", "#7a4a2e", 2),
    hairLen: 2,
    extras: (add) => {
      // 头上的小白鸽。
      add(4, 3, 5, 0, 22.5, 0, "#fbfbff");
      add(2, 2, 2, 0, 24.5, 2, "#fbfbff");
      add(1, 1, 1, 0, 24.5, 3.5, "#f2a64a");
      add(3, 1, 2, 0, 22.5, -3, "#e6e6f0");
    },
  },
  kaho: {
    hair: "#cd5563",
    hairDark: "#a23b4c",
    skin: "#fde7da",
    eye: "#c74c58",
    top: "#f7f5f2",
    topFront: (g) => {
      px(g, "#f2a33a", 2, 2, 2, 2);
      px(g, "#7cc6d0", 3, 1, 1, 1);
    },
    sleeve: "#7cc6d0",
    skirt: "#b9566a",
    skirtFront: plaid("#c4606f", "#f3e6ea", "#8d3a4c"),
    skirtWide: false,
    leg: legOf("#fde7da", "#2a2a30", "#d54b4b", 3, "#ffffff"),
    hairLen: 8,
    extras: (add) => {
      // 系在腰上的橙色外套，和一根呆毛。
      add(8, 2, 6, 0, 6, 0, "#f2a33a");
      add(2, 4, 1, -2.5, 3.5, 3, "#f2a33a");
      add(2, 4, 1, 2.5, 3.5, 3, "#f2a33a");
      add(1, 2, 1, 0.5, 22, 1, "#cd5563");
    },
  },
  fuyuko: {
    hair: "#2c2d3e",
    hairDark: "#1a1a27",
    skin: "#fde9de",
    eye: "#d46c7d",
    top: "#f4bccb",
    topFront: (g, w) => {
      px(g, "#26242c", 2, 0, 2, 1);
      px(g, "#26242c", 0, 3, w, 2);
      px(g, "#5a5560", 1, 3, 1, 2);
      px(g, "#5a5560", 4, 3, 1, 2);
    },
    sleeve: "#f4bccb",
    skirt: "#232229",
    skirtWide: true,
    leg: legOf("#fde9de", "#4c3b3e", "#1d1b22", 1),
    hairLen: 10,
    extras: (add) => {
      // 两侧的发髻。
      add(3, 3, 3, -4, 21, -1, "#2c2d3e");
      add(3, 3, 3, 4, 21, -1, "#2c2d3e");
    },
  },
  kiriko: {
    hair: "#a7a3b4",
    hairDark: "#827d93",
    skin: "#fdeee6",
    eye: "#6c61a0",
    top: "#2f3f70",
    topFront: (g, w) => {
      px(g, "#f2f2f7", 0, 0, w, 1);
      px(g, "#f2f2f7", 2, 1, 2, 1);
      px(g, "#5c7fd6", 2, 1, 2, 1);
      px(g, "#1f2a4d", 0, 4, w, 1);
    },
    sleeve: "#f2f2f7",
    skirt: "#2f3f70",
    skirtWide: true,
    leg: (g, w, h) => {
      legOf("#fdeee6", "#f6f6f8", "#6e4430", 2)(g, w, h);
      px(g, "#ffffff", 0, 1, w, 1); // 腿上的绷带
      px(g, "#f1c7cf", 1, 1, 1, 1);
    },
    hairLen: 9,
    face: (g) => px(g, "#ffffff", 6, 3, 2, 1), // 额头的创可贴
    extras: (add) => {
      // 两束高马尾。
      add(3, 9, 3, -5.5, 15.5, -2.5, "#a7a3b4");
      add(3, 9, 3, 5.5, 15.5, -2.5, "#a7a3b4");
      add(2, 2, 2, -5, 21, -2, "#a7a3b4");
      add(2, 2, 2, 5, 21, -2, "#a7a3b4");
    },
  },
};

function voxelFigure(id: string): Figure {
  const s = SPECS[id];
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  group.add(shadowBlob(0.45));

  const faceTex = (w: number, h: number, draw: Draw) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!, w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return lift(new THREE.MeshLambertMaterial({ map: t }));
  };
  const fill = (color: string): Draw => (g, w, h) => px(g, color, 0, 0, w, h);
  /** 一块方块（像素尺寸），六个面各画各的：+x、-x、+y、-y、+z（正面）、-z。 */
  const box = (w: number, h: number, d: number, faces: { side?: Draw; sideR?: Draw; top?: Draw; bottom?: Draw; front?: Draw; back?: Draw }, all: Draw) => {
    const mats = [
      faceTex(d, h, faces.sideR ?? faces.side ?? all),
      faceTex(d, h, faces.side ?? all),
      faceTex(w, d, faces.top ?? all),
      faceTex(w, d, faces.bottom ?? all),
      faceTex(w, h, faces.front ?? all),
      faceTex(w, h, faces.back ?? all),
    ];
    return new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, d * P), mats);
  };
  const plain = new Map<string, THREE.MeshLambertMaterial>();
  const add = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) => {
    if (!plain.has(color)) plain.set(color, lift(new THREE.MeshLambertMaterial({ color })));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, d * P), plain.get(color)!);
    m.position.set(x * P, y * P, z * P);
    body.add(m);
    return m;
  };

  // 腿（0–5）、裙子、身子（5–11）、手臂、头（11–21）。
  for (const x of [-1, 1]) {
    const leg = box(2, 5, 2, {}, s.leg);
    leg.position.set(x * P, 2.5 * P, 0);
    body.add(leg);
  }
  const skirt = box(s.skirtWide ? 8 : 7, 3, s.skirtWide ? 6 : 5, { top: fill(s.top) }, s.skirtFront ?? fill(s.skirt));
  skirt.position.set(0, 5.5 * P, 0);
  body.add(skirt);
  const torso = box(6, 6, 4, { front: (g, w, h) => (fill(s.top)(g, w, h), s.topFront?.(g, w, h)) }, fill(s.top));
  torso.position.set(0, 8 * P, 0);
  body.add(torso);
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 4 * P, 10.5 * P, 0);
    const arm = box(2, 6, 2, {}, (g, w, h) => {
      px(g, s.sleeve, 0, 0, w, h);
      if (s.cuff) px(g, s.cuff, 0, h - 2, w, 1);
      px(g, s.skin, 0, h - 1, w, 1);
    });
    arm.position.set(0, -2.5 * P, 0);
    pivot.add(arm);
    body.add(pivot);
    arms.push(pivot);
  }
  const head = new THREE.Group();
  head.position.set(0, 11 * P, 0);
  body.add(head);
  const hairSide = (frontAtLeft: boolean): Draw => (g, w, h) => {
    px(g, s.hair, 0, 0, w, h);
    const fx = frontAtLeft ? 0 : w - 3;
    px(g, s.skin, fx, 4, 3, 5);
    px(g, s.hair, frontAtLeft ? 0 : w - 1, 4, 1, 6);
    px(g, s.hairDark, 0, h - 1, w, 1);
  };
  const headBox = box(
    10,
    10,
    10,
    {
      front: (g, w, h) => {
        px(g, s.skin, 0, 0, w, h);
        px(g, s.hair, 0, 0, w, 3);
        for (const x of [0, 1, 4, 5, 8, 9]) px(g, s.hair, x, 3, 1, 1);
        px(g, s.hair, 0, 3, 1, 7);
        px(g, s.hair, 9, 3, 1, 7);
        px(g, s.hairDark, 0, 9, 1, 1);
        px(g, s.hairDark, 9, 9, 1, 1);
        for (const x of [2, 6]) {
          px(g, "#2a1d2b", x, 5, 2, 1);
          px(g, s.eye, x, 6, 2, 1);
          px(g, "#ffffff", x, 6, 1, 1);
        }
        px(g, "#f6a9b4", 2, 7, 1, 1);
        px(g, "#f6a9b4", 7, 7, 1, 1);
        px(g, "#c46a6a", 4, 8, 2, 1);
        s.face?.(g, w, h);
      },
      side: hairSide(false),
      sideR: hairSide(true),
      back: (g, w, h) => (px(g, s.hair, 0, 0, w, h), px(g, s.hairDark, 0, h - 1, w, 1)),
      bottom: fill(s.skin),
    },
    fill(s.hair),
  );
  headBox.position.set(0, 5 * P, 0);
  head.add(headBox);
  if (s.hairLen > 0) {
    const back = box(10, s.hairLen + 2, 2, {}, (g, w, h) => (px(g, s.hair, 0, 0, w, h), px(g, s.hairDark, 0, h - 1, w, 1)));
    back.position.set(0, (-s.hairLen / 2 + 1) * P, -4.5 * P);
    head.add(back);
  }
  s.extras?.(add);

  let yaw = 0;
  return {
    group,
    aim(_camAz, y) {
      yaw = y;
      body.rotation.y = yaw;
    },
    update(time, hop, up) {
      head.rotation.z = Math.sin(time * 1.4) * 0.04;
      body.position.y = Math.abs(Math.sin(time * 2)) * 0.008;
      arms.forEach((a, k) => {
        a.rotation.x = -up * 2.6 + Math.sin(time * 2 + k * Math.PI) * 0.06;
        a.rotation.z = (k ? 1 : -1) * (0.08 + hop * 0.9);
      });
    },
    dispose: () => disposeTree(group),
  };
}

// ———————————————————————————————— 从三视图雕出来的体素（scripts/_proto-voxelize.mts）

async function carvedFigure(id: string, dir = "voxels"): Promise<Figure> {
  const res = await fetch(`/prototype-memory/${dir}/${id}.json`);
  const v: { size: [number, number, number]; front: number; palette: string[]; voxels: number[] } = await res.json();
  const [W, , D] = v.size;
  const size = (HEIGHT * 1.06) / v.front;
  const count = v.voxels.length / 4;
  // 顶面、底面只压暗一点点：表面是一级级台阶，压得太狠每一级都成了一道横纹，不压顶面又迎着太阳成了亮线。
  // （试过按周围空格子估「平滑表面」的法线打光：横纹没了，但脸上眼睛、鼻子、刘海附近的法线乱，脸发灰发脏，不用。）
  const cube = new THREE.BoxGeometry(size, size, size);
  const normals = cube.getAttribute("normal");
  const shade = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const k = normals.getY(i) > 0.5 ? 0.86 : normals.getY(i) < -0.5 ? 0.78 : 1;
    shade.set([k, k, k], i * 3);
  }
  cube.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  const material = lift(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.18);
  const mesh = new THREE.InstancedMesh(cube, material, count);
  const colors = v.palette.map((c) => new THREE.Color(c));
  const m = new THREE.Matrix4();
  for (let n = 0; n < count; n++) {
    const [x, y, z, ci] = v.voxels.slice(n * 4, n * 4 + 4);
    m.makeTranslation((x - W / 2 + 0.5) * size, (y + 0.5) * size, (z - D / 2 + 0.5) * size);
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, colors[ci]);
  }
  mesh.castShadow = true;
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.add(mesh);
  group.add(body);
  group.add(shadowBlob(0.42));
  return {
    group,
    aim(_camAz, yaw) {
      body.rotation.y = yaw;
    },
    update(time, hop, up) {
      body.scale.set(1 - hop * 0.05, 1 + hop * 0.08 + Math.sin(time * 1.8) * 0.006, 1 - hop * 0.05);
      body.rotation.x = -up * 0.08;
    },
    dispose: () => disposeTree(group),
  };
}

// ———————————————————————————————— 像素立牌

/** 缩成像素画的高度（像素）。 */
const PIXEL_ROWS = 52;

function pixelFigure(img: HTMLImageElement): Figure {
  const crop = cropOf(img);
  const rows = PIXEL_ROWS;
  const cols = Math.round((crop.w / crop.h) * rows);
  const c = document.createElement("canvas");
  c.width = cols + 2;
  c.height = rows + 2;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, crop.x, crop.y, crop.w, crop.h, 1, 1, cols, rows);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : d[(y * c.width + x) * 4 + 3]);
  const size = HEIGHT / rows;
  const cells: { x: number; y: number; color: THREE.Color; outline: boolean }[] = [];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (at(x, y) > 120) {
        cells.push({ x, y, color: new THREE.Color().setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace), outline: false });
      } else if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((a) => a > 120)) {
        cells.push({ x, y, color: new THREE.Color("#2a1f35"), outline: true });
      }
    }
  const bottom = Math.max(...cells.map((k) => k.y));
  const geo = new THREE.BoxGeometry(size, size, size * 2);
  const mesh = new THREE.InstancedMesh(geo, lift(new THREE.MeshLambertMaterial()), cells.length);
  const m = new THREE.Matrix4();
  cells.forEach((k, n) => {
    m.makeTranslation((k.x - c.width / 2) * size, (bottom - k.y + 0.5) * size, k.outline ? -size * 0.3 : 0);
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, k.color);
  });
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.add(mesh);
  group.add(body);
  group.add(shadowBlob(0.45));
  return standee(group, body);
}

// ———————————————————————————————— 面片立牌

function paperFigure(img: HTMLImageElement): Figure {
  const crop = cropOf(img);
  const pad = 14;
  const make = (silhouette: boolean) => {
    const c = document.createElement("canvas");
    c.width = crop.w + pad * 2;
    c.height = crop.h + pad * 2;
    const g = c.getContext("2d")!;
    for (let a = 0; a < 24; a++) {
      const r = 8;
      g.drawImage(img, crop.x, crop.y, crop.w, crop.h, pad + Math.cos((a / 24) * Math.PI * 2) * r, pad + Math.sin((a / 24) * Math.PI * 2) * r, crop.w, crop.h);
    }
    g.globalCompositeOperation = "source-in";
    g.fillStyle = silhouette ? "#e9e3f3" : "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-over";
    if (!silhouette) g.drawImage(img, crop.x, crop.y, crop.w, crop.h, pad, pad, crop.w, crop.h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { t, w: c.width, h: c.height };
  };
  const front = make(false);
  const back = make(true);
  const h = HEIGHT * (front.h / crop.h);
  const w = h * (front.w / front.h);
  const plane = (tex: THREE.Texture, z: number, flip: boolean) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, color: "#f4f0fa" }));
    m.position.set(0, h / 2 + 0.04, z);
    if (flip) m.rotation.y = Math.PI;
    return m;
  };
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.add(plane(front.t, 0.006, false));
  body.add(plane(back.t, -0.006, true));
  // 透明亚克力底座。
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.36, 0.06, 40),
    new THREE.MeshLambertMaterial({ color: "#e7f1ff", transparent: true, opacity: 0.45 }),
  );
  base.scale.z = 0.6;
  base.position.y = 0.03;
  body.add(base);
  group.add(body);
  group.add(shadowBlob(0.45));
  return standee(group, body, true);
}

/** 立牌（像素、面片）的姿态：永远大致朝着镜头，侧开一点让厚度露出来；收到时一跳一压，面片还转半圈。 */
function standee(group: THREE.Group, body: THREE.Group, spin = false): Figure {
  let base = 0;
  return {
    group,
    aim(camAz, yaw) {
      base = yaw - 0.35 * Math.max(0, 1 - Math.abs(yaw - camAz) / 0.6);
    },
    update(time, hop, up) {
      body.rotation.y = base + (spin ? hop * Math.PI : 0) + Math.sin(time * 1.1) * 0.05;
      body.scale.set(1 - hop * 0.06, 1 + hop * 0.1, 1);
      body.rotation.x = -up * 0.12;
    },
    dispose: () => disposeTree(group),
  };
}
