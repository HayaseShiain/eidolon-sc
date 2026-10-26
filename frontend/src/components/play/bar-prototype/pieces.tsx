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
  firstToday: boolean;
  door: boolean;
  portrait: boolean;
  sound: boolean;
  bgm: boolean;
};

type StageInfo = { s: number; smooth: boolean; minFont: number };
const StageContext = createContext<StageInfo>({ s: 1, smooth: false, minFont: 0 });
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
  overflow = false,
  children,
  onScale,
}: {
  w: number;
  h: number;
  integer?: boolean;
  smooth: boolean;
  minFont: number;
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
        <StageContext.Provider value={{ s, smooth, minFont }}>
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
      style={{ left: x, top: y, width: size?.w, height: size?.h, opacity: alpha, ...style }}
    />
  );
}

// ---------- 酒吧背景 ----------

/** 吧台背景：原版画在 (11,18)；电视频道 (239,44) 和吊扇 (193,61) 跟着它走。 */
export function BarRoom({ x = 11, y = 18 }: { x?: number; y?: number }) {
  const [tv, setTv] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTv((n) => (n + 1) % 6), 220);
    return () => window.clearInterval(id);
  }, []);
  return (
    <>
      <Sprite name="barground" x={x} y={y} w={424} h={257} />
      <Sprite name={`tv_${tv}`} x={x + 228} y={y + 26} w={99} h={41} />
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
export function LineText({ line, typed, size = 10, hd = false }: { line: Line; typed: number; size?: number; hd?: boolean }) {
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
        style={{ left: x, top: y, width: w, height: h, padding: "3px 6px" }}
        onClick={bar.advance}
        aria-label="继续"
      >
        {bar.line && bar.phase !== "door" && bar.phase !== "end" && <LineText line={bar.line} typed={bar.typed} />}
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
export function MixStation({ bar, at = [STATION.x, STATION.y], withBg = false }: { bar: Bar; at?: [number, number]; withBg?: boolean }) {
  const font = useFont();
  const { mixer, canMix } = bar;
  const on = bar.phase === "mixing";
  // 调酒台的标签挤在原版的格子里，字保底会撑出格子：最多放到逻辑 9px。
  const label = (text: string, x: number, y: number, size = 8, color = INK.text) => (
    <span className="absolute whitespace-nowrap" style={{ left: x, top: y, fontSize: Math.min(font(size), 9), lineHeight: 1, color }}>
      {text}
    </span>
  );
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
      {on && label("栏位 1", 497, 102, 8, "#111")}
      <Sprite name="slot_out" x={553} y={94} w={71} h={25} />
      {/* 冰、陈化 */}
      {label("加冰", 365, 125, 8, INK.sub)}
      <Sprite name="ice" x={362} y={123} w={33} h={57} alpha={mixer.ice ? 1 : 0.3} />
      {label("陈化", 365, 185, 8, INK.sub)}
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
            {label(name, bx - 3, by - 15, 7)}
            <Sprite name={canMix ? `ing_${key}` : `ing_${key}_off`} x={bx} y={by} w={20} h={38} />
            {Array.from({ length: 10 }, (_, j) => (
              <Sprite key={j} name={`cell_${key}`} x={cx + (j % 5) * 9} y={cy + Math.floor(j / 5) * 18} w={8} h={17} alpha={j < Math.min(n, 10) ? 1 : 0.15} />
            ))}
            {Array.from({ length: Math.max(0, n - 10) }, (_, j) => (
              <Sprite key={`b${j}`} name={`big_${key}`} x={cx + (j % 5) * 9} y={cy + Math.floor(j / 5) * 18} w={8} h={17} />
            ))}
            <HitBox x={bx - 5} y={by - 17} w={75} h={57} onClick={() => bar.add(key)} label={`加一份 ${name}`} />
          </div>
        );
      })}
      {/* 摇酒器 / 成品 */}
      {made ? (
        <Sprite name={made.drink ? `drink_${made.drink.id}` : "drink_glitch"} x={496} y={190} w={35} h={53} />
      ) : (
        <Sprite name={mixer.shake === "idle" ? "shaker" : "shaker_shake"} x={477} y={182} w={72} h={68} className={shakerClass} />
      )}
      {made && label(made.drink ? `${made.drink.name}${made.big ? "（大）" : ""}` : "##20%!!", 513 - 34, 248, 7, made.drink ? INK.text : INK.pink)}
      {mixer.pulse && <Sprite key={mixer.pulse.id} name={`pulse_${mixer.pulse.key}`} x={477} y={182} w={72} h={68} className="bar-pulse" />}
      {mixer.float && (
        <Sprite key={mixer.float.id} name={mixer.float.ok ? "success" : "fail"} x={mixer.float.ok ? 484 : 492} y={166} className="bar-float" />
      )}
      <HitBox x={477} y={182} w={72} h={68} onClick={() => mixer.shake === "done" && bar.mixButton()} label="上酒" />
      {/* 重做、调制 */}
      <Sprite name={on ? "reset" : "slot_out"} x={402} y={243} w={71} h={25} />
      {on && label("重做", 428, 251, 8, "#111")}
      <HitBox x={402} y={243} w={71} h={25} onClick={bar.reset} label="重做" />
      <Sprite name={mixSprite} x={553} y={243} w={71} h={25} />
      {on && label(mixLabel, 579, 251, 8, "#111")}
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
 * 配方书（票 01 第 8 节）：CALICOMP 蓝窗，四个标签，分类按钮，列不超过 6 款，点名字看官方的中文配方卡（图），
 * 卡上左右翻页按字母顺序。逻辑尺寸 420×252。
 */
export function RecipeBook({ x, y }: { x: number; y: number }) {
  const font = useFont();
  const [tab, setTab] = useState<Tab>("intro");
  const [cat, setCat] = useState<string | null>(null);
  const [open, setOpen] = useState<Drink | null>(null);
  const list: Drink[] =
    tab === "bottle"
      ? DRINKS.filter((d) => d.page === null)
      : cat === null
        ? []
        : MIXED.filter((d) => (tab === "name" ? d.name.startsWith(cat) : tab === "flavor" ? d.flavor === cat : d.kind === cat));
  const cats: [string, string][] = tab === "name" ? LETTERS.map((l) => [l, l]) : tab === "flavor" ? FLAVORS : tab === "kind" ? KINDS : [];
  const page = (step: number) => {
    if (!open) return;
    const i = MIXED.indexOf(open);
    setOpen(MIXED[(i + step + MIXED.length) % MIXED.length]);
  };
  const btn = (active: boolean): CSSProperties => ({
    fontSize: font(8),
    lineHeight: 1,
    color: active ? "#2448ff" : "#fff",
    background: active ? "#fff" : "transparent",
    border: "1px solid #fff",
    padding: "2px 4px",
  });
  return (
    <div className="bar-wipe pointer-events-auto absolute" style={{ left: x, top: y, width: 420, height: 252 }}>
      <Sprite name="recipe_bg" x={0} y={0} w={420} h={252} />
      <div className="absolute flex gap-1" style={{ left: 9, top: 6 }}>
        {TABS.map(([key, name]) => (
          <button
            key={key}
            type="button"
            className="bar-hit"
            style={btn(tab === key)}
            onClick={() => {
              setTab(key);
              setCat(null);
              setOpen(null);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="absolute overflow-hidden" style={{ left: 9, top: 25, width: 315, height: 214, background: "#000" }}>
        {open?.page != null ? (
          <Sprite name={`recipe_${open.page}`} x={0} y={0} w={315} h={214} />
        ) : tab === "intro" ? (
          <Sprite name="recipe_intro" x={0} y={0} w={315} h={214} />
        ) : (
          <div className="absolute inset-0 flex flex-col gap-2 p-2" style={{ color: "#fff" }}>
            {cats.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {cats.map(([key, name]) => (
                  <button key={key} type="button" className="bar-hit" style={btn(cat === key)} onClick={() => setCat(key)}>
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-1">
              {list.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="bar-hit text-left"
                  style={{ fontSize: font(10), lineHeight: 1.2, color: "#fff" }}
                  onClick={() => d.page !== null && setOpen(d)}
                >
                  {d.name}
                  {d.note && <span style={{ color: INK.sub }}>　{d.note}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {open && (
        <div className="absolute flex flex-col items-center gap-2" style={{ left: 334, top: 80, width: 80 }}>
          <div className="flex gap-2">
            <button type="button" className="bar-hit relative" style={{ width: 24, height: 24, transform: "scaleX(-1)" }} onClick={() => page(-1)} aria-label="上一页">
              <Sprite name="arrow" x={0} y={0} w={24} h={24} />
            </button>
            <button type="button" className="bar-hit relative" style={{ width: 24, height: 24 }} onClick={() => page(1)} aria-label="下一页">
              <Sprite name="arrow" x={0} y={0} w={24} h={24} />
            </button>
          </div>
          <button type="button" className="bar-hit" style={btn(false)} onClick={() => setOpen(null)}>
            返回
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- 进门、结束、竖屏 ----------

/** 店门口（原版 barintro 三帧霓虹闪），招牌改成 VA-283；点一下进门。 */
export function Door({ onEnter }: { onEnter: () => void }) {
  const font = useFont();
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setFrame((n) => (Math.random() < 0.15 ? (n + 1) % 3 : 0)), 120);
    return () => window.clearInterval(id);
  }, []);
  return (
    <button type="button" className="bar-hit pointer-events-auto absolute inset-0" onClick={onEnter} aria-label="进门">
      <div className="absolute inset-0" style={{ background: "#000" }} />
      <Sprite name={`intro_${frame}`} x={0} y={0} w={640} h={360} />
      <span
        className="absolute grid place-items-center italic"
        style={{ left: 290, top: 30, width: 56, height: 24, background: frame === 0 ? INK.pink : "#7a1531", color: "#fff", fontSize: 12, fontWeight: 800 }}
      >
        VA-283
      </span>
      <span className="bar-ctc absolute w-full text-center" style={{ left: 0, top: 290, color: INK.sub, fontSize: font(10) }}>
        点一下进门
      </span>
    </button>
  );
}

/** 原版的 logo 烤在外框里：盖一块黑、写 VA-283（定稿要改图）。 */
export function Logo() {
  return (
    <div className="absolute" style={{ left: 435, top: 27, width: 188, height: 63, background: "#000" }}>
      <span className="absolute" style={{ left: 8, top: 7, fontSize: 11, color: INK.pink, letterSpacing: 0.2 }}>
        Cyberpunk Bartender Action
      </span>
      <span className="absolute italic" style={{ left: 6, top: 18, fontSize: 34, lineHeight: 1, fontWeight: 800, color: INK.pink, letterSpacing: -1 }}>
        VA-283
      </span>
    </div>
  );
}

/** 光顾结束（票 07）：当天第一次只写拿到了什么，不打分、不列上对几杯；之后的光顾什么都不给。像素版。 */
export function EndPanel({ first, onAgain, onLeave }: { first: boolean; onAgain: () => void; onLeave: () => void }) {
  const font = useFont();
  const btn: CSSProperties = { fontSize: font(10), color: "#fff", border: "1px solid #fff", padding: "3px 10px" };
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="flex flex-col items-center gap-3" style={{ background: "#000", border: `1px solid ${INK.pink}`, padding: "14px 22px", color: "#fff" }}>
        {first ? (
          <div className="flex flex-col items-center gap-1" style={{ fontSize: font(12) }}>
            <span>抽奖 +1</span>
            <span>
              <span style={{ color: HER.color }}>♥</span> 好感度上升
            </span>
          </div>
        ) : (
          <span style={{ fontSize: font(10), color: INK.sub }}>{HER.name}走了</span>
        )}
        <div className="flex gap-2">
          <button type="button" className="bar-hit" style={btn} onClick={onAgain}>
            再营业
          </button>
          <button type="button" className="bar-hit" style={btn} onClick={onLeave}>
            离开
          </button>
        </div>
      </div>
    </div>
  );
}

/** 安卓能进全屏再锁横屏（票 03）；iPhone 没有。 */
export function canLockLandscape(): boolean {
  if (typeof window === "undefined") return false;
  const o = screen.orientation as ScreenOrientation & { lock?: unknown };
  return typeof o?.lock === "function" && document.fullscreenEnabled;
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
