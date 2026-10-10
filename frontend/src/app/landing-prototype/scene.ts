/**
 * PROTOTYPE：落地页第 0–2 幕的「场景」——给定视口、滚动进度和聚焦，算出白光、棱镜、连续色散区
 * 和 28 道光各自的位置与强度。DOM（名牌、横移）和着色器用同一套数学，两边才对得齐。
 *
 * 一道光统一表示成一条射线：起点 o、方向 d、长度 len。分光时 28 条射线从棱镜出口按色相扇出（状态 A），
 * 归队时拉直成按偶像编号排开的 28 根竖线（状态 B，「光谱尺」），进入第 2 幕时放大到横滚轨道上的位置
 * （状态 C）。三个状态之间逐道插值，就是「扇形 → 拉直 → 归队」的转场。
 */

import { BUILT_UNITS, IDOLS, UNITS } from "./data";
import { palette, type Palette, type Vec3 } from "./color";

export type Dir = "ltr" | "rtl";

/** 第 1 幕占几屏滚动；第 2 幕先「放大」，再每个组合一段（停留 + 整页推入）。 */
export const ACT1_SCREENS = 3.2;
export const ZOOM_SCREENS = 0.9;
export const SEG_SCREENS = 1.5;
export const TAIL_SCREENS = 0.4;
export const STAGE_SCREENS = ACT1_SCREENS + ZOOM_SCREENS + BUILT_UNITS * SEG_SCREENS + TAIL_SCREENS;

export const PALETTES: Palette[] = IDOLS.map((idol) => palette(idol.color));

/** 色相出射的名次（0 = 偏折最小的粉红，27 = 偏折最大）。 */
export const HUE_RANK: number[] = (() => {
  const order = IDOLS.map((_, i) => i).sort((a, b) => PALETTES[a].hueKey - PALETTES[b].hueKey);
  const rank = new Array<number>(IDOLS.length);
  order.forEach((idx, r) => (rank[idx] = r));
  return rank;
})();

const UNIT_MEMBERS: number[][] = UNITS.map((_, u) =>
  IDOLS.map((idol, i) => (idol.unit === u ? i : -1)).filter((i) => i >= 0),
);

export type Band = {
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  len: number;
  /** 射线从这里开始淡入（分光时让出口附近留给连续色散）。 */
  start: number;
  gap0: number;
  gap1: number;
  coreW: number;
  haloR: number;
  core: number;
  intensity: number;
};

export type Scene = {
  bg: Vec3;
  beam: { x0: number; y0: number; x1: number; y1: number; i: number; tip: number };
  prism: { ax: number; ay: number; bx: number; by: number; cx: number; cy: number; i: number; ex: number; ey: number };
  fan: { ox: number; oy: number; angle: number; spread: number; radius: number; i: number };
  disp: number;
  bands: Band[];
};

export type Frame = {
  scene: Scene;
  /** DOM 跟着走的部分。 */
  act: number;
  act1Copy: number;
  plates: number;
  /** 横滚轨道的位移（像素，已过弹簧）。 */
  trackX: number;
  unit: number;
};

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const DEG = Math.PI / 180;

export type Viewport = { w: number; h: number };

export const isPortrait = ({ w, h }: Viewport) => h > w * 1.1;

/** 左侧幕名轨占的宽度，名牌和光谱尺都让开它。 */
const railWidth = ({ w }: Viewport) => (w < 640 ? 36 : 72);

/** 第 2 幕横滚轨道上，第 u 个组合第 j 位成员的横坐标（轨道位移为 0 时）。 */
export function slotX(vp: Viewport, dir: Dir, u: number, j: number, n: number): number {
  const left = railWidth(vp) + vp.w * 0.06;
  const right = vp.w * 0.06;
  const k = dir === "ltr" ? j : n - 1 - j;
  const inner = left + ((k + 0.5) / n) * (vp.w - left - right);
  return dir === "ltr" ? u * vp.w + inner : -u * vp.w + inner;
}

/** 光谱尺：28 根竖线按偶像编号排满一屏，组合之间留一点空。 */
function rulerX(vp: Viewport, dir: Dir, i: number): number {
  const left = railWidth(vp) + vp.w * 0.05;
  const right = vp.w * 0.05;
  const gap = 0.9;
  const slots = IDOLS.length + (UNITS.length - 1) * gap;
  const k = i + IDOLS[i].unit * gap;
  const x = left + ((k + 0.5) / slots) * (vp.w - left - right);
  return dir === "ltr" ? x : vp.w - x;
}

/** 棱镜和白光的锚点：第 0 幕时白光的终点，第 1 幕时棱镜的入射点。 */
function geometry(vp: Viewport, act1: number) {
  const { w, h } = vp;
  const portrait = isPortrait(vp);
  const fwd: [number, number] = portrait ? [0, 1] : [1, 0];
  const side: [number, number] = portrait ? [-1, 0] : [0, 1];
  const p0 = portrait ? [w * 0.5, h * 0.3] : [w * 0.46, h * 0.66];
  const p1 = portrait ? [w * 0.56, h * 0.17] : [w * 0.3, h * 0.42];
  const m = easeInOut(smooth(0, 0.14, act1));
  const entry = [lerp(p0[0], p1[0], m), lerp(p0[1], p1[1], m)];
  const s = portrait ? w * 0.24 : Math.min(w, h) * 0.17;
  const at = (u: number, v: number): [number, number] => [
    entry[0] + fwd[0] * (u + 0.25 * s) + side[0] * (v + 0.144 * s),
    entry[1] + fwd[1] * (u + 0.25 * s) + side[1] * (v + 0.144 * s),
  ];
  return {
    portrait,
    fwd,
    side,
    entry,
    s,
    apex: at(0, -0.577 * s),
    baseL: at(-0.5 * s, 0.289 * s),
    baseR: at(0.5 * s, 0.289 * s),
    exit: at(0.25 * s, -0.144 * s),
    fanLen: portrait ? h * 1.05 : w * 1.15,
    fanRadius: Math.min(portrait ? 200 : 300, (portrait ? h : w) * 0.24),
    baseAngle: Math.atan2(fwd[1], fwd[0]) + (portrait ? 5 : 9) * DEG,
    spreadMax: (portrait ? 13 : 15) * DEG,
  };
}

export type Input = {
  vp: Viewport;
  dir: Dir;
  /** 第 0 幕的滚动进度（0–1，标题滚出去的过程）。 */
  act0: number;
  /** 舞台钉住以后滚过的屏数。 */
  stage: number;
  /** 舞台解开钉住以后，整个画面要跟着往上走的像素。 */
  liftY: number;
  /** 名牌的文字在竖线上占的区间（舞台坐标），用来把光芯在名字处断开。 */
  gaps: ([number, number] | null)[];
  focus: number;
  time: number;
};

/** 跨帧的平滑状态：横移弹簧、背景色、每道光的聚焦明暗。 */
export type Motion = {
  track: number;
  velocity: number;
  bg: Vec3;
  dim: number[];
  focusAmt: number;
};

export const newMotion = (): Motion => ({
  track: 0,
  velocity: 0,
  bg: [0.0016, 0.0016, 0.0021],
  dim: IDOLS.map(() => 1),
  focusAmt: 0,
});

const BLACK: Vec3 = [0.0016, 0.0016, 0.0021];

/** 横滚目标（单位：段）。停留时也慢慢漂一点，推入时用缓动加速走完剩下的一屏。 */
function trackTarget(seg: number): { pos: number; push: number } {
  const total = BUILT_UNITS - 1;
  const s = clamp(seg, 0, BUILT_UNITS);
  const k = Math.min(Math.floor(s), total);
  const local = s - k;
  if (k >= total) return { pos: total + Math.min(local, 1) * 0.04, push: 0 };
  const HOLD = 0.55;
  const drift = 0.08;
  if (local < HOLD) return { pos: k + (local / HOLD) * drift, push: 0 };
  const t = (local - HOLD) / (1 - HOLD);
  return { pos: k + drift + easeInOut(t) * (1 - drift), push: Math.sin(Math.PI * t) };
}

export function computeFrame(input: Input, motion: Motion, dt: number, springOn: boolean): Frame {
  const { vp, dir, stage, gaps, focus, time } = input;
  const act1 = clamp(stage / ACT1_SCREENS);
  const zoom = clamp((stage - ACT1_SCREENS) / ZOOM_SCREENS);
  const seg = Math.max(0, (stage - ACT1_SCREENS - ZOOM_SCREENS) / SEG_SCREENS);
  const g = geometry(vp, act1);

  // —— 横滚弹簧：目标来自滚动进度，弹簧只让起停更软，不改变终点。
  const target = trackTarget(seg);
  if (springOn && dt > 0) {
    const k = 120;
    const c = 2 * Math.sqrt(k) * 0.92;
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let n = 0; n < steps; n++) {
      const a = k * (target.pos - motion.track) - c * motion.velocity;
      motion.velocity += a * h;
      motion.track += motion.velocity * h;
    }
  } else {
    motion.track = target.pos;
    motion.velocity = 0;
  }
  const trackX = (dir === "ltr" ? -1 : 1) * motion.track * vp.w;

  // —— 聚焦：背景过渡到她的极深同色相，其余降亮。
  const ease = 1 - Math.exp(-dt / 0.22);
  const focusOn = focus >= 0 && zoom > 0.9;
  motion.focusAmt += ((focusOn ? 1 : 0) - motion.focusAmt) * ease;
  const bgTarget = focusOn ? PALETTES[focus].deep : BLACK;
  motion.bg = motion.bg.map((x, i) => x + (bgTarget[i] - x) * ease) as Vec3;
  IDOLS.forEach((_, i) => {
    const want = !focusOn ? 1 : i === focus ? 1.12 : 0.22;
    motion.dim[i] += (want - motion.dim[i]) * ease;
  });

  // —— 第 1 幕的时间线。
  const prismIn = smooth(0.02, 0.14, act1) * (1 - smooth(0.74, 0.88, act1));
  const open = easeInOut(smooth(0.12, 0.46, act1));
  const regroup = smooth(0.72, 1, act1);
  const sweep = lerp(-3, IDOLS.length + 2, smooth(0.14, 0.7, act1));
  const fanI = smooth(0.1, 0.2, act1) * (1 - regroup);

  const curUnit = clamp(Math.round(motion.track), 0, BUILT_UNITS - 1);

  const bands: Band[] = IDOLS.map((idol, i) => {
    const p = PALETTES[i];
    const rank = HUE_RANK[i];
    // 状态 A：从出口扇出。
    const ang = g.baseAngle + (rank / (IDOLS.length - 1) - 0.5) * 2 * g.spreadMax * open;
    const A = {
      ox: g.exit[0],
      oy: g.exit[1],
      dx: Math.cos(ang),
      dy: Math.sin(ang),
      len: g.fanLen * (0.15 + 0.85 * open),
      start: g.fanRadius * 0.45,
      coreW: 1.1,
      haloR: 9,
      intensity: (0.1 + 0.9 * Math.exp(-(((rank - sweep) / 1.7) ** 2))) * fanI,
    };
    // 状态 B：光谱尺。
    const B = {
      ox: rulerX(vp, dir, i),
      oy: -40,
      dx: 0,
      dy: 1,
      len: vp.h + 80,
      start: -200,
      coreW: 0.9,
      haloR: Math.max(5, vp.w / 150),
      intensity: idol.unit === 0 ? 0.95 : 0.34,
    };
    // 状态 C：横滚轨道。
    const members = UNIT_MEMBERS[idol.unit];
    const j = members.indexOf(i);
    const inSeg = idol.unit === curUnit || (idol.unit < BUILT_UNITS && Math.abs(motion.track - idol.unit) < 0.98);
    const C = {
      ox: slotX(vp, dir, idol.unit, j, members.length) + trackX,
      intensity: (inSeg ? 0.82 : 0.14) * motion.dim[i],
      haloR: 46,
      coreW: 1.4,
    };
    // 逐道错开一点，转场不是整齐划一地动。
    const stagger = (k: number, t: number, spread: number) => smooth(k * spread, k * spread + (1 - spread * 27), t);
    const order = dir === "ltr" ? i : IDOLS.length - 1 - i;
    const tb = easeInOut(stagger(order, regroup, 0.012));
    const tc = easeInOut(stagger(dir === "ltr" ? i : IDOLS.length - 1 - i, zoom, 0.006));
    // 名字的区间换算成沿竖线的距离（竖线从 oy = -40 开始）。
    const gap = gaps[i] && ([gaps[i]![0] - B.oy, gaps[i]![1] - B.oy] as const);
    const gapAmt = smooth(0.6, 1, zoom);
    let dx = lerp(A.dx, B.dx, tb);
    let dy = lerp(A.dy, B.dy, tb);
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    return {
      ox: lerp(lerp(A.ox, B.ox, tb), C.ox, tc),
      oy: lerp(A.oy, B.oy, tb),
      dx,
      dy,
      len: lerp(A.len, B.len, tb),
      start: lerp(A.start, B.start, tb),
      gap0: gap && gapAmt > 0 ? lerp(gap[0] + (gap[1] - gap[0]) / 2, gap[0], gapAmt) : 0,
      gap1: gap && gapAmt > 0 ? lerp(gap[0] + (gap[1] - gap[0]) / 2, gap[1], gapAmt) : 0,
      coreW: lerp(lerp(A.coreW, B.coreW, tb), C.coreW, tc),
      haloR: lerp(lerp(A.haloR, B.haloR, tb), C.haloR, tc) * p.haloSpread,
      core: 1,
      intensity: lerp(lerp(A.intensity, B.intensity, tb), C.intensity, tc),
    };
  });

  // 白光：第 0 幕从左边缘到锚点；第 1 幕射进棱镜，归队时熄掉（它已经变成了 28 道光的光芯）。
  const beamI = 1 - smooth(0.74, 0.86, act1);
  const breathe = 0.75 + 0.25 * Math.sin(time * 1.6);
  const back = Math.max(vp.w, vp.h) * 1.5;
  const lift = input.liftY;
  if (lift) bands.forEach((b) => (b.oy -= lift));

  return {
    scene: {
      bg: motion.bg,
      beam: {
        x0: g.entry[0] - g.fwd[0] * back,
        y0: g.entry[1] - g.fwd[1] * back - lift,
        x1: g.entry[0],
        y1: g.entry[1] - lift,
        i: beamI,
        tip: (1 - prismIn) * breathe * beamI,
      },
      prism: {
        ax: g.apex[0],
        ay: g.apex[1],
        bx: g.baseL[0],
        by: g.baseL[1],
        cx: g.baseR[0],
        cy: g.baseR[1],
        i: prismIn,
        ex: g.exit[0],
        ey: g.exit[1],
      },
      fan: {
        ox: g.exit[0],
        oy: g.exit[1],
        angle: g.baseAngle,
        spread: g.spreadMax * open,
        radius: g.fanRadius,
        i: fanI,
      },
      // 色散只在转场时出现：归队、放大、整页推入。
      disp: Math.max(Math.sin(Math.PI * regroup) * (act1 < 1 ? 1 : 0), 0.55 * Math.sin(Math.PI * zoom), 0.4 * target.push),
      bands,
    },
    act: stage <= 0 ? 0 : zoom <= 0 ? 1 : 2,
    act1Copy: smooth(0.4, 0.48, act1) * (1 - smooth(0.66, 0.72, act1)),
    plates: smooth(0.45, 0.9, zoom),
    trackX,
    unit: curUnit,
  };
}

/** 「减少动态效果」档定格的那一帧：分光完全展开、扫过一半时的样子。 */
export function frozenFrame(vp: Viewport, dir: Dir): Scene {
  const f = computeFrame(
    { vp, dir, act0: 1, stage: ACT1_SCREENS * 0.56, liftY: 0, gaps: [], focus: -1, time: 0 },
    newMotion(),
    0,
    false,
  );
  // 定格时 28 道光都留一点亮度，不然只剩扫到的那几道。
  f.scene.bands.forEach((b) => (b.intensity = Math.max(b.intensity, 0.42)));
  f.scene.beam.tip = 0;
  return f.scene;
}
