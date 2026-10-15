// PROTOTYPE：捏出来的体素小人（第四轮），对着 .scratch/_refs/<id>-turnaround.png 一部分一部分定尺寸。
// 只在 prototype/landing-memory-3d 分支，不进 main。单位是体素，约 47 格高（到头顶）。

import { blob, both, box, capsule, frustum, Part, where, type Model } from "./sculpt";

const SKIN = "#fde6d8";

export function mano(): Model {
  const NAVY = "#2b3152";
  const NAVY_DARK = "#232842";
  const WHITE = "#f4f4f7";
  const HAIR = "#e9b48c";
  const body = new Part([0, 0, 0]);

  // —— 鞋、腿、袜子。
  both((s) => {
    const x0 = s < 0 ? -4 : 1;
    const x1 = s < 0 ? -1 : 4;
    body.add(box([x0, 0, -2], [x1, 2, 3]), (x, y) => (y === 0 ? "#3e2416" : y === 2 ? "#7d4a2c" : "#6b3f25"));
    body.carve(box([x0, 2, 3], [x1, 2, 3]));
    const lx0 = s < 0 ? -3 : 1;
    const lx1 = s < 0 ? -1 : 3;
    body.add(box([lx0, 3, -1], [lx1, 13, 1]), (_x, y) => (y <= 7 ? WHITE : y === 8 ? "#3a4268" : SKIN));
  });

  // —— 格子百褶裙：上窄下宽的锥台，绕一圈的竖线和一道道横线。
  const plaid = (x: number, y: number, z: number) => {
    const u = Math.round(Math.atan2(x, z) * 7);
    const lineU = ((u % 4) + 4) % 4 === 0;
    const lineV = y % 3 === 0;
    if (lineU && lineV) return "#3f8aa0";
    if (lineU) return "#5aa6b8";
    if (lineV) return "#93c9d8";
    return ((u % 2) + 2) % 2 ? "#d6ecf2" : "#c7e3ec";
  };
  body.add(frustum(0, 0, 12, 18, [8, 6.6], [5.4, 4.2], 2.3), plaid);

  // —— 上身：深蓝的水手服，前面是 V 字白领、里面白色的衬底，胸前浅蓝格子领结；背后一块方形的白色披领。
  body.add(blob([0, 22.5, 0], [5, 4.6, 3.6], 4), NAVY);
  body.add(box([-1, 27, -1], [1, 28, 1]), SKIN);
  body.add(frustum(0, -0.3, 25, 27.6, [6.1, 4.4], [4.4, 3.2], 3), WHITE);
  body.paint(
    where(box([-6, 21, 1.5], [6, 28, 6]), () => true),
    (x, y) => {
      const d = Math.abs(x) - (y - 21.5) * 0.85;
      if (d < -1.2) return x === 0 && y === 25 ? "#5aa6c8" : WHITE;
      if (d < 0) return NAVY;
      if (d < 2.4) return d > 0.9 && d < 1.5 ? NAVY : WHITE;
      return y >= 25 ? WHITE : NAVY;
    },
  );
  body.add(box([-5, 21, -4.6], [5, 27, -3.6]), (x, y) => (Math.abs(x) === 4 || y === 22 ? NAVY : WHITE));
  body.paint(box([-6, 18, -4], [6, 18, 4]), NAVY_DARK);
  both((s) => body.add(blob([s * 2, 23, 3.9], [2.1, 1.6, 1]), (x, y) => ((x + y) % 3 === 0 ? "#5aa6c8" : "#b6dce8")));
  body.add(box([0, 22, 4], [0, 24, 5]), "#4f93ab");
  both((s) => body.add(box([s, 20, 4], [s, 21, 4]), "#8cc4d6"));

  // —— 手臂：从肩膀斜斜垂下，袖口白底一道深蓝，手是皮肤色的小椭球。
  const arm = (s: 1 | -1) => {
    const p = new Part([s * 5.5, 26, 0]);
    const sleeve = capsule([s * 6, 25.5, 0], [s * 8, 19, 0.5], 1.75, 1.55);
    p.add(sleeve, NAVY);
    p.paint(where(sleeve, (_x, y) => y <= 20.5), (_x, y) => (y === 20 ? NAVY : WHITE));
    p.add(blob([s * 8.4, 17.4, 0.8], [1.3, 1.7, 1.3]), SKIN);
    return p;
  };

  // —— 头：皮肤的圆角方块，外面一层头发壳挖出脸；刘海下沿参差；后面和两侧的头发垂到肩上、往外翻。
  const head = new Part([0, 28, 0]);
  const hair = (x: number, y: number, z: number) => {
    if (y >= 41 && y <= 42 && z > 3 && Math.abs(x) >= 2 && Math.abs(x) <= 7 && (x + y) % 2 === 0) return "#f8d6b4";
    if (y < 40 && (((x * 3 + z) % 7) + 7) % 7 === 0) return "#d39a70";
    return HAIR;
  };
  head.add(blob([0, 37.4, -0.4], [9.8, 9.6, 9], 2.6), hair);
  head.add(frustum(0, -1.5, 24, 33, [11, 8.6], [9.6, 8], 2.3), hair);
  // 先把头发挖好（脸前面、脖子前面），再往空出来的地方填脸。
  head.carve(box([-7.4, 23, 1], [7.4, 34, 10]));
  const fringe = [2, 1, 0, 1, 2, 1, 0, 1, 0, 1, 2, 1, 0, 1, 2];
  head.carve(where(box([-7, 26, 1.5], [7, 41, 10]), (x, y) => y < 38 + fringe[x + 7]));
  head.fill(blob([0, 36.5, 0.5], [8.8, 8.3, 7.8], 3), SKIN);
  head.carve(where(box([-12, 23, -10], [12, 26, 10]), (x, y, z) => y < 24 + ((((x * 7 + z * 5) % 3) + 3) % 3)));
  // 发梢往外翻的颜色深一点。
  head.paint(where(box([-12, 23, -10], [12, 25, 10]), () => true), "#d39a70");
  head.decal(
    // 眼睛是 2 宽 3 高的竖长圆眼：上面一格深色，高光都在左上（同一个光源），下面一格浅；嘴是一格小点。
    [
      "..LL.......LL..",
      "..WE.......WE..",
      "..Ee.......Ee..",
      "...............",
      ".BB.........BB.",
      ".......M.......",
    ],
    { L: "#4f2f24", W: "#ffffff", E: "#8f5a40", e: "#c99470", B: "#f6b3bc", M: "#cf7a84" },
    -7,
    36,
  );
  // 头上的小白鸽。
  head.add(blob([1, 47.6, -0.5], [3, 2.3, 3.8]), "#fafaff");
  head.add(blob([1, 49.6, 2.6], [1.8, 1.8, 1.8]), "#fafaff");
  head.add(box([1, 49, 4.5], [1, 49, 5]), "#f2a64a");
  head.paint(box([0, 50, 3], [0, 50, 4]), "#1b1820");
  head.paint(box([2, 50, 3], [2, 50, 4]), "#1b1820");
  head.paint(where(blob([1, 47.6, -0.5], [3, 2.3, 3.8]), (x, y) => Math.abs(x - 1) >= 2 && y <= 48), "#e4e4ee");
  head.add(box([0, 47, -5.6], [2, 47, -4]), "#e4e4ee");

  return { height: 47, body, head, armR: arm(-1), armL: arm(1), pose: { r: [0, -0.12], l: [0, 0.12] } };
}

export const MODELS: Record<string, () => Model> = { mano };
