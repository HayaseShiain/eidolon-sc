// PROTOTYPE（bar 地图票 08）：像素字。原版的字是按原尺寸栅格化的位图（中文 Noto Sans CJK 13px、英文 Inconsolata 12px），
// 再跟画面一起整数倍放大，所以笔画边缘是硬的。这里照做：在逻辑像素大小的 canvas 上写字，去掉抗锯齿（透明度二值化），
// canvas 再跟着画面 pixelated 放大。字体可以换成「缝合像素」12px（OFL），比较哪个更像。

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type TextFont = "noto" | "fusion" | "hd";
export type Run = { text: string; color?: string };

/** 字体：noto 用应用已经载入的 Noto Sans SC / JP（next/font 的 --font-zh、--font-ja）；英文标签用等宽（原版 Inconsolata）。 */
function family(font: TextFont, mono: boolean): string {
  if (font === "fusion") return '"BarFusionPixel", monospace';
  const css = getComputedStyle(document.body);
  const zh = css.getPropertyValue("--font-zh").trim();
  const ja = css.getPropertyValue("--font-ja").trim();
  if (mono) return 'Inconsolata, Consolas, "Cascadia Mono", ui-monospace, monospace';
  return [zh, ja, '"Noto Sans SC"', '"Microsoft YaHei"', "sans-serif"].filter(Boolean).join(", ");
}

const isWordChar = (c: string) => /[A-Za-z0-9'’.\-!?%#&*@]/.test(c);

type Glyph = { ch: string; color: string };

/** 按宽度折行：中日文逐字可断，英文单词整体挪到下一行；`\n` 强制换行。 */
function layout(ctx: CanvasRenderingContext2D, runs: Run[], color: string, width: number): Glyph[][] {
  const glyphs: Glyph[] = [];
  for (const run of runs) for (const ch of run.text) glyphs.push({ ch, color: run.color ?? color });
  const lines: Glyph[][] = [[]];
  let x = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    if (g.ch === "\n") {
      lines.push([]);
      x = 0;
      continue;
    }
    let advance = ctx.measureText(g.ch).width;
    if (isWordChar(g.ch) && (i === 0 || !isWordChar(glyphs[i - 1].ch))) {
      // 一个英文单词的开头：整词放不下就先换行
      let j = i;
      let w = 0;
      while (j < glyphs.length && isWordChar(glyphs[j].ch)) w += ctx.measureText(glyphs[j++].ch).width;
      if (x > 0 && x + w > width && w <= width) {
        lines.push([]);
        x = 0;
      }
    }
    if (x > 0 && x + advance > width) {
      if (g.ch === " ") continue;
      lines.push([]);
      x = 0;
      advance = ctx.measureText(g.ch).width;
    }
    lines[lines.length - 1].push(g);
    x += advance;
  }
  return lines;
}

export function PixelText({
  x,
  y,
  w,
  h,
  runs,
  size = 13,
  lineHeight,
  color = "#fff",
  font,
  mono = false,
  bold = false,
  italic = false,
  align = "left",
  className,
  style,
}: {
  x: number;
  y: number;
  /** 不给：单行，按字宽自动。 */
  w?: number;
  h?: number;
  runs: Run[] | string;
  size?: number;
  lineHeight?: number;
  color?: string;
  font: Exclude<TextFont, "hd">;
  mono?: boolean;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center";
  className?: string;
  style?: CSSProperties;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const list: Run[] = typeof runs === "string" ? [{ text: runs }] : runs;
  const key = JSON.stringify(list);
  // 缝合像素只在 12 的整数倍上清楚
  const px = font === "fusion" ? Math.max(12, Math.round(size / 12) * 12) : size;
  const lh = lineHeight ?? Math.round(px * 1.25);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: w ?? 1, h: h ?? lh });
  const [fontsReady, setFontsReady] = useState(0);

  // 字体（含 next/font 按字切的子集）载入后重画一次
  useEffect(() => {
    const fam = family(font, mono);
    const text = list.map((r) => r.text).join("") || "a";
    let live = true;
    void document.fonts.load(`${px}px ${fam}`, text).then(() => live && setFontsReady((n) => n + 1));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, font, mono, px]);

  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const fontSpec = `${italic ? "italic " : ""}${bold ? "bold " : ""}${px}px ${family(font, mono)}`;
    ctx.font = fontSpec;
    const width = w ?? Math.ceil(list.reduce((n, r) => n + ctx.measureText(r.text).width, 0)) + 2;
    const lines = w === undefined ? [list.flatMap((r) => [...r.text].map((ch) => ({ ch, color: r.color ?? color })))] : layout(ctx, list, color, width);
    const height = h ?? lines.length * lh;
    // 缝合像素里有些字（键、移、除、她……）是从别的字号的像素字体补进来的，点阵落在半像素上，12px 画出来是灰的；
    // 按 2 倍画就落在整像素上。画布 2 倍大、CSS 尺寸仍是逻辑像素（电脑上画面放大 2 倍时正好 1:1）。
    const k = font === "fusion" ? 2 : 1;
    if (c.width !== width * k || c.height !== height * k) {
      c.width = width * k;
      c.height = height * k;
    }
    if (box.w !== width || box.h !== height) setBox({ w: width, h: height });
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = fontSpec;
    // 顶端对齐到整数像素：像素字体的点阵才正好落在格子上（居中对齐会落在半像素上，一模糊、二值化后笔画发粗）
    ctx.textBaseline = "top";
    lines.forEach((line, row) => {
      const lineWidth = line.reduce((n, g) => n + ctx.measureText(g.ch).width, 0);
      let cx = align === "center" ? Math.round((width - lineWidth) / 2) : 0;
      const cy = row * lh + Math.round((lh - px) / 2);
      for (const g of line) {
        ctx.fillStyle = g.color;
        ctx.fillText(g.ch, cx, cy);
        cx += ctx.measureText(g.ch).width;
      }
    });
    // 去掉抗锯齿：透明度过半的像素全不透明，其余全透明
    const img = ctx.getImageData(0, 0, width * k, height * k);
    const d = img.data;
    // 门槛取一半：再高 Noto 落在两像素之间的细笔画会断，再低字会发粗（像素字体本来就对齐像素格，不受影响）
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
  });

  return (
    <canvas
      ref={canvas}
      aria-label={list.map((r) => r.text).join("")}
      data-fonts={fontsReady}
      className={cn("bar-sprite pointer-events-none absolute", className)}
      style={{ left: x, top: y, width: box.w, height: box.h, ...style }}
    />
  );
}
