// PROTOTYPE：第 5 幕 3D 场景的布景和随滚动的事件（第二轮）。只在 prototype/landing-memory-3d 分支，不进 main。
// 夜色的纪念碑谷：四座浮岛、转台、升起的台阶；AI 的梗（天上的手机、数据库样子的记忆柱、embedding 星图、
// context window、temperature、Attention Is All You Need、飘着的 token）；闪彩的东西（283 事务所、
// 应援棒路灯、真乃的樱花树、冬优子的补光灯、雾子的花箱）。

import * as THREE from "three";

export type Idol = { id: string; name: string; color: string; at: THREE.Vector3; pedestal: THREE.Vector3 };

export const IDOLS: Idol[] = [
  { id: "mano", name: "真乃", color: "#ffbad6", at: new THREE.Vector3(-0.2, 0, 0.45), pedestal: new THREE.Vector3(0.65, 0, -0.55) },
  { id: "kaho", name: "果穗", color: "#e5461c", at: new THREE.Vector3(4.75, 0, 0.45), pedestal: new THREE.Vector3(5.65, 0, -0.35) },
  { id: "fuyuko", name: "冬优子", color: "#5ce626", at: new THREE.Vector3(4.75, -2, 5.3), pedestal: new THREE.Vector3(5.7, -2, 4.55) },
  { id: "kiriko", name: "雾子", color: "#d9f2ff", at: new THREE.Vector3(9.5, 2, 0.5), pedestal: new THREE.Vector3(10.3, 2, -0.3) },
];
const PLATFORMS: [number, number, number][] = [
  [0, 0, 0],
  [5, 0, 0],
  [5, -2, 5],
  [10, 2, 0],
];
const LAMPS: [number, number][][] = [
  [[1.3, 1.3], [-1.3, 1.3]],
  [[6.3, 1.3], [3.7, 1.3]],
  [[6.3, 6.3], [6.3, 3.7]],
  [[11.3, 1.3], [8.7, -1.3]],
];
const DB_H = 0.55;
/** 283 事务所那栋楼的楼顶。 */
const TOWER = 1.0;
const BLOCK = 0.3;
const MANO = IDOLS[0];

export const pedTop = (i: number) => IDOLS[i].pedestal.clone().add(new THREE.Vector3(0, DB_H + BLOCK / 2 + 0.08, 0));

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 每一位把记忆收进柱子的时刻（整段进度）。 */
export const STORED_AT = [0.28, 0.53, 0.84, 0.85];

export type World = {
  update(p: number, time: number, camAz: number): void;
  /** 制作人的消息现在在哪（气泡跟着它）。 */
  message: THREE.Vector3;
  dispose(): void;
};

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, nearest = false) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
  } else t.anisotropy = 4;
  return t;
}

export function buildWorld(scene: THREE.Scene): World {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) => track(new THREE.MeshLambertMaterial({ color, ...extra }));
  const basic = (params: THREE.MeshBasicMaterialParameters) => track(new THREE.MeshBasicMaterial(params));
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = scene) => {
    const o = new THREE.Mesh(track(geo), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };

  // —— 背景：渐变的夜空和星星（画在屏幕上，不随镜头转）。
  scene.background = track(
    canvasTexture(1024, 1024, (g) => {
      const grad = g.createRadialGradient(512, 300, 50, 512, 420, 900);
      grad.addColorStop(0, "#2d2152");
      grad.addColorStop(0.55, "#151030");
      grad.addColorStop(1, "#090716");
      g.fillStyle = grad;
      g.fillRect(0, 0, 1024, 1024);
      let s = 11;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 380; i++) {
        g.fillStyle = `rgba(230,225,255,${0.12 + rnd() * 0.5})`;
        g.beginPath();
        g.arc(rnd() * 1024, rnd() * 1024, rnd() * 1.4, 0, Math.PI * 2);
        g.fill();
      }
    }),
  );

  // —— 柱子：顶面亮、两侧一明一暗，往下渐隐到夜色里。
  const BG = new THREE.Color("#120e26");
  const pillarMat = lambert("#ffffff", { vertexColors: true });
  const pillar = (w: number, d: number, top: number, depth: number, x: number, z: number, color = "#8d79b3", topColor = "#e6dbf2") => {
    const g = new THREE.BoxGeometry(w, depth, d).toNonIndexed();
    g.translate(x, top - depth / 2, z);
    const pos = g.getAttribute("position");
    const nor = g.getAttribute("normal");
    const cols = new Float32Array(pos.count * 3);
    const side = new THREE.Color(color);
    const topC = new THREE.Color(topColor);
    for (let i = 0; i < pos.count; i++) {
      const c = nor.getY(i) > 0.5 ? topC.clone() : side.clone().lerp(BG, clamp01((top - pos.getY(i)) / Math.max(depth, 0.01)) ** 0.8);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    return mesh(g, pillarMat);
  };

  const glowTex = track(
    canvasTexture(64, 64, (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.25, "rgba(255,255,255,0.35)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }),
  );
  const glow = (color: string, size: number, parent: THREE.Object3D = scene) => {
    const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
    s.scale.setScalar(size);
    parent.add(s);
    return s;
  };
  const label = (text: string, worldH: number, opts: { font?: string; bg?: string; fg?: string } = {}) => {
    const font = opts.font ?? "600 44px ui-monospace, Menlo, Consolas, monospace";
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.font = font;
    const w = Math.ceil(probe.measureText(text).width) + 48;
    const t = track(
      canvasTexture(w, 72, (g) => {
        g.fillStyle = opts.bg ?? "rgba(20,16,40,0.78)";
        g.beginPath();
        g.roundRect(0, 0, w, 72, 36);
        g.fill();
        g.font = font;
        g.fillStyle = opts.fg ?? "#f3eeff";
        g.textBaseline = "middle";
        g.fillText(text, 24, 38);
      }),
    );
    const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false })));
    s.scale.set((worldH * w) / 72, worldH, 1);
    s.renderOrder = 10;
    scene.add(s);
    return s;
  };

  // —— 四座浮岛：平台、一圈沿、她颜色的地砖、两根她颜色的应援棒路灯。
  PLATFORMS.forEach(([x, y, z], k) => {
    pillar(3, 3, y, 10 + y, x, z);
    pillar(3.12, 3.12, y - 0.12, 0.35, x, z, "#a893c9", "#cdbde6");
    const idol = IDOLS[k];
    mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), lambert(idol.color, { emissive: idol.color, emissiveIntensity: 0.3 }), idol.at.x, y + 0.02, idol.at.z);
    for (const [lx, lz] of LAMPS[k]) {
      mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), lambert("#3b3350"), lx, y + 0.375, lz);
      mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.34, 10), basic({ color: idol.color }), lx, y + 0.92, lz);
      glow(idol.color, 0.9).position.set(lx, y + 0.95, lz);
    }
  });

  // —— 真乃：樱花树（櫻木）和飘落的花瓣。
  pillar(0.22, 0.22, 1.1, 1.1, -1.05, -1.05, "#7a5244", "#8e6050");
  mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), lambert("#7a5244"), -0.85, 1.05, -1.05).rotation.z = -0.6;
  {
    const petals = ["#ffc7dc", "#ffb0cc", "#ffe0ec", "#f7a1c0"];
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const geo = track(new THREE.BoxGeometry(1, 1, 1));
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.8;
      const m = mesh(geo, lambert(petals[i % petals.length], { emissive: "#ff9cc0", emissiveIntensity: 0.12 }), -1.05 + Math.cos(a) * r, 1.45 + (rnd() - 0.4) * 0.6, -1.05 + Math.sin(a) * r);
      m.scale.setScalar(0.18 + rnd() * 0.16);
    }
  }
  const petalCount = 50;
  const petalPos = new Float32Array(petalCount * 3);
  const petalSeed: number[] = [];
  for (let i = 0; i < petalCount; i++) petalSeed.push(Math.random() * 100);
  const petalGeo = track(new THREE.BufferGeometry());
  petalGeo.setAttribute("position", new THREE.BufferAttribute(petalPos, 3));
  scene.add(new THREE.Points(petalGeo, track(new THREE.PointsMaterial({ color: "#ffc2d8", size: 4, sizeAttenuation: false, transparent: true, opacity: 0.9 }))));

  // —— 果穗：拱门是一扇 context window，里面滚着分词器那样一块块上色的 token。
  pillar(0.35, 0.35, 2.15, 2.15, 4, -1.1, "#9a86c0");
  pillar(0.35, 0.35, 2.15, 2.15, 6, -1.1, "#9a86c0");
  pillar(2.35, 0.35, 2.32, 0.35, 5, -1.1, "#b39ad6", "#efe4fa");
  const tokenTex = track(
    canvasTexture(256, 512, (g) => {
      g.fillStyle = "rgba(170,200,255,0.12)";
      g.fillRect(0, 0, 256, 512);
      const words = ["<bos>", "下周", "考试", "了", "，", "有点", "紧张", "。", "加油", "ファイト", "です", "！", "真乃", "说", "<eos>", "▁mem", "ory", "▁you", "了解", "…"];
      const chips = ["#ffbad6", "#ffd59a", "#b9f0c6", "#bfe0ff", "#e2c8ff", "#ffcbb8"];
      g.font = "600 22px ui-monospace, Consolas, 'Noto Sans SC', sans-serif";
      g.textBaseline = "middle";
      let k = 0;
      for (let y = 10; y < 512; y += 34) {
        let x = 10;
        while (x < 240) {
          const w = words[k % words.length];
          const tw = g.measureText(w).width + 12;
          if (x + tw > 248) break;
          g.fillStyle = chips[(k * 7) % chips.length];
          g.globalAlpha = 0.85;
          g.beginPath();
          g.roundRect(x, y, tw, 26, 5);
          g.fill();
          g.globalAlpha = 1;
          g.fillStyle = "#1e1838";
          g.fillText(w, x + 6, y + 14);
          x += tw + 5;
          k++;
        }
        k += 3;
      }
    }),
  );
  tokenTex.wrapT = THREE.RepeatWrapping;
  const pane = mesh(new THREE.PlaneGeometry(1.62, 1.95), basic({ map: tokenTex, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }), 5, 0.99, -1.1);
  pane.castShadow = false;
  const signTex = track(
    canvasTexture(512, 64, (g) => {
      g.font = "600 26px ui-monospace, Consolas, monospace";
      g.fillStyle = "rgba(90,70,140,0.75)";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("CONTEXT  WINDOW", 256, 34);
    }),
  );
  mesh(new THREE.PlaneGeometry(2.2, 0.27), basic({ map: signTex, transparent: true }), 5, 2.145, -0.92).castShadow = false;

  // —— 冬优子：尖塔和一盏自拍用的环形补光灯。
  pillar(0.8, 0.8, -1.2, 0.8, 3.95, 4, "#9a86c0");
  mesh(new THREE.ConeGeometry(0.42, 1.4, 4), lambert("#7ee6c0"), 3.95, -0.5, 4).rotation.y = Math.PI / 4;
  {
    const ring = new THREE.Group();
    ring.position.set(3.85, -2, 5.95);
    ring.rotation.y = 0.9;
    scene.add(ring);
    mesh(new THREE.BoxGeometry(0.05, 0.95, 0.05), lambert("#2b2633"), 0, 0.47, 0, ring);
    mesh(new THREE.TorusGeometry(0.3, 0.045, 10, 36), basic({ color: "#fff6ea" }), 0, 1.2, 0, ring);
    mesh(new THREE.BoxGeometry(0.13, 0.24, 0.02), lambert("#1b1a22"), 0, 1.2, 0, ring);
    glow("#fff1dc", 1.4, ring).position.set(0, 1.2, 0);
  }

  // —— 雾子：小房子和一排花箱。
  pillar(1, 1, 2.9, 0.9, 10.95, -1.0, "#9a86c0");
  mesh(new THREE.ConeGeometry(0.85, 0.55, 4), lambert("#bfe4f7"), 10.95, 3.17, -1.0).rotation.y = Math.PI / 4;
  mesh(new THREE.BoxGeometry(0.3, 0.5, 0.02), basic({ color: "#ffd99a" }), 10.95, 2.3, -0.49);
  {
    mesh(new THREE.BoxGeometry(1.2, 0.24, 0.34), lambert("#efe7f7"), 9.0, 2.12, 1.25);
    const flowers = ["#ffffff", "#ffe27a", "#bfe0ff", "#ffc4d8", "#ffffff"];
    flowers.forEach((c, i) => {
      const x = 8.55 + i * 0.22;
      mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), lambert("#6fbf73"), x, 2.33, 1.25);
      mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), lambert(c, { emissive: c, emissiveIntensity: 0.2 }), x, 2.46, 1.25);
    });
  }

  // —— 转台（把手是 temperature 旋钮）和台阶。
  const turntable = new THREE.Group();
  turntable.position.set(2.5, 0, 0);
  scene.add(turntable);
  mesh(new THREE.CylinderGeometry(0.7, 0.7, 6, 32), lambert("#6f5f96"), 2.5, -3.25, 0);
  const walkTiles: THREE.Mesh[] = [];
  for (let k = 0; k < 2; k++) walkTiles.push(mesh(new THREE.BoxGeometry(0.98, 0.25, 0.98), lambert("#d9cbe8", { emissive: MANO.color, emissiveIntensity: 0 }), k - 0.5, -0.125, 0, turntable));
  const knob = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 24), lambert("#ffd88a", { emissive: "#ffb24a", emissiveIntensity: 0.35 }), 0, 0.07, 0, turntable);
  mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), lambert("#5a3d10"), 0, 0.08, 0.1, knob);
  const tempLabel = label("temperature 0.7", 0.16, { bg: "rgba(20,16,40,0.35)", fg: "rgba(243,238,255,0.6)" });
  tempLabel.position.set(2.5, 0.75, 0.35);

  type Step = { mesh: THREE.Mesh; home: number; delay: number };
  const steps: Step[] = [];
  const stepMat = () => lambert("#d9cbe8", { emissive: MANO.color, emissiveIntensity: 0 });
  for (let i = 0; i < 4; i++) {
    const top = -0.5 * (i + 1);
    steps.push({ mesh: mesh(new THREE.BoxGeometry(1, 0.5, 0.5), stepMat(), 5, top - 0.25, 1.75 + 0.5 * i), home: top - 0.25, delay: i * 0.12 });
    steps.push({ mesh: mesh(new THREE.BoxGeometry(0.5, 0.5, 1), stepMat(), 6.75 + 0.5 * i, 0.5 * (i + 1) - 0.25, 0), home: 0.5 * (i + 1) - 0.25, delay: i * 0.12 + 0.06 });
  }

  // —— 283 事务所的楼。
  pillar(2.2, 2.2, TOWER, 12, -1.6, -5.4, "#6f5d99", "#cfc0e6");
  const windowsTex = track(
    canvasTexture(64, 256, (g) => {
      let s = 5;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let y = 6; y < 256; y += 14)
        for (let x = 5; x < 60; x += 11) {
          const lit = rnd() < 0.28;
          g.fillStyle = lit ? `rgba(255,${200 + Math.floor(rnd() * 40)},150,${0.35 + rnd() * 0.3})` : "rgba(40,32,72,0.45)";
          g.fillRect(x, y, 7, 8);
        }
    }, true),
  );
  for (const [nx, nz, ry] of [[0, 1, 0], [1, 0, Math.PI / 2]] as const) {
    const w = mesh(new THREE.PlaneGeometry(2.0, 8), basic({ map: windowsTex, transparent: true, depthWrite: false }), -1.6 + nx * 1.111, TOWER - 4.3, -5.4 + nz * 1.111);
    w.rotation.y = ry;
    w.castShadow = false;
  }
  const sign283 = track(
    canvasTexture(256, 128, (g) => {
      g.fillStyle = "#1c2a4a";
      g.beginPath();
      g.roundRect(0, 0, 256, 128, 14);
      g.fill();
      g.fillStyle = "#ffffff";
      g.textAlign = "center";
      g.font = "800 70px Georgia, 'Times New Roman', serif";
      g.fillText("283", 128, 78);
      g.font = "600 18px ui-sans-serif, system-ui, sans-serif";
      g.fillStyle = "#cfe0ff";
      g.fillText("P R O D U C T I O N", 128, 110);
    }),
  );
  mesh(new THREE.PlaneGeometry(1.5, 0.75), basic({ map: sign283 }), -1.6, TOWER - 0.22, -4.28).castShadow = false;

  // —— 天上那台制作人的手机：消息从屏幕里出来。
  const phone = new THREE.Group();
  phone.position.set(-0.4, 5.6, 1.4);
  phone.rotation.set(-0.12, Math.PI / 4, 0);
  scene.add(phone);
  mesh(new THREE.BoxGeometry(1.05, 2.05, 0.12), lambert("#d9d6e2"), 0, 0, 0, phone);
  const screenTex = track(
    canvasTexture(240, 480, (g) => {
      g.fillStyle = "#f4f2f7";
      g.fillRect(0, 0, 240, 480);
      g.fillStyle = "#ffe6ef";
      g.fillRect(0, 0, 240, 480);
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, 240, 56);
      g.fillStyle = "#1a1626";
      g.font = "600 22px 'Noto Sans SC', system-ui, sans-serif";
      g.fillText("真乃", 96, 36);
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.roundRect(14, 90, 150, 40, 18);
      g.fill();
      g.fillStyle = "#1a1626";
      g.font = "18px 'Noto Sans SC', system-ui, sans-serif";
      g.fillText("お疲れさまです〜", 26, 116);
      g.fillStyle = "#1c2a4a";
      g.beginPath();
      g.roundRect(60, 360, 166, 44, 20);
      g.fill();
      g.fillStyle = "#fbfcfe";
      g.fillText("下周要考试了…", 76, 388);
      g.fillStyle = "#ffffff";
      g.fillRect(0, 430, 240, 50);
    }),
  );
  const screen = mesh(new THREE.PlaneGeometry(0.95, 1.92), basic({ map: screenTex, transparent: true }), 0, 0, 0.065, phone);
  screen.castShadow = false;
  const phoneGlow = glow("#ffd6e8", 3.2, phone);

  // —— 浮空的石碑：Attention Is All You Need。
  const tablet = new THREE.Group();
  tablet.position.set(-4.4, -3.0, 4.2);
  tablet.scale.setScalar(0.8);
  tablet.rotation.y = Math.PI / 4;
  scene.add(tablet);
  mesh(new THREE.BoxGeometry(1.5, 2.1, 0.28), lambert("#8a7fa6"), 0, 0, 0, tablet);
  mesh(new THREE.BoxGeometry(1.7, 0.2, 0.4), lambert("#a497c0"), 0, 1.12, 0, tablet);
  mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), lambert("#6c6088"), 0.2, -1.3, 0.05, tablet);
  mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), lambert("#6c6088"), -0.35, -1.75, 0, tablet);
  const engraving = track(
    canvasTexture(300, 420, (g) => {
      g.fillStyle = "#6e6390";
      g.textAlign = "center";
      g.font = "700 40px Georgia, 'Times New Roman', serif";
      ["ATTENTION", "IS ALL", "YOU NEED"].forEach((l, i) => g.fillText(l, 150, 110 + i * 62));
      g.font = "italic 22px Georgia, serif";
      g.fillStyle = "#6e6390";
      g.fillText("— 1706.03762 —", 150, 330);
      g.strokeStyle = "#7a6f9c";
      g.lineWidth = 3;
      g.strokeRect(18, 18, 264, 384);
    }),
  );
  mesh(new THREE.PlaneGeometry(1.36, 1.9), basic({ map: engraving, transparent: true }), 0, 0, 0.145, tablet).castShadow = false;

  // —— 记忆柱：数据库图标那样一片片叠起来的圆盘，前面一排小灯。
  type Db = { leds: THREE.MeshBasicMaterial[] };
  const dbs: Db[] = IDOLS.map((idol) => {
    const g = new THREE.Group();
    g.position.copy(idol.pedestal);
    scene.add(g);
    const leds: THREE.MeshBasicMaterial[] = [];
    for (let k = 0; k < 3; k++) {
      const y = 0.09 + k * 0.17;
      mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 28), lambert("#cdbde6"), 0, y, 0, g);
      const led = basic({ color: "#6ff0d0" });
      leds.push(led);
      const l = mesh(new THREE.BoxGeometry(0.06, 0.035, 0.02), led, 0, y, 0, g);
      l.position.set(Math.sin(Math.PI / 4) * 0.25, y, Math.cos(Math.PI / 4) * 0.25);
      l.rotation.y = Math.PI / 4;
    }
    mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 28), lambert("#efe6fa"), 0, DB_H, 0, g);
    return { leds };
  });

  // —— 消息和记忆：制作人的消息是一个深蓝的气泡，落到真乃那里变成她颜色的一块，传出去的是复制的几份。
  const blockGeo = track(new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK));
  const makeBlock = () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(blockGeo, basic({ color: MANO.color }));
    g.add(m);
    const s = glow(MANO.color, 1.3, g);
    scene.add(g);
    return { g, m, glow: s };
  };
  const message = new THREE.Group();
  scene.add(message);
  const bubble = new THREE.Group();
  message.add(bubble);
  const ink = lambert("#1c2a4a", { emissive: "#1c2a4a", emissiveIntensity: 0.6 });
  mesh(new THREE.BoxGeometry(0.56, 0.34, 0.12), ink, 0, 0, 0, bubble);
  mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), ink, 0.16, -0.2, 0, bubble);
  for (const x of [-0.14, 0, 0.14]) mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), basic({ color: "#ffffff" }), x, 0, 0.07, bubble);
  glow("#a9c6f5", 1.4, bubble);
  const core = makeBlock();
  scene.remove(core.g);
  message.add(core.g);
  const stored = IDOLS.map(() => makeBlock());
  const copies = [makeBlock(), makeBlock(), makeBlock()];
  const threadMat = basic({ color: MANO.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [a, b] of [[0, 1], [1, 2], [1, 3], [0, 2], [0, 3]]) {
    const pa = pedTop(a);
    const pb = pedTop(b);
    const mid = pa.clone().lerp(pb, 0.5).add(new THREE.Vector3(0, 1.4, 0));
    mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(pa, mid, pb), 40, 0.022, 6), threadMat).castShadow = false;
  }
  const path = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.2);
  const routes = [
    path([pedTop(0), new THREE.Vector3(1.4, 0.45, 0), new THREE.Vector3(2.5, 0.35, 0), new THREE.Vector3(3.6, 0.45, 0), pedTop(1)]),
    path([pedTop(1), new THREE.Vector3(5, 0.4, 1.3), new THREE.Vector3(5, -0.6, 2.4), new THREE.Vector3(5, -1.6, 3.5), pedTop(2)]),
    path([pedTop(1), new THREE.Vector3(6.4, 0.5, 0), new THREE.Vector3(7.5, 1.4, 0), new THREE.Vector3(8.6, 2.4, 0), pedTop(3)]),
  ];

  // —— embedding 星图：背后一大片点，近邻连线；收下记忆时多亮起一颗她颜色的点。
  const center = new THREE.Vector3(4, -3, 1);
  const pts: THREE.Vector3[] = [];
  {
    let s = 17;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    while (pts.length < 260) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (v.lengthSq() > 1) continue;
      v.multiplyScalar(26).add(center);
      if (v.x + v.z - (center.x + center.z) > -9) continue;
      pts.push(v);
    }
  }
  const knn = (i: number, k: number) =>
    pts
      .map((q, j) => [j, q.distanceToSquared(pts[i])] as const)
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, k)
      .map(([j]) => j);
  const edges: number[] = [];
  pts.forEach((p, i) => knn(i, 2).forEach((j) => p.distanceTo(pts[j]) < 5 && edges.push(p.x, p.y, p.z, pts[j].x, pts[j].y, pts[j].z)));
  const starGeo = track(new THREE.BufferGeometry().setFromPoints(pts));
  scene.add(new THREE.Points(starGeo, track(new THREE.PointsMaterial({ color: "#d8d0ff", size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.45 }))));
  const edgeGeo = track(new THREE.BufferGeometry());
  edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edges, 3));
  scene.add(new THREE.LineSegments(edgeGeo, track(new THREE.LineBasicMaterial({ color: "#8f84c9", transparent: true, opacity: 0.09 }))));
  const memIdx = pts.reduce((best, q, i) => (q.y > pts[best].y - 4 && q.distanceTo(center) < pts[best].distanceTo(center) ? i : best), 0);
  const memEdges: number[] = [];
  knn(memIdx, 5).forEach((j) => memEdges.push(...pts[memIdx].toArray(), ...pts[j].toArray()));
  const memEdgeGeo = track(new THREE.BufferGeometry());
  memEdgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(memEdges, 3));
  const memEdgeMat = track(new THREE.LineBasicMaterial({ color: MANO.color, transparent: true, opacity: 0 }));
  scene.add(new THREE.LineSegments(memEdgeGeo, memEdgeMat));
  const memStar = glow(MANO.color, 0, scene);
  memStar.position.copy(pts[memIdx]);

  // —— 往上飘的 token（小方块的点），和下面的云海。
  const tokenCount = 140;
  const tokenPos = new Float32Array(tokenCount * 3);
  const tokenCol = new Float32Array(tokenCount * 3);
  const tokenSpeed: number[] = [];
  const palette = [...IDOLS.map((i) => i.color), "#ffffff", "#bcb2ff"].map((c) => new THREE.Color(c));
  for (let i = 0; i < tokenCount; i++) {
    tokenPos.set([-6 + Math.random() * 22, -9 + Math.random() * 16, -6 + Math.random() * 15], i * 3);
    tokenCol.set(palette[i % palette.length].toArray(), i * 3);
    tokenSpeed.push(0.12 + Math.random() * 0.3);
  }
  const tokenGeo = track(new THREE.BufferGeometry());
  tokenGeo.setAttribute("position", new THREE.BufferAttribute(tokenPos, 3));
  tokenGeo.setAttribute("color", new THREE.BufferAttribute(tokenCol, 3));
  scene.add(new THREE.Points(tokenGeo, track(new THREE.PointsMaterial({ size: 2.5, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }))));

  const cloudTex = track(
    canvasTexture(512, 512, (g) => {
      let s = 23;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 120; i++) {
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * 200;
        const x = 256 + Math.cos(a) * d;
        const y = 256 + Math.sin(a) * d;
        const r = 30 + rnd() * 70;
        const fade = 1 - d / 220;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(255,255,255,${(0.22 * fade).toFixed(3)})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }),
  );
  const clouds = [-5.2, -6.6].map((y, k) => {
    const m = mesh(new THREE.PlaneGeometry(30, 30), basic({ map: cloudTex, color: k ? "#4a3d80" : "#7d6fb8", transparent: true, opacity: k ? 0.7 : 0.45, depthWrite: false }), 5, y, 1);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  });

  // —— 漂浮的小方块。
  const floaters: { m: THREE.Mesh; y: number; ph: number }[] = [];
  const floatGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  [[-2.6, 1.4, 2.4, "#f1c9d9"], [7.7, 2.8, -2.4, "#bfe4f7"], [8.4, -1.6, 4.2, "#c7f0b3"], [1.6, 2.6, -2.6, "#ffd2bf"], [2.2, -2.2, 3.4, "#b39ad6"], [12.6, 0.2, 3.2, "#ffd59a"]].forEach(([x, y, z, c], k) => {
    floaters.push({ m: mesh(k ? floatGeo.clone() : floatGeo, lambert(c as string)), y: y as number, ph: k * 1.7 });
    floaters[k].m.position.set(x as number, y as number, z as number);
  });

  const pink = new THREE.Color(MANO.color);
  const LED_IDLE = new THREE.Color("#6ff0d0");
  const msgPos = new THREE.Vector3();

  return {
    message: msgPos,
    update(p, time, camAz) {
      // 1 手机亮起，消息从屏幕出来落到真乃头顶；2 变成她的颜色、收进柱子。
      phone.position.y = 5.6 + Math.sin(time * 0.9) * 0.08;
      phoneGlow.material.opacity = 0.25 + 0.75 * smooth(0.07, 0.1, p) * (1 - smooth(0.16, 0.2, p));
      const start = new THREE.Vector3(0, 0, 0.1).applyMatrix4(phone.matrixWorld);
      const catchAt = IDOLS[0].at.clone().add(new THREE.Vector3(0.15, 2.05, 0));
      const fall = smooth(0.09, 0.17, p);
      const store = smooth(0.22, 0.28, p);
      msgPos.copy(start).lerp(catchAt, fall).lerp(pedTop(0), store);
      msgPos.y += Math.sin(fall * Math.PI) * 0.4 + Math.sin(store * Math.PI) * 0.5;
      message.position.copy(msgPos);
      message.visible = p > 0.085 && store < 1;
      const morph = smooth(0.18, 0.22, p);
      bubble.scale.setScalar(Math.max(0.001, 1 - morph));
      bubble.rotation.y = camAz;
      core.g.scale.setScalar(Math.max(0.001, morph));
      core.m.rotation.set(time * 1.3, time * 0.9, 0);

      // 3 转台和 temperature。
      const turn = smooth(0.31, 0.4, p);
      turntable.rotation.y = lerp(Math.PI / 2, 0, turn);
      knob.rotation.y = turn * Math.PI * 1.5;
      tempLabel.material.opacity = smooth(0.3, 0.32, p) * (1 - smooth(0.43, 0.46, p));

      // 4、7 传出去的几份。
      const go = [smooth(0.43, 0.53, p), smooth(0.75, 0.84, p), smooth(0.76, 0.85, p)];
      const on = [p > 0.42 && go[0] < 1, p > 0.74 && go[1] < 1, p > 0.75 && go[2] < 1];
      copies.forEach((c, k) => {
        c.g.visible = on[k];
        c.g.position.copy(routes[k].getPointAt(go[k]));
        if (k > 0) c.g.position.y += Math.abs(Math.sin(go[k] * Math.PI * 4)) * 0.35;
        c.m.rotation.set(time * 1.3, time * 0.9, 0);
      });
      walkTiles.forEach((t, k) => ((t.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.55 * smooth(0.45 + k * 0.03, 0.48 + k * 0.03, p)));

      stored.forEach((s, k) => {
        const at = STORED_AT[k];
        s.g.visible = p >= at;
        s.g.position.copy(pedTop(k));
        s.g.position.y += Math.sin(time * 1.6 + k) * 0.03;
        const flash = smooth(at, at + 0.015, p) * (1 - smooth(at + 0.03, at + 0.08, p));
        s.glow.scale.setScalar(1.1 + 0.9 * flash + (p > 0.88 ? 0.3 : 0));
        s.m.rotation.y = time * 0.6;
        // 记忆柱的小灯：平时一明一暗地闪，收下时刷成她的颜色。
        dbs[k].leds.forEach((led, j) => {
          const blink = 0.5 + 0.5 * Math.sin(time * (3 + j) + k * 2);
          led.color.copy(LED_IDLE).multiplyScalar(0.4 + 0.6 * blink).lerp(pink, Math.max(flash, p >= at ? 0.6 : 0));
        });
      });

      // 6 台阶一级级升起来。
      const rise = (p - 0.64) / 0.09;
      for (const s of steps) {
        const k = smooth(s.delay, s.delay + 0.5, rise);
        s.mesh.position.y = lerp(s.home - 7, s.home, k);
        s.mesh.visible = k > 0.001;
        (s.mesh.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.4 * smooth(0.76, 0.8, p);
      }

      // 8 收尾：五根线把几块连起来；星图上那颗点。
      threadMat.opacity = 0.75 * smooth(0.87, 0.93, p);
      const memOn = smooth(0.27, 0.3, p);
      memStar.scale.setScalar(memOn * (1.0 + Math.sin(time * 2) * 0.15));
      memEdgeMat.opacity = 0.35 * memOn;

      // 一直在动的：context window 滚动、花瓣、token、云、漂浮的方块。
      tokenTex.offset.y = (time * 0.04) % 1;
      for (let i = 0; i < petalCount; i++) {
        const sd = petalSeed[i];
        const t = (time * 0.12 + sd) % 1;
        petalPos.set([-1.05 + Math.sin(sd * 3) * 0.9 + t * 1.6 + Math.sin(time + sd) * 0.15, 1.6 - t * 2.4, -1.05 + Math.cos(sd * 5) * 0.9 + t * 0.8], i * 3);
      }
      petalGeo.attributes.position.needsUpdate = true;
      for (let i = 0; i < tokenCount; i++) {
        let y = tokenPos[i * 3 + 1] + tokenSpeed[i] * 0.016;
        if (y > 8) y = -9;
        tokenPos[i * 3 + 1] = y;
      }
      tokenGeo.attributes.position.needsUpdate = true;
      clouds.forEach((c, k) => (c.rotation.z = time * (k ? -0.006 : 0.01)));
      tablet.position.y = -3.0 + Math.sin(time * 0.7) * 0.1;
      for (const f of floaters) f.m.position.y = f.y + Math.sin(time * 0.8 + f.ph) * 0.15;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      floatGeo.dispose();
    },
  };
}
