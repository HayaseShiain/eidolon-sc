// PROTOTYPE：精细一档的方块小人（第二轮）。只在 prototype/landing-memory-3d 分支，不进 main。
// 头 16 像素，全身约 37 像素；头外面套一层略大的头发壳（像我的世界皮肤的第二层），刘海、鬓发、发梢在壳上画，
// 透明的地方露出脸；后面的长发、两侧的发帘、发髻、马尾、呆毛、小白鸽是另外的方块。正面朝 +z，脚底 y=0。

import * as THREE from "three";

import { disposeTree, lift, shadowBlob, type Figure } from "./figures";

const HEIGHT = 1.6;
const P = HEIGHT / 37;

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

const px = (g: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
};
/** 按一行行字符画像素；`.` 留空。 */
const paint = (rows: string[], pal: Record<string, string>): Draw => (g) =>
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && px(g, pal[ch] ?? "#ff00ff", x, y)));
const fill = (color: string): Draw => (g, w, h) => px(g, color, 0, 0, w, h);
const pleats = (base: string, line: string, step = 2): Draw => (g, w, h) => {
  px(g, base, 0, 0, w, h);
  for (let x = 1; x < w; x += step) px(g, line, x, 0, 1, h);
};
const plaid = (base: string, line: string, cross: string): Draw => (g, w, h) => {
  px(g, base, 0, 0, w, h);
  for (let x = 1; x < w; x += 3) px(g, line, x, 0, 1, h);
  for (let y = 1; y < h; y += 2) px(g, cross, 0, y, w, 1);
};

type Spec = {
  skin: string;
  hair: string;
  hairDark: string;
  hairLight: string;
  eye: string;
  eyeDark: string;
  eyeLight: string;
  lash: string;
  eyes: "round" | "sleepy" | "lashy";
  mouth: "smile" | "grin" | "cat" | "small";
  /** 头发壳正面每一列的刘海从顶上垂到第几行（16 列）。 */
  fringe: number[];
  /** 侧面露脸的那几列（从前往后数）。 */
  cheek: [number, number];
  overlayFront?: Draw;
  torsoFront: string[];
  torsoBack: string[];
  torsoSide: string;
  pal: Record<string, string>;
  arm: string[];
  puffy?: string;
  skirt: { kind: "flare" | "long" | "shorts"; front: Draw; side?: Draw };
  leg: Draw;
  shoe: string;
  sole: string;
  back: { len: number; width: number; jag: number };
  curtains?: number;
  /** 两臂平时的姿势：[绕 x, 绕 z]，左（-x）右（+x）。 */
  pose: { l: [number, number]; r: [number, number] };
  extras?: (add: Add) => void;
};
type Add = (w: number, h: number, d: number, x: number, y: number, z: number, color: string | THREE.Material, rot?: [number, number, number]) => THREE.Mesh;

const legRows = (rows: [string, number][]): Draw => (g, w) => {
  let y = 0;
  for (const [c, n] of rows) {
    px(g, c, 0, y, w, n);
    y += n;
  }
};

const SKIN = "#fde7da";

const SPECS: Record<string, Spec> = {
  mano: {
    skin: SKIN,
    hair: "#eebc92",
    hairDark: "#cf946b",
    hairLight: "#fcdcbc",
    eye: "#9a6449",
    eyeDark: "#5e3a2c",
    eyeLight: "#d6a07a",
    lash: "#4a2c24",
    eyes: "round",
    mouth: "smile",
    fringe: [16, 15, 11, 8, 7, 8, 9, 7, 6, 8, 8, 7, 8, 11, 15, 16],
    cheek: [0, 0],
    pal: { N: "#2c3352", n: "#232842", W: "#f3f3f6", T: "#7cc7cd", t: "#4f9fae", S: SKIN },
    torsoFront: ["WWWTTWWW", "NWTttTWN", "NNWTTWNN", "NNNNNNNN", "NnNNNNnN"],
    torsoBack: ["WWWWWWWW", "WWWWWWWW", "NNNNNNNN", "NNNNNNNN", "NNNNNNNN"],
    torsoSide: "N",
    arm: ["NNN", "NNN", "NNN", "NNN", "WWW", "NNN", "SSS"],
    skirt: { kind: "flare", front: plaid("#bfe0ea", "#5aa6b8", "#eaf6fa") },
    leg: legRows([[SKIN, 6], ["#d9d9e0", 1], ["#f6f6f8", 5]]),
    shoe: "#6e4329",
    sole: "#3e261a",
    back: { len: 12, width: 16, jag: 1 },
    pose: { l: [0, -0.22], r: [0, 0.22] },
    extras: (add) => {
      // 头上的小白鸽。
      add(6, 5, 8, 0.5, 38.5, -0.5, "#fbfbff");
      add(4, 4, 4, 0.5, 41.5, 3.5, "#fbfbff");
      add(1.6, 1, 2, 0.5, 41, 6.2, "#f2a64a");
      add(0.6, 0.8, 0.8, 2.6, 42, 4.3, "#1b1820");
      add(0.6, 0.8, 0.8, -1.6, 42, 4.3, "#1b1820");
      add(1, 3.5, 6, 3.9, 39, -0.8, "#e4e4ee").name = "wing";
      add(1, 3.5, 6, -2.9, 39, -0.8, "#e4e4ee").name = "wing";
      add(4, 1.5, 4, 0.5, 38.5, -5.6, "#e4e4ee");
    },
  },
  kaho: {
    skin: SKIN,
    hair: "#cf5664",
    hairDark: "#a23b4c",
    hairLight: "#ef8a94",
    eye: "#d4505d",
    eyeDark: "#8a2a38",
    eyeLight: "#f5a0a6",
    lash: "#5a1e28",
    eyes: "round",
    mouth: "grin",
    fringe: [16, 16, 11, 8, 7, 8, 7, 6, 8, 7, 6, 8, 7, 11, 16, 16],
    cheek: [0, 0],
    pal: { W: "#f7f5f2", T: "#7cc6d0", O: "#f2a33a", B: "#5b8fd6", S: SKIN },
    torsoFront: ["TTWWWWTT", "TWWOOWWT", "WWOBBOWW", "WWWOOWWW", "WWWWWWWW"],
    torsoBack: ["TTWWWWTT", "TWWWWWWT", "WWWWWWWW", "WWWWWWWW", "WWWWWWWW"],
    torsoSide: "W",
    arm: ["TTT", "TTT", "TTT", "TTT", "TTT", "TTT", "SSS"],
    skirt: { kind: "shorts", front: plaid("#c4606f", "#f3e6ea", "#8d3a4c") },
    leg: legRows([[SKIN, 9], ["#2a2a30", 3]]),
    shoe: "#d64b4b",
    sole: "#f4f4f4",
    back: { len: 17, width: 18, jag: 3 },
    curtains: 13,
    pose: { l: [0, -2.2], r: [-0.9, 0.55] },
    extras: (add) => {
      // 系在腰上的外套（两只袖子在前面打结），呆毛，两侧蓬起来的头发。
      add(11, 2.5, 8, 0, 14.75, 0, "#f2a33a");
      add(2, 5, 1, -2, 12, 4.2, "#f2a33a", [0, 0, -0.25]);
      add(2, 5, 1, 2, 12, 4.2, "#f2a33a", [0, 0, 0.25]);
      add(3, 2, 1.5, 0, 14.5, 4.3, "#d98a22");
      add(1, 3, 1, 1, 37.5, 2, "#cf5664", [0, 0, -0.4]);
      add(1, 2, 1, 2.2, 39.3, 2, "#cf5664", [0, 0, -1]);
      add(2, 7, 6, -9, 21, -2, "#cf5664");
      add(2, 7, 6, 9, 21, -2, "#cf5664");
    },
  },
  fuyuko: {
    skin: "#fdeae0",
    hair: "#2d2e40",
    hairDark: "#1a1a27",
    hairLight: "#55587a",
    eye: "#d66b80",
    eyeDark: "#8e3348",
    eyeLight: "#f6a9b8",
    lash: "#14121a",
    eyes: "lashy",
    mouth: "cat",
    fringe: [16, 16, 16, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 16, 16, 16],
    cheek: [0, 0],
    pal: { P: "#f4bccb", p: "#fbdbe4", K: "#26242c", G: "#5a5560", S: "#fdeae0" },
    torsoFront: ["PpPKKPpP", "PPKPPKPP", "KKKKKKKK", "KGKKKKGK", "KKKGGKKK"],
    torsoBack: ["PPPPPPPP", "PPPPPPPP", "KKKKKKKK", "KKKKKKKK", "KKKKKKKK"],
    torsoSide: "K",
    arm: ["PPP", "PPP", "PpP", "PPP", "PPP", "ppp", "SSS"],
    puffy: "#f4bccb",
    skirt: { kind: "flare", front: pleats("#232229", "#36343e") },
    leg: legRows([["#fdeae0", 2], ["#3b2d30", 1], ["#4c3b3e", 9]]),
    shoe: "#1d1b22",
    sole: "#0e0d12",
    back: { len: 18, width: 16, jag: 1 },
    curtains: 15,
    pose: { l: [0.35, 0.12], r: [0.35, -0.12] },
    extras: (add) => {
      // 两侧的丸子头和黑色发绳。
      add(6, 6, 6, -6.5, 35.5, -3, "#2d2e40");
      add(6, 6, 6, 6.5, 35.5, -3, "#2d2e40");
      add(6.6, 1, 6.6, -6.5, 32.8, -3, "#121117");
      add(6.6, 1, 6.6, 6.5, 32.8, -3, "#121117");
    },
  },
  kiriko: {
    skin: "#fdeee6",
    hair: "#aaa6b8",
    hairDark: "#837e96",
    hairLight: "#d6d3e2",
    eye: "#7065aa",
    eyeDark: "#3e3570",
    eyeLight: "#b3a8e6",
    lash: "#2e2840",
    eyes: "sleepy",
    mouth: "small",
    fringe: [16, 15, 11, 9, 8, 9, 9, 8, 8, 9, 9, 8, 9, 11, 15, 16],
    cheek: [0, 0],
    overlayFront: (g) => {
      // 额前的创可贴，贴在刘海上面。
      px(g, "#ffffff", 10, 5, 3, 1);
      px(g, "#f3c3cc", 11, 5);
    },
    pal: { N: "#2f3f70", W: "#f2f2f7", B: "#5c7fd6", D: "#1f2747", M: "#c9ccd6", S: "#fdeee6" },
    torsoFront: ["WWWBBWWW", "NWWBBWWN", "NNNWWNNN", "NNNNNNNN", "DDDMMDDD"],
    torsoBack: ["WWWWWWWW", "NNNNNNNN", "NNNNNNNN", "NNNNNNNN", "DDDDDDDD"],
    torsoSide: "N",
    arm: ["WWW", "WWW", "WWW", "WWW", "WWW", "WWW", "SSS"],
    skirt: { kind: "long", front: pleats("#2f3f70", "#263460") },
    leg: (g, w) => {
      legRows([["#fdeee6", 5], ["#f6f6f8", 7]])(g, w, 12);
      px(g, "#ffffff", 0, 3, w, 1); // 膝上的绷带
      px(g, "#f3c3cc", 1, 3);
    },
    shoe: "#6b4330",
    sole: "#3a2419",
    back: { len: 13, width: 14, jag: 2 },
    pose: { l: [0, -0.32], r: [0, 0.32] },
    extras: (add) => {
      // 两束长长的、带点波浪的马尾和深蓝的发绳。
      for (const s of [-1, 1]) {
        add(2.4, 2.4, 2.4, s * 8.3, 31.5, -4, "#2f3f70");
        add(4, 5, 4, s * 10, 28, -5, "#aaa6b8");
        add(4, 5, 4, s * 11, 23.5, -5.5, "#aaa6b8");
        add(4, 5, 4, s * 10.4, 19, -5, "#9d99ad");
        add(3.6, 4.5, 3.6, s * 11.3, 14.5, -5.3, "#aaa6b8");
        add(3, 3, 3, s * 10.8, 11, -5, "#9d99ad");
      }
    },
  },
};

function tex(w: number, h: number, draw: Draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const mat = (w: number, h: number, draw: Draw, cutout = false) =>
  lift(new THREE.MeshLambertMaterial({ map: tex(w, h, draw), alphaTest: cutout ? 0.5 : 0, transparent: false }), 0.3);

type Faces = { px?: Draw; nx?: Draw; py?: Draw; ny?: Draw; pz?: Draw; nz?: Draw };
/** 一块方块（像素尺寸，可以比贴图大），六个面各画各的：+x、-x、+y、-y、+z（正面）、-z。 */
function box(size: [number, number, number], tx: [number, number, number], faces: Faces, all: Draw, cutout = false) {
  const [w, h, d] = tx;
  const mats = [
    mat(d, h, faces.px ?? all, cutout),
    mat(d, h, faces.nx ?? all, cutout),
    mat(w, d, faces.py ?? all, cutout),
    mat(w, d, faces.ny ?? all, cutout),
    mat(w, h, faces.pz ?? all, cutout),
    mat(w, h, faces.nz ?? all, cutout),
  ];
  const m = new THREE.Mesh(new THREE.BoxGeometry(size[0] * P, size[1] * P, size[2] * P), mats);
  m.castShadow = true;
  return m;
}

export function voxelHd(id: string): Figure {
  const s = SPECS[id];
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  group.add(shadowBlob(0.42));

  const plain = new Map<string, THREE.MeshLambertMaterial>();
  const add: Add = (w, h, d, x, y, z, color, rot) => {
    let m: THREE.Material;
    if (typeof color === "string") {
      if (!plain.has(color)) plain.set(color, lift(new THREE.MeshLambertMaterial({ color }), 0.3));
      m = plain.get(color)!;
    } else m = color;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, d * P), m);
    mesh.position.set(x * P, y * P, z * P);
    if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  };
  const at = (m: THREE.Object3D, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    m.position.set(x * P, y * P, z * P);
    parent.add(m);
    return m;
  };

  // —— 腿和鞋（0–12）。
  for (const x of [-1.6, 1.6]) {
    at(box([3, 12, 3], [3, 12, 3], {}, s.leg), x, 6, 0);
    at(box([3.4, 2, 4.4], [3, 2, 4], { py: fill(s.shoe) }, (g, w, h) => (px(g, s.shoe, 0, 0, w, h), px(g, s.sole, 0, h - 1, w, 1))), x, 1, 0.6);
  }
  // —— 裙子或短裤。
  if (s.skirt.kind === "shorts") {
    at(box([9, 3, 6], [9, 3, 6], {}, s.skirt.front), 0, 12.5, 0);
  } else {
    const long = s.skirt.kind === "long" ? 1 : 0;
    at(box([12, 3 + long, 9], [12, 3 + long, 9], {}, s.skirt.front), 0, 11.5 - long / 2, 0);
    at(box([10, 3, 7], [10, 3, 7], {}, s.skirt.front), 0, 14.5, 0);
  }
  // —— 身子（15–20）。
  at(box([8, 5, 5], [8, 5, 5], { pz: paint(s.torsoFront, s.pal), nz: paint(s.torsoBack, s.pal), py: fill(s.pal[s.torsoSide]) }, fill(s.pal[s.torsoSide])), 0, 17.5, 0);
  // —— 手臂：肩膀处转动。
  const arms: { pivot: THREE.Group; base: [number, number] }[] = [];
  for (const [side, base] of [[-1, s.pose.l], [1, s.pose.r]] as const) {
    const pivot = new THREE.Group();
    at(pivot, side * 5.5, 20, 0);
    at(box([3, 7, 3], [3, 7, 3], {}, paint(s.arm, s.pal)), 0, -3.5, 0, pivot);
    if (s.puffy) {
      const puff = add(4, 3, 4, 0, 0, 0, s.puffy);
      body.remove(puff);
      at(puff, 0, -1.2, 0, pivot);
    }
    arms.push({ pivot, base });
  }
  // —— 头（20–36）和头发壳。
  const head = new THREE.Group();
  at(head, 0, 28, 0);
  const face: Draw = (g, w, h) => {
    px(g, s.skin, 0, 0, w, h);
    const eye = (x: number, outerRight: boolean) => {
      const outer = outerRight ? x + 3 : x - 1;
      if (s.eyes === "sleepy") {
        px(g, s.lash, x, 9, 3, 1);
        px(g, s.lash, outer, 9);
        px(g, s.eyeDark, x, 10, 3, 1);
        px(g, s.eye, x, 11, 3, 1);
        px(g, "#ffffff", outerRight ? x : x + 2, 10);
        px(g, s.eyeLight, outerRight ? x + 2 : x, 11);
      } else {
        px(g, s.lash, x, 8, 3, 1);
        px(g, s.lash, outer, s.eyes === "lashy" ? 8 : 9);
        if (s.eyes === "lashy") px(g, s.lash, outer, 9);
        px(g, s.eyeDark, x, 9, 3, 1);
        px(g, "#ffffff", outerRight ? x : x + 2, 9);
        px(g, s.eye, x, 10, 3, 1);
        px(g, s.eyeLight, x, 11, 3, 1);
        px(g, s.eye, outerRight ? x + 2 : x, 11);
      }
    };
    eye(3, false);
    eye(10, true);
    px(g, "#f6a9b4", 2, 12, 2, 1);
    px(g, "#f6a9b4", 12, 12, 2, 1);
    if (s.mouth === "grin") {
      px(g, "#a03a46", 6, 13, 4, 1);
      px(g, "#f08a8f", 7, 14, 2, 1);
    } else if (s.mouth === "cat") {
      px(g, "#c46a78", 6, 13);
      px(g, "#c46a78", 9, 13);
      px(g, "#c46a78", 7, 14, 2, 1);
    } else if (s.mouth === "small") px(g, "#d8909a", 7, 13, 2, 1);
    else px(g, "#c9727a", 7, 13, 2, 1);
  };
  const headSide: Draw = (g, w, h) => (px(g, s.skin, 0, 0, w, h), px(g, s.hair, 0, 0, w, 6));
  at(box([16, 16, 16], [16, 16, 16], { pz: face, px: headSide, nx: headSide, ny: fill(s.skin) }, fill(s.hair)), 0, 0, 0, head);
  const shellFront: Draw = (g) => {
    s.fringe.forEach((rows, x) => {
      px(g, s.hair, x, 0, 1, rows);
      if (rows > 4 && x > 1 && x < 14 && x % 2 === 0) px(g, s.hairDark, x, rows - 1);
    });
    // 一圈「天使环」的高光，只在第 3 行断断续续地亮。
    for (const x of [3, 4, 5, 10, 11, 12]) px(g, s.hairLight, x, 3);
    s.overlayFront?.(g, 16, 16);
  };
  const shellSide = (frontAtLeft: boolean): Draw => (g, w, h) => {
    px(g, s.hair, 0, 0, w, h);
    const [a, b] = s.cheek;
    for (let k = a; k < b; k++) g.clearRect(frontAtLeft ? k : w - 1 - k, 8, 1, h - 8);
    for (let k = 6; k < 13; k++) px(g, s.hairLight, frontAtLeft ? k : w - 1 - k, 3);
    for (let k = 0; k < w; k += 3) px(g, s.hairDark, k, h - 1);
  };
  const shellBack: Draw = (g, w, h) => {
    px(g, s.hair, 0, 0, w, h);
    for (let x = 1; x < w; x += 3) px(g, s.hairDark, x, 9, 1, h - 9);
    for (let x = 3; x < 13; x++) px(g, s.hairLight, x, 3);
  };
  const shellTop: Draw = (g, w, h) => {
    px(g, s.hair, 0, 0, w, h);
    px(g, s.hairDark, 7, 8, 1, 8);
    px(g, s.hairLight, 3, 10, 3, 1);
    px(g, s.hairLight, 10, 10, 3, 1);
  };
  at(box([17, 17, 17], [16, 16, 16], { pz: shellFront, px: shellSide(true), nx: shellSide(false), py: shellTop, nz: shellBack, ny: () => {} }, fill(s.hair), true), 0, 0.3, 0, head);
  // 后面垂下来的头发：一根根发束，发梢参差。
  const b = s.back;
  const strands: Draw = (g, w, h) => {
    px(g, s.hair, 0, 0, w, h);
    for (let x = 1; x < w; x += 3) px(g, s.hairDark, x, 2, 1, h - 2);
    for (let x = 0; x < w; x++) {
      const cut = (x * 7 + 3) % (b.jag + 1);
      if (cut) g.clearRect(x, h - cut, 1, cut);
    }
  };
  at(box([b.width, b.len, 3], [b.width, b.len, 3], { pz: fill(s.hairDark) }, strands, true), 0, 28 - 0.5 * b.len, -4.6);
  if (s.curtains) {
    for (const x of [-7.6, 7.6]) at(box([2, s.curtains, 4], [2, s.curtains, 4], {}, strands, true), x, 21 - s.curtains / 2, -3.4);
  }
  // 头上、身上另加的东西加在 body 上，按原点算；头上的要跟着头转，挪进 head。
  const before = body.children.length;
  s.extras?.(add);
  const wings: THREE.Object3D[] = [];
  for (const m of body.children.slice(before)) {
    if (m.position.y > 30 * P) {
      body.remove(m);
      m.position.y -= 28 * P;
      head.add(m);
    }
    if (m.name === "wing") wings.push(m);
  }

  return {
    group,
    aim(_camAz, yaw) {
      body.rotation.y = yaw;
    },
    update(time, hop, up) {
      head.rotation.z = Math.sin(time * 1.3) * 0.035;
      head.rotation.x = Math.sin(time * 0.9) * 0.02;
      body.position.y = Math.abs(Math.sin(time * 1.8)) * 0.006;
      arms.forEach(({ pivot, base }, k) => {
        pivot.rotation.x = base[0] * (1 - up) - up * 2.5 + Math.sin(time * 1.8 + k * Math.PI) * 0.05;
        pivot.rotation.z = base[1] * (1 - up) + (k ? 1 : -1) * hop * 0.9;
      });
      wings.forEach((w, k) => (w.rotation.z = (k ? -1 : 1) * (0.15 + Math.max(0, Math.sin(time * 18)) * 0.9 * Math.max(up, hop))));
    },
    dispose: () => disposeTree(group),
  };
}
