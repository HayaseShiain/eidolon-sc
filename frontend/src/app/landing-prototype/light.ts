/**
 * PROTOTYPE：整页一张全屏 OGL canvas，画白光、棱镜、出口附近的连续色散和 28 道光。
 * 首屏内容画出来以后才动态 import 这个模块（OGL 不进首屏 JS）。
 *
 * - 每道光 = 白色光芯 + 光晕色的光晕，光晕已按亮度反向补偿（color.ts）。
 * - 交叠用 screen，不相加；不做全屏 bloom。
 * - 色散只在转场时出现（uDisp > 0）：光芯按 5/3/1 次光谱采样错开，加逐像素噪声抖动。
 */

import { Mesh, Program, Renderer, Triangle } from "ogl";

import { HUE_RANK, PALETTES, type Scene } from "./scene";

const N = 28;

const vertex = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec3 uBg;
uniform vec4 uBeam;
uniform vec2 uBeamI;
uniform vec4 uPrismAB;
uniform vec4 uPrismC;
uniform vec2 uExit;
uniform vec4 uFan;
uniform vec2 uFan2;
uniform float uDisp;
uniform float uSamples;
uniform vec4 uA[${N}];
uniform vec4 uB[${N}];
uniform vec4 uC[${N}];
uniform vec4 uD[${N}];

// 交错梯度噪声，当蓝噪声用：色散采样的抖动和最后的去色带。
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// w: 0 = 红（偏折最小）… 1 = 紫。
vec3 spectral(float w) {
  float x = mix(0.92, 0.08, w);
  vec3 y = vec3(4.0 * (x - 0.75), 4.0 * (x - 0.5), 4.0 * (x - 0.25));
  return max(1.0 - y * y, 0.0);
}

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - clamp(b, 0.0, 1.0)); }

// 光芯：平时是一条白线；转场时按光谱采样错开，白线的两边裂出彩边。
vec3 core(float perp, float w, float jit) {
  if (uDisp < 0.01 || uSamples < 1.5) { float q = perp / w; return vec3(exp(-q * q)); }
  vec3 acc = vec3(0.0);
  vec3 W = vec3(0.0);
  float wide = w * (1.0 + uDisp * 1.6);
  for (int k = 0; k < 5; k++) {
    if (float(k) >= uSamples) break;
    float t = (float(k) + jit) / uSamples;
    vec3 s = spectral(t);
    float q = (perp + (t - 0.5) * uDisp * 26.0) / wide;
    acc += s * exp(-q * q);
    W += s;
  }
  return acc / max(W, vec3(1e-3)) * (1.0 + uDisp * 0.4);
}

float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

float segDist(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  float jit = ign(gl_FragCoord.xy);
  vec3 acc = vec3(0.0);

  // —— 白光。
  if (uBeamI.x > 0.003) {
    float h;
    float d = segDist(p, uBeam.xy, uBeam.zw, h);
    vec2 ba = normalize(uBeam.zw - uBeam.xy);
    vec2 pa = p - uBeam.xy;
    float perp = h < 0.999 ? ba.x * pa.y - ba.y * pa.x : d;
    vec3 c = core(perp, 1.6, jit) * vec3(1.0, 0.985, 0.96) * 1.15;
    float halo = exp(-d / 14.0) * 0.32 + exp(-d / 80.0) * 0.06;
    vec3 col = (c + vec3(0.86, 0.9, 1.0) * halo) * uBeamI.x;
    float tipD = length(p - uBeam.zw);
    col += vec3(1.0, 0.97, 0.94) * (exp(-tipD / 7.0) * 0.9 + exp(-tipD / 46.0) * 0.22) * uBeamI.y;
    acc = screen(acc, col);
  }

  // —— 棱镜：玻璃的边、极淡的内部、里面的一段光路；完整档加一点焦散。
  if (uPrismC.z > 0.003) {
    vec2 a = uPrismAB.xy, b = uPrismAB.zw, c = uPrismC.xy;
    float sd = sdTri(p, a, b, c);
    float edge = exp(-(sd * sd) / 0.7) * 0.55 + exp(-abs(sd) / 9.0) * 0.07;
    float inside = 1.0 - smoothstep(-1.0, 1.0, sd);
    float h;
    float pathD = segDist(p, uBeam.zw, uExit, h);
    float path = exp(-(pathD * pathD) / 3.0) * 0.5 + exp(-pathD / 10.0) * 0.12;
    float caustic = 0.0;
    if (uPrismC.w > 0.5) {
      float k = sin(p.x * 0.09 + sin(p.y * 0.06 + uTime * 0.9) * 2.2 + uTime * 0.6);
      caustic = pow(0.5 + 0.5 * k, 14.0) * 0.07 * inside * smoothstep(0.0, -18.0, sd);
    }
    vec3 col = vec3(0.92, 0.95, 1.0) * (edge + inside * 0.028 + caustic) + vec3(1.0) * path * inside;
    acc = screen(acc, col * uPrismC.z);
  }

  // —— 出口附近的连续色散：唯一允许出现中间色的地方，往外吸附成 28 道官方色。
  if (uFan2.y > 0.003) {
    vec2 v = p - uFan.xy;
    float r = length(v);
    if (r < uFan2.x) {
      float ang = atan(v.y, v.x) - uFan.z;
      ang = mod(ang + 3.14159265, 6.2831853) - 3.14159265;
      float u = ang / max(uFan.w, 0.003) * 0.5 + 0.5;
      float edge = smoothstep(-0.04, 0.03, u) * (1.0 - smoothstep(0.97, 1.04, u));
      float x = clamp(u, 0.0, 1.0) * ${N - 1}.0;
      vec3 col = vec3(0.0);
      float ws = 0.0;
      for (int i = 0; i < ${N}; i++) {
        float w = max(0.0, 1.0 - abs(x - uD[i].w * ${N - 1}.0));
        col += uC[i].rgb * w;
        ws += w;
      }
      col /= max(ws, 1e-3);
      col = mix(vec3(1.0), col, smoothstep(0.0, uFan2.x * 0.4, r));
      float fall = (1.0 - smoothstep(uFan2.x * 0.3, uFan2.x, r)) * smoothstep(0.0, 4.0, r);
      acc = screen(acc, col * edge * fall * 0.7 * uFan2.y);
    }
  }

  // —— 28 道光。
  for (int i = 0; i < ${N}; i++) {
    vec4 c = uC[i];
    if (c.w < 0.004) continue;
    vec4 a = uA[i];
    vec4 b = uB[i];
    vec4 d = uD[i];
    vec2 v = p - a.xy;
    float perp = a.z * v.y - a.w * v.x;
    float ap = abs(perp);
    if (ap > d.y * 7.0 + 30.0) continue;
    float t = dot(v, a.zw);
    float along = smoothstep(b.y, b.y + 90.0, t) * (1.0 - smoothstep(b.x * 0.8, b.x, t));
    if (along <= 0.0) continue;
    float gap = 0.0;
    if (b.w > b.z + 1.0) gap = smoothstep(b.z - 16.0, b.z + 4.0, t) * (1.0 - smoothstep(b.w - 4.0, b.w + 16.0, t));
    vec3 k = core(perp, d.x, jit) * (1.0 - gap);
    float halo = (exp(-ap / d.y) * 0.45 + exp(-(ap * ap) / (d.y * d.y * 0.08)) * 0.4 * (1.0 - 0.6 * gap)) * d.z;
    // 余烬：光芯比光晕降得更快，暗下去的光剩下的是她的颜色，不是一根白线。
    vec3 col = (mix(vec3(1.0), c.rgb, 0.15) * k * 1.05 * (0.3 + 0.7 * min(c.w, 1.0)) + c.rgb * halo) * c.w * along;
    acc = screen(acc, col);
  }

  vec3 col = screen(uBg, acc);
  col = mix(12.92 * col, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));
  col += (jit - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export type Quality = { dpr: number; samples: number; caustics: boolean };

export type Light = {
  resize(w: number, h: number): void;
  setQuality(q: Quality): void;
  render(scene: Scene, time: number): void;
  destroy(): void;
};

export function createLight(canvas: HTMLCanvasElement, quality: Quality): Light {
  const renderer = new Renderer({ canvas, dpr: quality.dpr, alpha: false, antialias: false, depth: false });
  const gl = renderer.gl;
  const A: number[] = new Array(N * 4).fill(0);
  const B: number[] = new Array(N * 4).fill(0);
  const C: number[] = new Array(N * 4).fill(0);
  const D: number[] = new Array(N * 4).fill(0);
  const program = new Program(gl, {
    vertex,
    fragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRes: { value: [1, 1] },
      uDpr: { value: quality.dpr },
      uTime: { value: 0 },
      uBg: { value: [0, 0, 0] },
      uBeam: { value: [0, 0, 0, 0] },
      uBeamI: { value: [0, 0] },
      uPrismAB: { value: [0, 0, 0, 0] },
      uPrismC: { value: [0, 0, 0, 0] },
      uExit: { value: [0, 0] },
      uFan: { value: [0, 0, 0, 0] },
      uFan2: { value: [0, 0] },
      uDisp: { value: 0 },
      uSamples: { value: quality.samples },
      uA: { value: A },
      uB: { value: B },
      uC: { value: C },
      uD: { value: D },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  let q = quality;
  let size = { w: 1, h: 1 };
  const u = program.uniforms;

  return {
    resize(w, h) {
      size = { w, h };
      renderer.dpr = q.dpr;
      renderer.setSize(w, h);
      u.uRes.value = [w, h];
      u.uDpr.value = q.dpr;
    },
    setQuality(next) {
      q = next;
      u.uSamples.value = next.samples;
      this.resize(size.w, size.h);
    },
    render(scene, time) {
      u.uTime.value = time;
      u.uBg.value = scene.bg;
      const { beam, prism, fan } = scene;
      u.uBeam.value = [beam.x0, beam.y0, beam.x1, beam.y1];
      u.uBeamI.value = [beam.i, beam.tip];
      u.uPrismAB.value = [prism.ax, prism.ay, prism.bx, prism.by];
      u.uPrismC.value = [prism.cx, prism.cy, prism.i, q.caustics ? 1 : 0];
      u.uExit.value = [prism.ex, prism.ey];
      u.uFan.value = [fan.ox, fan.oy, fan.angle, fan.spread];
      u.uFan2.value = [fan.radius, fan.i];
      u.uDisp.value = q.samples > 1 ? scene.disp : 0;
      scene.bands.forEach((b, i) => {
        const p = PALETTES[i];
        put(A, i, b.ox, b.oy, b.dx, b.dy);
        put(B, i, b.len, b.start, b.gap0, b.gap1);
        put(C, i, p.halo[0], p.halo[1], p.halo[2], b.intensity);
        put(D, i, b.coreW, b.haloR, p.haloGain, HUE_RANK[i] / (N - 1));
      });
      // A–D 是就地改的；OGL 把上一帧的值另存一份来比较，改过的会重传。
      renderer.render({ scene: mesh });
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

// OGL 只认普通数组形式的 uniform 数组（`uA[0]` 要靠 Array.isArray 才对得上），所以不用 Float32Array。
function put(arr: number[], i: number, x: number, y: number, z: number, w: number) {
  arr[i * 4] = x;
  arr[i * 4 + 1] = y;
  arr[i * 4 + 2] = z;
  arr[i * 4 + 3] = w;
}
