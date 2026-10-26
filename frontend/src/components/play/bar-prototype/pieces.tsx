// PROTOTYPE（bar 地图票 08）：三个变体共用的零件。坐标一律是原版 640×360 的逻辑像素（票 03 笔记第 1、2 节）。

import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import type { Emotion } from "@/lib/standAnimations";

import { DRINKS, FLAVORS, HER, INGREDIENTS, KINDS, type Drink, type IngredientKey, type Line } from "./data";
import { PixelText, type Run, type TextFont } from "./pixelText";
import type { Bar } from "./useBar";

const Stand = lazy(() => import("@/components/conversations/stand/Stand").then((m) => ({ default: m.Stand })));

export const INK = {
  bg: "#1f1a2d",
  pink: "#f72b62",
  text: "#ffffff",
  sub: "#b9b3c9",
  me: "#7fb2ff",
  panel: "#000000",
};

// ---------- 舞台：整块按比例缩放 ----------

export type Knobs = {
  smooth: boolean;
  stand: "default" | "hd" | "pixel";
  minFont: number;
  /** 字：noto 照原版把 Noto Sans 按原尺寸栅格化再放大；fusion 缝合像素 12px；hd 浏览器高清字。 */
  font: TextFont;
  /** 份数格：原版是亮描边（没加的 30% 透明），`fill` 是加了的填满颜色。 */
  cells: "outline" | "fill";
  firstToday: boolean;
  door: boolean;
  portrait: boolean;
  sound: boolean;
  bgm: boolean;
};

type StageInfo = { s: number; smooth: boolean; minFont: number; font: TextFont };
const StageContext = createContext<StageInfo>({ s: 1, smooth: false, minFont: 0, font: "noto" });
export const useStage = () => useContext(StageContext);

/**
 * 舞台：逻辑尺寸 w×h，按外层的大小缩放。电脑（细指针）上放得下 1 倍以上时取整数倍；手机（粗指针）上小数缩放（票 03）。
 * 子元素是 `Px`（按逻辑像素画、整体 transform 缩放）和 `Hd`（按缩放后的 CSS 像素摆，用来放高清立绘）。
 */
export function Stage({
  w,
  h,
  integer = true,
  smooth,
  minFont,
  font,
  overflow = false,
  children,
  onScale,
}: {
  w: number;
  h: number;
  integer?: boolean;
  smooth: boolean;
  minFont: number;
  font: TextFont;
  overflow?: boolean;
  children: ReactNode;
  onScale?: (s: number) => void;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(0);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => {
      const raw = Math.min(el.clientWidth / w, el.clientHeight / h);
      const coarse = matchMedia("(pointer: coarse)").matches;
      const next = integer && !coarse && raw >= 1 ? Math.floor(raw) : raw;
      setS(next);
      onScale?.(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, integer, onScale]);
  return (
    <div ref={outer} className="relative grid size-full place-items-center overflow-hidden">
      {s > 0 && (
        <StageContext.Provider value={{ s, smooth, minFont, font }}>
          <div
            className={cn("bar-font relative", smooth ? "bar-smooth" : "bar-px", overflow ? "" : "overflow-hidden")}
            style={{ width: w * s, height: h * s }}
          >
            {children}
          </div>
        </StageContext.Provider>
      )}
    </div>
  );
}

/** 一层按逻辑像素画的东西：整体 transform 缩放（里面的字浏览器照样按最终大小栅格化，是清楚的）。 */
export function Px({ w = 640, h = 360, children, className }: { w?: number; h?: number; children: ReactNode; className?: string }) {
  const { s } = useStage();
  return (
    <div
      className={cn("pointer-events-none absolute top-0 left-0", className)}
      style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: "0 0" }}
    >
      {children}
    </div>
  );
}

/** 按逻辑坐标摆、但不跟着 transform 缩放的一块（高清立绘）。 */
export function Hd({ x, y, w, h, children, className, style }: { x: number; y: number; w: number; h: number; children?: ReactNode; className?: string; style?: CSSProperties }) {
  const { s } = useStage();
  return (
    <div className={cn("absolute", className)} style={{ left: x * s, top: y * s, width: w * s, height: h * s, ...style }}>
      {children}
    </div>
  );
}

/** 逻辑字号；开了「字保底」时不小于这么多 CSS 像素。 */
export function useFont() {
  const { s, minFont } = useStage();
  return (logical: number) => Math.max(logical, minFont / s);
}

/**
 * 画面里的字：像素字体时画成去掉抗锯齿的 canvas（pixelText），高清时是普通 DOM 字（受「字保底」影响）。
 * 坐标、宽高都是逻辑像素；不给宽度就是单行、按字宽。
 */
export function Txt({
  x,
  y,
  w,
  h,
  runs,
  size = 13,
  lineHeight,
  color = "#fff",
  mono = false,
  bold = false,
  italic = false,
  align = "left",
  className,
  style,
  only,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  runs: Run[] | string;
  size?: number;
  lineHeight?: number;
  color?: string;
  mono?: boolean;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center";
  className?: string;
  style?: CSSProperties;
  /** 不跟着字体开关走（logo 一直用粗斜的 Noto）。 */
  only?: Exclude<TextFont, "hd">;
}) {
  const stage = useStage();
  const font = only ?? stage.font;
  const scaled = useFont();
  if (font !== "hd") {
    return (
      <PixelText x={x} y={y} w={w} h={h} runs={runs} size={size} lineHeight={lineHeight} color={color} font={font} mono={mono} bold={bold} italic={italic} align={align} className={className} style={style} />
    );
  }
  const list: Run[] = typeof runs === "string" ? [{ text: runs }] : runs;
  return (
    <span
      className={cn("pointer-events-none absolute whitespace-pre-wrap", w === undefined && "whitespace-nowrap", className)}
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        fontSize: scaled(size),
        lineHeight: lineHeight ? `${lineHeight}px` : 1.25,
        color,
        fontWeight: bold ? 700 : undefined,
        fontStyle: italic ? "italic" : undefined,
        fontFamily: mono ? "Inconsolata, Consolas, ui-monospace, monospace" : undefined,
        textAlign: align,
        ...style,
      }}
    >
      {list.map((run, i) => (
        <span key={i} style={{ color: run.color }}>
          {run.text}
        </span>
      ))}
    </span>
  );
}

// ---------- 图 ----------

const upscaled = new Map<string, string>();
const upscaling = new Map<string, Promise<string>>();
/** 「预渲染平滑」：先在离屏 canvas 上用最近邻放大 3 倍，再让浏览器平滑缩小到目标尺寸（票 03 的建议之一）。 */
function upscale(src: string): Promise<string> {
  let p = upscaling.get(src);
  if (!p) {
    p = new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width * 3;
        c.height = img.height * 3;
        const g = c.getContext("2d")!;
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL();
        upscaled.set(src, url);
        resolve(url);
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
    upscaling.set(src, p);
  }
  return p;
}

function useSrc(name: string) {
  const { smooth } = useStage();
  const base = `/prototype-bar/img/${name}.png`;
  const [, force] = useState(0);
  useEffect(() => {
    if (smooth && !upscaled.has(base)) void upscale(base).then(() => force((n) => n + 1));
  }, [smooth, base]);
  return smooth ? (upscaled.get(base) ?? base) : base;
}

export function Sprite({
  name,
  x,
  y,
  w,
  h,
  alpha = 1,
  className,
  style,
}: {
  name: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  alpha?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const src = useSrc(name);
  const [size, setSize] = useState<{ w: number; h: number } | null>(w && h ? { w, h } : null);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn("bar-sprite absolute max-w-none select-none", className)}
      onLoad={(e) => {
        if (!w || !h) {
          const img = e.currentTarget;
          // 平滑模式下拿到的是 3 倍图
          const k = src.startsWith("data:") ? 3 : 1;
          setSize({ w: img.naturalWidth / k, h: img.naturalHeight / k });
        }
      }}
      style={{ left: x, top: y, width: w ?? size?.w, height: h ?? size?.h, opacity: alpha, ...style }}
    />
  );
}

// ---------- 酒吧背景 ----------

/** 吧台背景：原版画在 (11,18)；电视频道 (239,44) 和吊扇 (193,61) 跟着它走。 */
/** 电视的 10 个台（bg_tv）：点电视换下一台，换台时左上角绿字「ChN」亮 20 帧；第 10 台是关着的。 */
const CHANNELS: [string, number][] = [
  ["burrito", 3],
  ["wk", 7],
  ["dollar", 2],
  ["news", 6],
  ["yiik", 3],
  ["toku", 3],
  ["mwj", 4],
  ["hassy", 1],
  ["ramen", 3],
  ["", 0],
];

export function BarRoom({ x = 11, y = 18 }: { x?: number; y?: number }) {
  const [channel, setChannel] = useState(() => Math.floor(Math.random() * 9));
  const [frame, setFrame] = useState(0);
  const [showChannel, setShowChannel] = useState(true);
  useEffect(() => {
    const id = window.setInterval(() => setFrame((n) => n + 1), 220);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!showChannel) return;
    const id = window.setTimeout(() => setShowChannel(false), 667);
    return () => window.clearTimeout(id);
  }, [showChannel, channel]);
  // 频道的图先载好，换台时不闪黑
  useEffect(() => {
    for (const [n, count] of CHANNELS) for (let i = 0; i < count; i++) new Image().src = `/prototype-bar/img/ch_${n}_${i}.png`;
  }, []);
  const [name, frames] = CHANNELS[channel];
  return (
    <>
      <Sprite name="barground" x={x} y={y} w={424} h={257} />
      {frames > 0 ? (
        <Sprite name={`ch_${name}_${frame % frames}`} x={x + 228} y={y + 26} w={99} h={41} />
      ) : (
        <div className="absolute" style={{ left: x + 228, top: y + 26, width: 99, height: 41, background: "#000" }} />
      )}
      {showChannel && channel !== 9 && <Txt x={x + 233} y={y + 28} runs={`Ch${channel + 1}`} size={12} mono color="#24ff00" />}
      <button
        type="button"
        aria-label="换台"
        className="bar-hit pointer-events-auto absolute"
        style={{ left: x + 228, top: y + 26, width: 99, height: 41 }}
        onClick={() => {
          setChannel((c) => (c + 1) % 10);
          setShowChannel(true);
        }}
      />
      <Sprite name="fan" x={x + 170} y={y + 31} w={24} h={24} className="bar-fan" />
    </>
  );
}

// ---------- 立绘 ----------

/**
 * 她的 Spine 立绘（复用通话层的 Stand）。`pixel`：画布的像素比压到 1/缩放，画布只有逻辑像素那么大，再用 pixelated 放大，
 * 看起来和像素画面一样粗。`clip` 是裁切的窗（逻辑坐标），不给就不裁。
 */
export function StandBox({
  x,
  y,
  w,
  h,
  clip,
  framing,
  pixel,
  mood,
  speaking,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  clip?: [number, number, number, number];
  framing: "waist" | "knees";
  pixel: boolean;
  mood: Emotion;
  speaking: boolean;
}) {
  const { s } = useStage();
  const stand = (
    <div className={cn("absolute", pixel && "bar-stand-px")} style={{ left: (x - (clip?.[0] ?? 0)) * s, top: (y - (clip?.[1] ?? 0)) * s, width: w * s, height: h * s }}>
      <Suspense fallback={null}>
        <Stand
          key={pixel ? `px-${s.toFixed(2)}` : "hd"}
          outfits={[HER.outfit]}
          framing={framing}
          isPaused={false}
          entrance="fade"
          direction={{ mood, speaking, looking: true, nod: null }}
          isReducedMotion={false}
          maxPixelRatio={pixel ? 1 / s : 2}
        />
      </Suspense>
    </div>
  );
  if (!clip) return stand;
  return (
    <Hd x={clip[0]} y={clip[1]} w={clip[2]} h={clip[3]} className="pointer-events-none overflow-hidden">
      {stand}
    </Hd>
  );
}

// ---------- 文本 ----------

/** 一句台词：名字按角色上色、接冒号（原版没有名字条）；她的日语打字，中文字幕按同样的进度出来。 */
export function LineText({ line, typed, size = 10, hd = false, w }: { line: Line; typed: number; size?: number; hd?: boolean; w?: number }) {
  const { font: textFont } = useStage();
  if (!hd && textFont !== "hd" && w !== undefined) return <PixelLine line={line} typed={typed} w={w} />;
  return <HdLine line={line} typed={typed} size={size} hd={hd} />;
}

function lineRuns(line: Line, typed: number): Run[] {
  const isHer = line.who === "her";
  const main = isHer ? (line.ja ?? line.zh) : line.zh;
  const runs: Run[] = [
    { text: `${isHer ? HER.name : "制作人"}：`, color: isHer ? HER.color : INK.me },
    { text: main.slice(0, typed), color: INK.text },
  ];
  if (isHer && line.ja) {
    runs.push({ text: "\n" + line.zh.slice(0, Math.round((Math.min(typed, main.length) / main.length) * line.zh.length)), color: INK.sub });
  }
  return runs;
}

/** 像素字的一句：原版中文 13px、行距 16，从文本框左上 (6,3) 起。 */
function PixelLine({ line, typed, w }: { line: Line; typed: number; w: number }) {
  return <Txt x={6} y={3} w={w - 12} runs={lineRuns(line, typed)} size={13} lineHeight={16} />;
}

function HdLine({ line, typed, size, hd }: { line: Line; typed: number; size: number; hd: boolean }) {
  const font = useFont();
  const px = hd ? size : font(size);
  const isHer = line.who === "her";
  const main = isHer ? (line.ja ?? line.zh) : line.zh;
  const shown = main.slice(0, typed);
  const sub = isHer && line.ja ? line.zh.slice(0, Math.round((Math.min(typed, main.length) / main.length) * line.zh.length)) : null;
  return (
    <div style={{ fontSize: px, lineHeight: 1.45, color: INK.text }}>
      <div>
        <span style={{ color: isHer ? HER.color : INK.me }}>{isHer ? HER.name : "制作人"}：</span>
        {shown}
      </div>
      {sub !== null && <div style={{ color: INK.sub }}>{sub}</div>}
    </div>
  );
}

/** 原版文本框里的一句，加右下角「点击继续」箭头。点哪都算（原型）。 */
export function TextBox({ bar, x, y, w, h }: { bar: Bar; x: number; y: number; w: number; h: number }) {
  return (
    <>
      <button
        type="button"
        className="bar-hit pointer-events-auto absolute overflow-hidden text-left"
        style={{ left: x, top: y, width: w, height: h }}
        onClick={bar.advance}
        aria-label="继续"
      >
        {bar.line && bar.phase !== "door" && bar.phase !== "end" && <LineText line={bar.line} typed={bar.typed} w={w} />}
      </button>
      {bar.phase === "talk" && bar.isLineDone && <Sprite name="ctc_0" x={x + w - 16} y={y + h - 13} w={15} h={15} className="bar-ctc" />}
    </>
  );
}

// ---------- 调酒台 ----------

const BOTTLE: Record<IngredientKey, [number, number]> = { a: [405, 140], b: [480, 140], d: [555, 140], f: [405, 200], k: [555, 200] };
const CELL: Record<IngredientKey, [number, number]> = { a: [428, 140], b: [503, 140], d: [578, 140], f: [428, 200], k: [578, 200] };

/** 原版调酒台那一块的原点（外框图里 x 355、y 93 起，270×176）。 */
export const STATION = { x: 355, y: 93, w: 270, h: 176 };

/**
 * 调酒台（票 03 第 2 节）：点材料（不用拖）+1 份，冰、陈化是开关，「调制」开始摇、5 秒后转快摇、再按停，
 * 对得上配方的显示饮品图和「成功」，对不上的是故障瓶和「失败」、按钮变灰不能上（票 07）。
 * 子元素都按原版的屏幕坐标写，外面整体平移到 `at`；`withBg` 时把外框图的这一块垫在底下（不用整张外框的变体）。
 */
const CELL_COLOR: Record<IngredientKey, string> = { a: "#ed6e8a", b: "#f0be8d", d: "#8da9f0", f: "#bde1a4", k: "#a5f1f3" };

export function MixStation({
  bar,
  at = [STATION.x, STATION.y],
  withBg = false,
  cells = "outline",
}: {
  bar: Bar;
  at?: [number, number];
  withBg?: boolean;
  cells?: Knobs["cells"];
}) {
  const { mixer } = bar;
  const on = bar.phase === "mixing";
  // 原版 amounts_Draw_0：材料名用 Inconsolata 写在 (405,125) 这些位置；按钮上的字另画，黑字居中。
  const button = (text: string, x: number, y: number) => <Txt x={x} y={y + 5} w={71} runs={text} size={13} color="#111" align="center" />;
  const shakerClass = mixer.shake === "slow" ? "bar-shake-slow" : mixer.shake === "fast" ? "bar-shake-fast" : "";
  const made = mixer.made;
  const mixLabel = mixer.shake === "idle" ? "调制" : mixer.shake === "done" ? "上酒" : "停止";
  const mixSprite = !on ? "slot_out" : mixer.shake === "done" && !made?.drink ? "mix_no" : bar.total === 0 && mixer.shake === "idle" ? "mix_no" : "mix_yes";
  return (
    <div className="absolute" style={{ left: at[0] - STATION.x, top: at[1] - STATION.y, width: 640, height: 360 }}>
      {withBg && (
        <div className="absolute overflow-hidden" style={{ left: STATION.x, top: STATION.y, width: STATION.w, height: STATION.h }}>
          <Sprite name="frame" x={-STATION.x} y={-STATION.y} w={640} h={360} />
        </div>
      )}
      {/* 栏位：一单一杯，只用栏位 1 */}
      <Sprite name={on ? "slot" : "slot_out"} x={479} y={94} w={71} h={25} />
      {on && button("栏位 1", 479, 94)}
      <Sprite name="slot_out" x={553} y={94} w={71} h={25} />
      {/* 冰、陈化 */}
      <Txt x={362} y={124} w={33} runs="加冰" size={13} align="center" />
      <Sprite name="ice" x={362} y={123} w={33} h={57} alpha={mixer.ice ? 1 : 0.3} />
      <Txt x={362} y={184} w={33} runs="陈化" size={13} align="center" />
      <Sprite name="age" x={362} y={183} w={33} h={57} alpha={mixer.aged ? 1 : 0.3} />
      <HitBox x={362} y={123} w={33} h={57} onClick={() => bar.toggle("ice")} label="加冰" />
      <HitBox x={362} y={183} w={33} h={57} onClick={() => bar.toggle("aged")} label="陈化" />
      {/* 材料 */}
      {INGREDIENTS.map(({ key, name }) => {
        const [bx, by] = BOTTLE[key];
        const [cx, cy] = CELL[key];
        const n = mixer.counts[key];
        return (
          <div key={key}>
            <Txt x={key === "b" ? 477 : bx} y={by - 16} runs={name} size={11} mono />
            <Sprite name={on ? `ing_${key}` : `ing_${key}_off`} x={bx} y={by} w={20} h={38} />
            {Array.from({ length: 10 }, (_, j) => (
              <div key={j}>
                <Sprite name={`cell_${key}`} x={cx + (j % 5) * 9} y={cy + Math.floor(j / 5) * 18} w={8} h={17} alpha={j < Math.min(n, 10) ? 1 : 0.3} />
                {cells === "fill" && j < Math.min(n, 10) && (
                  <div className="absolute" style={{ left: cx + (j % 5) * 9 + 1, top: cy + Math.floor(j / 5) * 18 + 1, width: 6, height: 15, background: CELL_COLOR[key] }} />
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, n - 10) }, (_, j) => (
              <Sprite key={`b${j}`} style={cells === "fill" ? { filter: "brightness(0.35)" } : undefined} name={`big_${key}`} x={cx + (j % 5) * 9} y={cy + Math.floor(j / 5) * 18} w={8} h={17} />
            ))}
            <HitBox x={bx - 5} y={by - 17} w={75} h={57} onClick={() => bar.add(key)} label={`加一份 ${name}`} />
          </div>
        );
      })}
      {/* 摇酒器下面的总份数槽（amounts_Draw_0）：前 10 份逐格点亮，11–20 份在同一格上叠一条；摇起来之后不画格子。 */}
      <Sprite name="gauge" x={478} y={250} w={70} h={17} />
      {mixer.shake === "idle" &&
        Array.from({ length: Math.min(bar.total, 10) }, (_, i) => (
          <Sprite key={`g${i}`} name="gauge_on" x={486 + (i % 5) * 11} y={253 + Math.floor(i / 5) * 6} w={10} h={5} />
        ))}
      {mixer.shake === "idle" &&
        Array.from({ length: Math.max(0, bar.total - 10) }, (_, i) => (
          <Sprite key={`gb${i}`} name="gauge_big" x={486 + (i % 5) * 11} y={253 + Math.floor(i / 5) * 6} w={10} h={5} />
        ))}
      {mixer.name && <Txt x={482} y={252} runs={mixer.name} size={11} mono />}
      {/* 摇酒器 / 成品 */}
      {made ? (
        <Sprite name={made.drink ? `drink_${made.drink.id}` : "drink_glitch"} x={496} y={190} w={35} h={53} />
      ) : (
        <Sprite name={mixer.shake === "idle" ? "shaker" : "shaker_shake"} x={477} y={182} w={72} h={68} className={shakerClass} />
      )}
      {mixer.pulse && <Sprite key={mixer.pulse.id} name={`pulse_${mixer.pulse.key}`} x={477} y={182} w={72} h={68} className="bar-pulse" />}
      {mixer.float && (
        <Sprite key={mixer.float.id} name={mixer.float.ok ? "success" : "fail"} x={mixer.float.ok ? 484 : 492} y={166} className="bar-float" />
      )}
      <HitBox x={477} y={182} w={72} h={68} onClick={() => mixer.shake === "done" && bar.mixButton()} label="上酒" />
      {/* 重做、调制 */}
      <Sprite name={on ? "reset" : "slot_out"} x={402} y={243} w={71} h={25} />
      {on && button("重做", 402, 243)}
      <HitBox x={402} y={243} w={71} h={25} onClick={bar.reset} label="重做" />
      <Sprite name={mixSprite} x={553} y={243} w={71} h={25} />
      {on && button(mixLabel, 553, 243)}
      <HitBox x={553} y={243} w={71} h={25} onClick={bar.mixButton} label={mixLabel} />
    </div>
  );
}

function HitBox({ x, y, w, h, onClick, label }: { x: number; y: number; w: number; h: number; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="bar-hit pointer-events-auto absolute"
      style={{ left: x, top: y, width: w, height: h }}
      onClick={onClick}
    />
  );
}

// ---------- 配方书 ----------

type Tab = "intro" | "name" | "flavor" | "kind" | "bottle";
const TABS: [Exclude<Tab, "intro">, string][] = [
  ["name", "按名称"],
  ["flavor", "按口味"],
  ["kind", "按种类"],
  ["bottle", "瓶装饮品"],
];
const LETTERS = ["B", "C", "F", "G", "M", "P", "S", "Z"];
const MIXED = DRINKS.filter((d) => d.page !== null).sort((a, b) => a.name.localeCompare(b.name));

/**
 * 配方书（票 01 第 8 节、原版截图）：CALICOMP 蓝窗里一个白框，顶上白底黑字四个标签，当前标签反白（黑底白字）；
 * 下面黑色区先是首页，点标签出「按口味搜索」这样的标题和一列灰字分类（按名称是两列大写字母），
 * 点分类列出饮品，点饮品看官方中文配方卡，卡片底部左右翻页加「n/24」。逻辑尺寸 420×252。
 */
const TAB_BOX: [number, number][] = [
  [9, 62],
  [79, 62],
  [139, 62],
  [211, 72],
];
const SEARCH: Record<Exclude<Tab, "intro" | "bottle">, string> = { name: "按名称搜索", flavor: "按口味搜索", kind: "按种类搜索" };
const GREY = "#9b9b9b";

export function RecipeBook({ x, y }: { x: number; y: number }) {
  const [tab, setTab] = useState<Tab>("intro");
  const [cat, setCat] = useState<string | null>(null);
  const [open, setOpen] = useState<Drink | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const page = (step: number) => {
    if (!open) return;
    const i = MIXED.indexOf(open);
    setOpen(MIXED[(i + step + MIXED.length) % MIXED.length]);
  };
  const catName = (key: string) =>
    tab === "name" ? key : `${(tab === "flavor" ? FLAVORS : KINDS).find(([k]) => k === key)?.[1] ?? key}饮品`;
  const drinks: Drink[] =
    tab === "bottle"
      ? DRINKS.filter((d) => d.page === null)
      : cat === null
        ? []
        : MIXED.filter((d) => (tab === "name" ? d.name.startsWith(cat) : tab === "flavor" ? d.flavor === cat : d.kind === cat));
  /** 一项灰字，悬停变白；坐标是黑色区内的。 */
  const item = (id: string, text: string, ix: number, iy: number, onClick: () => void, note?: string) => (
    <div key={id}>
      <Txt x={ix} y={iy} runs={note ? [{ text }, { text: `　${note}`, color: GREY }] : text} size={13} color={hover === id ? "#fff" : GREY} />
      <button
        type="button"
        aria-label={text}
        className="bar-hit pointer-events-auto absolute"
        style={{ left: ix - 4, top: iy - 3, width: 200, height: 22 }}
        onMouseEnter={() => setHover(id)}
        onMouseLeave={() => setHover((h) => (h === id ? null : h))}
        onClick={onClick}
      />
    </div>
  );
  let body: ReactNode;
  if (open?.page != null) {
    body = <Sprite name={`recipe_${open.page}`} x={0} y={0} w={315} h={214} />;
  } else if (tab === "intro") {
    body = <Sprite name="recipe_intro" x={0} y={0} w={315} h={214} />;
  } else if (tab === "bottle") {
    body = (
      <>
        <Txt x={18} y={20} runs="瓶装饮品" size={13} />
        {drinks.map((d, i) => item(d.id, d.name, 39, 58 + i * 30, () => {}, d.note))}
      </>
    );
  } else if (cat === null) {
    const cats: string[] = tab === "name" ? LETTERS : (tab === "flavor" ? FLAVORS : KINDS).map(([k]) => k);
    body = (
      <>
        <Txt x={18} y={20} runs={SEARCH[tab]} size={13} />
        {cats.map((key, i) =>
          tab === "name"
            ? item(key, key, 39 + Math.floor(i / 4) * 92, 58 + (i % 4) * 30, () => setCat(key))
            : item(key, catName(key), 39, 58 + i * 30, () => setCat(key)),
        )}
      </>
    );
  } else {
    body = (
      <>
        <Txt x={18} y={20} runs={catName(cat)} size={13} />
        {drinks.map((d, i) => item(d.id, d.name, 39, 52 + i * 26, () => setOpen(d)))}
      </>
    );
  }
  return (
    <div className="bar-wipe pointer-events-auto absolute" style={{ left: x, top: y, width: 420, height: 252 }}>
      <Sprite name="recipe_bg" x={0} y={0} w={420} h={252} />
      <div className="absolute" style={{ left: 4, top: 9, width: 324, height: 234, background: "#fff" }} />
      {TABS.map(([key, name], i) => {
        const [tx, tw] = TAB_BOX[i];
        const active = tab === key;
        return (
          <div key={key}>
            {active && <div className="absolute" style={{ left: tx, top: 9, width: tw, height: 16, background: "#000" }} />}
            <Txt x={tx + 3} y={10} runs={name} size={13} color={active ? "#fff" : "#000"} />
            <button
              type="button"
              aria-label={name}
              className="bar-hit pointer-events-auto absolute"
              style={{ left: tx, top: 9, width: tw, height: 16 }}
              onClick={() => {
                setTab(key);
                setCat(null);
                setOpen(null);
              }}
            />
          </div>
        );
      })}
      <div className="absolute overflow-hidden" style={{ left: 9, top: 25, width: 315, height: 214, background: "#000" }}>
        {body}
      </div>
      {open && (
        <>
          <button type="button" className="bar-hit absolute" style={{ left: 22, top: 209, width: 24, height: 24, transform: "scaleX(-1)" }} onClick={() => page(-1)} aria-label="上一页">
            <Sprite name="arrow" x={0} y={0} w={24} h={24} />
          </button>
          <Txt x={142} y={214} w={60} runs={`${MIXED.indexOf(open) + 1}/${MIXED.length}`} size={13} align="center" />
          <button type="button" className="bar-hit absolute" style={{ left: 290, top: 209, width: 24, height: 24 }} onClick={() => page(1)} aria-label="下一页">
            <Sprite name="arrow" x={0} y={0} w={24} h={24} />
          </button>
        </>
      )}
    </div>
  );
}

// ---------- 进门、结束、竖屏 ----------

/** 店门口（原版 barintro 三帧霓虹闪），招牌改成 VA-283；点一下进门。 */
export function Door({ onEnter }: { onEnter: () => void }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setFrame((n) => (Math.random() < 0.15 ? (n + 1) % 3 : 0)), 120);
    return () => window.clearInterval(id);
  }, []);
  return (
    <button type="button" className="bar-hit pointer-events-auto absolute inset-0" onClick={onEnter} aria-label="进门">
      <div className="absolute inset-0" style={{ background: "#000" }} />
      <Sprite name={`intro_${frame}`} x={0} y={0} w={640} h={360} />
      <div className="absolute" style={{ left: 290, top: 30, width: 56, height: 24, background: frame === 0 ? INK.pink : "#7a1531" }} />
      <Txt x={290} y={34} w={56} runs="VA-283" size={13} bold italic align="center" only="noto" />
      <Txt x={0} y={290} w={640} runs="点一下进门" size={13} color={INK.sub} align="center" className="bar-ctc" />
    </button>
  );
}

/** 原版的 logo 烤在外框里：盖一块黑、写 VA-283（定稿要改图）。 */
export function Logo() {
  return (
    <>
      <div className="absolute" style={{ left: 435, top: 27, width: 188, height: 63, background: "#000" }} />
      <Txt x={443} y={33} runs="Cyberpunk Bartender Action" size={13} color={INK.pink} />
      <Txt x={441} y={48} runs="VA-283" size={38} lineHeight={40} color={INK.pink} bold italic only="noto" />
    </>
  );
}

/** 光顾结束（票 07）：当天第一次只写拿到了什么，不打分、不列上对几杯；之后的光顾什么都不给。像素版。 */
export function EndPanel({ first, onAgain, onLeave }: { first: boolean; onAgain: () => void; onLeave: () => void }) {
  const box = (label: string, bx: number, onClick: () => void) => (
    <>
      <div className="absolute" style={{ left: bx, top: 196, width: 72, height: 22, border: "1px solid #fff" }} />
      <Txt x={bx} y={199} w={72} runs={label} size={13} align="center" />
      <button type="button" aria-label={label} className="bar-hit pointer-events-auto absolute" style={{ left: bx, top: 196, width: 72, height: 22 }} onClick={onClick} />
    </>
  );
  return (
    <div className="pointer-events-auto absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="absolute" style={{ left: 220, top: 118, width: 200, height: 116, background: "#000", border: `1px solid ${INK.pink}` }} />
      {first ? (
        <>
          <Txt x={220} y={140} w={200} runs="抽奖 +1" size={13} align="center" />
          <Txt x={220} y={162} w={200} runs={[{ text: "♥ ", color: HER.color }, { text: "好感度上升" }]} size={13} align="center" />
        </>
      ) : (
        <Txt x={220} y={150} w={200} runs={`${HER.name}走了`} size={13} color={INK.sub} align="center" />
      )}
      {box("再营业", 236, onAgain)}
      {box("离开", 332, onLeave)}
    </div>
  );
}

/** 安卓能进全屏再锁横屏（票 03）；iPhone 没有。 */
export function canLockLandscape(): boolean {
  if (typeof window === "undefined") return false;
  const o = screen.orientation as ScreenOrientation & { lock?: unknown };
  // 电脑上的 Chrome 也有 lock()，但永远报不支持：只给粗指针（手机）
  return typeof o?.lock === "function" && document.fullscreenEnabled && matchMedia("(pointer: coarse)").matches;
}

export async function fullscreenLandscape(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen();
    await (screen.orientation as ScreenOrientation & { lock: (o: string) => Promise<void> }).lock("landscape");
  } catch {
    // 失败就留在提醒层
  }
}

/** 竖屏提醒：粗指针加竖屏才盖上（CSS 媒体查询），原型可以强制显示。安卓多一个「全屏」按钮。 */
export function PortraitGuard({ forced }: { forced: boolean }) {
  const [lockable, setLockable] = useState(false);
  useEffect(() => setLockable(canLockLandscape()), []);
  return (
    <div
      className="bar-portrait-guard bar-font fixed inset-0 z-[90] flex-col items-center justify-center gap-5"
      data-forced={forced ? "" : undefined}
      style={{ background: INK.bg, color: "#fff" }}
    >
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M21 12a9 9 0 0 1-9 9" style={{ color: INK.pink }} stroke={INK.pink} />
        <path d="M18 21h3v-3" stroke={INK.pink} />
      </svg>
      <span style={{ fontSize: 16 }}>请横过来</span>
      {(lockable || forced) && (
        <button type="button" className="rounded-full px-5 py-2" style={{ border: `1px solid ${INK.pink}`, color: INK.pink, fontSize: 14 }} onClick={() => void fullscreenLandscape()}>
          全屏横过来{forced && !lockable ? "（只有安卓有）" : ""}
        </button>
      )}
    </div>
  );
}
