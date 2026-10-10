/**
 * PROTOTYPE：每位偶像离线算一组同色相的颜色（拷问记录「角色与光」）。官方色本身不改，
 * 另外推出光晕色（按亮度反向补偿）、极深底色和文字色；插值都在 OKLab 里做。
 */

export type Vec3 = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToLinear(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
}

export function linearToHex([r, g, b]: Vec3): string {
  const c = (x: number) =>
    Math.round(Math.min(1, Math.max(0, toSrgb(x))) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function linearToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (c: Vec3) => c.every((x) => x >= -1e-4 && x <= 1 + 1e-4);

/** OKLCh → 线性 sRGB，超出色域时只降彩度。 */
export function oklch(L: number, C: number, h: number): Vec3 {
  for (let c = C; c >= 0; c -= 0.004) {
    const rgb = oklabToLinear([L, c * Math.cos(h), c * Math.sin(h)]);
    if (inGamut(rgb)) return rgb.map((x) => Math.min(1, Math.max(0, x))) as Vec3;
  }
  return oklabToLinear([L, 0, 0]);
}

export function mixOklab(a: Vec3, b: Vec3, t: number): Vec3 {
  const A = linearToOklab(a);
  const B = linearToOklab(b);
  return oklabToLinear([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type Palette = {
  /** 官方色，线性 sRGB。 */
  official: Vec3;
  /** 光晕色：暗色把亮度抬到 0.66 以上（同色相），彩度跟着放大一点。 */
  halo: Vec3;
  /** 光晕强度：太亮的（めぐる的黄、千雪的白）压一点，免得刺眼。 */
  haloGain: number;
  /** 光晕半径倍数：暗色晕得更开，才在黑底上立得住。 */
  haloSpread: number;
  /** 聚焦时的背景：她的极深同色相。 */
  deep: Vec3;
  deepHex: string;
  /** 黑底上写她名字的颜色。 */
  textHex: string;
  haloHex: string;
  L: number;
  C: number;
  /** 分光时按色相出射的排序键：粉、红、橙、黄、绿、青、蓝、紫。 */
  hueKey: number;
};

export function palette(hex: string): Palette {
  const official = hexToLinear(hex);
  const [L, a, b] = linearToOklab(official);
  const C = Math.hypot(a, b);
  const h = Math.atan2(b, a);
  const haloL = Math.min(0.86, Math.max(L, 0.66));
  const haloC = C < 0.02 ? C : Math.min(0.2, C * Math.sqrt(haloL / Math.max(L, 0.05)));
  const halo = oklch(haloL, haloC, h);
  const deep = oklch(0.2, Math.min(C * 0.45, 0.07), h);
  const deg = ((h * 180) / Math.PI + 360) % 360;
  return {
    official,
    halo,
    haloGain: 1 - 0.42 * smooth(0.72, 0.97, L),
    haloSpread: 1 + 0.9 * (1 - smooth(0.25, 0.62, L)),
    deep,
    deepHex: linearToHex(deep),
    textHex: linearToHex(oklch(0.9, Math.min(C * 0.6, 0.09), h)),
    haloHex: linearToHex(halo),
    L,
    C,
    hueKey: C < 0.02 ? 1000 : (deg - 345 + 360) % 360,
  };
}
