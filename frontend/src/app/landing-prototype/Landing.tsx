"use client";

/**
 * PROTOTYPE：落地页原型的客户端部分。一个 requestAnimationFrame 循环驱动一切：
 * Lenis 推进滚动 → computeFrame 算出这一帧的场景 → 直接写 DOM 样式（不走 React 状态）→ OGL 画光。
 *
 * 两种版式：
 * - motion（full / lite 档）：舞台 `position: sticky` 钉住，第 1 幕和第 2 幕都在舞台里按滚动进度变形；
 * - still（reduced / static 档）：不钉住、不横滚，各段竖着排；reduced 用着色器定格一帧，static 用 SVG。
 */

import Lenis from "lenis";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { ACT_NAMES, BUILT_UNITS, IDOLS, UNITS } from "./data";
import { DebugPanel, type Metrics } from "./DebugPanel";
import type { Light, Quality } from "./light";
import {
  ACT1_SCREENS,
  computeFrame,
  frozenFrame,
  newMotion,
  PALETTES,
  SEG_SCREENS,
  slotX,
  STAGE_SCREENS,
  ZOOM_SCREENS,
  type Dir,
  type Viewport,
} from "./scene";

const Stand = lazy(() => import("@/components/conversations/stand/Stand").then((m) => ({ default: m.Stand })));

export type Opts = { ja: "shippori" | "zen"; zh: "sans" | "serif"; dir: Dir };
type Tier = "full" | "lite" | "reduced" | "static";

const QUALITY: Record<Tier, (touch: boolean) => Quality> = {
  full: (touch) => ({ dpr: Math.min(window.devicePixelRatio, touch ? 1.5 : 2), samples: 5, caustics: true }),
  lite: () => ({ dpr: 1, samples: 3, caustics: false }),
  reduced: () => ({ dpr: Math.min(window.devicePixelRatio, 1.5), samples: 5, caustics: false }),
  static: () => ({ dpr: 1, samples: 1, caustics: false }),
};

const BUILT = IDOLS.map((idol, i) => ({ idol, i })).filter(({ idol }) => idol.unit < BUILT_UNITS);

type Props = {
  opts: Opts;
  standBase: string;
  fontClasses: string;
  act0: ReactNode;
  staticFan: ReactNode;
};

export function Landing({ opts: initial, standBase, fontClasses, act0, staticFan }: Props) {
  const [opts, setOpts] = useState(initial);
  const [focus, setFocus] = useState(-1);
  const [standFor, setStandFor] = useState(-1);
  const [greeting, setGreeting] = useState<{ i: number; n: number } | null>(null);
  const [soundShown, setSoundShown] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [failedStands, setFailedStands] = useState<Set<number>>(() => new Set());
  const [layout, setLayout] = useState<"motion" | "still" | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frozen = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const act2 = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const standBox = useRef<HTMLDivElement>(null);
  const subtitle = useRef<HTMLDivElement>(null);
  const unitName = useRef<HTMLSpanElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const live = useRef({ focus: -1, dir: initial.dir, measure: () => {} });
  const metrics = useRef<Metrics>({
    tier: "?",
    why: "",
    downgraded: "",
    fps: 0,
    dpr: 0,
    samples: 0,
    act: 0,
    stage: 0,
    glMs: null,
    track: 0,
  });

  live.current.focus = focus;
  live.current.dir = opts.dir;

  // 换字体、换方向：只改 data 属性和 URL，不刷新页面；量名牌位置要等新字体到。
  const change = useCallback((next: Partial<Opts>) => {
    setOpts((o) => {
      const merged = { ...o, ...next };
      const url = new URL(window.location.href);
      url.searchParams.set("ja", merged.ja);
      url.searchParams.set("zh", merged.zh);
      url.searchParams.set("dir", merged.dir);
      window.history.replaceState(null, "", url);
      return merged;
    });
  }, []);

  useEffect(() => {
    document.fonts.ready.then(() => live.current.measure());
    const t = window.setTimeout(() => live.current.measure(), 600);
    return () => window.clearTimeout(t);
  }, [opts]);

  // 字幕只跟着说话的那位：聚焦换人就收掉；放着不动 7 秒后也收掉。
  useEffect(() => {
    if (greeting && focus >= 0 && focus !== greeting.i) setGreeting(null);
  }, [focus, greeting]);
  useEffect(() => {
    if (!greeting) return;
    const t = window.setTimeout(() => setGreeting(null), 7000);
    return () => window.clearTimeout(t);
  }, [greeting]);

  // 聚焦停留一会儿才挂立绘：鼠标扫过几块名牌时不要接连加载。
  useEffect(() => {
    if (focus < 0) {
      const t = window.setTimeout(() => setStandFor(-1), 400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setStandFor(focus), 220);
    return () => window.clearTimeout(t);
  }, [focus]);

  useEffect(() => {
    const html = document.documentElement;
    const tier = (html.dataset.lpTier ?? "static") as Tier;
    const mode = (html.dataset.lpLayout ?? "still") as "motion" | "still";
    setLayout(mode);
    const touch = matchMedia("(hover: none)").matches;
    const m = metrics.current;
    m.tier = tier;
    m.why = html.dataset.lpWhy ?? "";
    let quality = QUALITY[tier](touch);
    m.dpr = quality.dpr;
    m.samples = quality.samples;
    let light: Light | null = null;
    let disposed = false;

    if (mode === "still") {
      // reduced：着色器只渲染一帧定格的光谱后停下；static 什么都不加载（SVG 已经在页面里）。
      if (tier === "reduced" && frozen.current) {
        const target = frozen.current;
        const draw = () => {
          // 量所在的那一幕，不量画布本身：OGL 会把画布的宽高写成内联样式。
          const r = (target.parentElement ?? target).getBoundingClientRect();
          light?.resize(r.width, r.height);
          light?.render(frozenFrame({ w: r.width, h: r.height }, live.current.dir), 0);
        };
        const t0 = performance.now();
        import("./light").then(({ createLight }) => {
          if (disposed) return;
          light = createLight(target, quality);
          draw();
          m.glMs = Math.round(performance.now() - t0);
          root.current?.classList.add("lp-gl-on");
        });
        window.addEventListener("resize", draw);
        return () => {
          disposed = true;
          window.removeEventListener("resize", draw);
          light?.destroy();
        };
      }
      return;
    }

    // —— motion 版式。
    const lenis = new Lenis({ lerp: 0.1, syncTouch: false, autoRaf: false });
    lenisRef.current = lenis;
    const motion = newMotion();
    let vp: Viewport = { w: 1, h: 1 };
    let wrapTop = 0;
    let gaps: ([number, number] | null)[] = IDOLS.map(() => null);
    const plates = new Map<number, HTMLElement>();

    const measure = () => {
      vp = { w: document.documentElement.clientWidth, h: window.innerHeight };
      root.current?.style.setProperty("--lp-vh", `${vp.h}px`);
      if (wrap.current) {
        wrap.current.style.height = `${(STAGE_SCREENS + 1) * vp.h}px`;
        wrapTop = wrap.current.getBoundingClientRect().top + window.scrollY;
      }
      plates.clear();
      track.current?.querySelectorAll<HTMLElement>("[data-idol]").forEach((el) => {
        const i = Number(el.dataset.idol);
        plates.set(i, el);
        const idol = IDOLS[i];
        const n = IDOLS.filter((x) => x.unit === idol.unit).length;
        const j = IDOLS.filter((x) => x.unit === idol.unit).indexOf(idol);
        el.style.left = `${slotX(vp, live.current.dir, idol.unit, j, n)}px`;
      });
      measureGaps();
      light?.resize(vp.w, vp.h);
    };
    // 名字在竖线上占的区间：舞台钉住时舞台顶就是视口顶。
    const measureGaps = () => {
      const stageTop = act2.current?.getBoundingClientRect().top ?? 0;
      gaps = IDOLS.map((_, i) => {
        const name = plates.get(i)?.querySelector(".lp-plate-body");
        if (!name) return null;
        const r = name.getBoundingClientRect();
        return [r.top - stageTop - 6, r.bottom - stageTop + 6];
      });
    };
    live.current.measure = measure;
    measure();
    window.addEventListener("resize", measure);

    // 首屏画出来以后再加载 OGL。
    const t0 = performance.now();
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    idle(() => {
      import("./light").then(({ createLight }) => {
        if (disposed || !canvas.current) return;
        light = createLight(canvas.current, quality);
        light.resize(vp.w, vp.h);
        m.glMs = Math.round(performance.now() - t0);
        requestAnimationFrame(() => root.current?.classList.add("lp-gl-on"));
      });
    });

    // 按帧降档：只降不升。full → lite（DPR 1、3 次采样、关焦散）→ 1 次采样。
    const times: number[] = [];
    let since = performance.now();
    const downgrade = (now: number) => {
      if (now - since < 2500 || times.length < 90) return;
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      if (quality.samples === 5 && quality.dpr > 1 && avg > 24) {
        quality = QUALITY.lite(touch);
        m.downgraded = `full → lite（平均 ${avg.toFixed(1)} ms）`;
      } else if (quality.samples === 3 && avg > 36) {
        quality = { ...quality, samples: 1 };
        m.downgraded += ` → 1 次采样（平均 ${avg.toFixed(1)} ms）`;
      } else return;
      light?.setQuality(quality);
      m.dpr = quality.dpr;
      m.samples = quality.samples;
      times.length = 0;
      since = now;
    };

    let last = performance.now();
    let raf = 0;
    let lastUnit = -1;
    let lastMeasure = 0;
    let lastAct = -1;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      lenis.raf(now);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.visibilityState === "visible" && dt > 0) {
        times.push(dt * 1000);
        if (times.length > 120) times.shift();
        downgrade(now);
      }
      if (now - lastMeasure > 500) {
        lastMeasure = now;
        measureGaps();
      }
      const y = window.scrollY;
      const stage = (y - wrapTop) / vp.h;
      const stageEnd = wrapTop + STAGE_SCREENS * vp.h;
      const f = computeFrame(
        {
          vp,
          dir: live.current.dir,
          act0: Math.min(1, y / vp.h),
          stage: Math.max(0, stage),
          liftY: Math.max(0, y - stageEnd),
          gaps,
          focus: live.current.focus,
          time: now / 1000,
        },
        motion,
        dt,
        true,
      );
      if (copy.current) copy.current.style.opacity = String(f.act1Copy);
      if (act2.current) {
        act2.current.style.opacity = String(f.plates);
        act2.current.style.visibility = f.plates > 0.01 ? "visible" : "hidden";
      }
      if (track.current) track.current.style.transform = `translate3d(${f.trackX}px,0,0)`;
      const fi = live.current.focus;
      if (standBox.current) {
        const el = plates.get(fi >= 0 ? fi : -2);
        // 立绘站在名牌外侧空间大的一边，字幕跟着立绘居中。
        if (el) {
          const x = parseFloat(el.style.left) + f.trackX;
          const side = x < vp.w * 0.55 ? 1 : -1;
          const cx = x + side * (standBox.current.offsetWidth * 0.5 + 24);
          standBox.current.style.transform = `translate3d(${cx - f.trackX}px,0,0)`;
          if (subtitle.current) {
            const half = subtitle.current.offsetWidth / 2 + 16;
            const sx = Math.min(Math.max(cx, half), vp.w - half);
            subtitle.current.style.transform = `translate3d(${sx}px,0,0) translateX(-50%)`;
          }
        }
      }
      if (f.unit !== lastUnit && unitName.current) {
        // 推入下一个组合时放下当前的聚焦，立绘和字幕不跟着跑到别的组合里。
        if (lastUnit >= 0) {
          setFocus(-1);
          setGreeting(null);
        }
        lastUnit = f.unit;
        unitName.current.textContent = UNITS[f.unit];
        unitName.current.parentElement?.style.setProperty("--lp-unit-index", String(f.unit));
        root.current?.querySelectorAll("[data-unit-jump]").forEach((b, u) => b.toggleAttribute("data-current", u === f.unit));
      }
      if (f.act !== lastAct && rail.current) {
        lastAct = f.act;
        rail.current.querySelectorAll("li").forEach((li, i) => li.toggleAttribute("data-current", i === f.act));
      }
      light?.render(f.scene, now / 1000);
      m.act = f.act;
      m.stage = stage;
      m.track = motion.track;
      m.fps = Math.round(1000 / (times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)));
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      lenis.destroy();
      light?.destroy();
    };
  }, []);

  // 换方向要重新排名牌。
  useEffect(() => {
    live.current.measure();
  }, [opts.dir]);

  const jumpTo = (u: number) => {
    const lenis = lenisRef.current;
    if (!lenis || !wrap.current) {
      document.getElementById(`lp-unit-${u}`)?.scrollIntoView({ behavior: "auto" });
      return;
    }
    const h = window.innerHeight;
    const top = wrap.current.getBoundingClientRect().top + window.scrollY;
    lenis.scrollTo(top + (ACT1_SCREENS + ZOOM_SCREENS + u * SEG_SCREENS + 0.05) * h, { duration: 1.4 });
  };

  const greet = (i: number) => {
    setFocus(i);
    setGreeting((g) => ({ i, n: (g?.n ?? 0) + 1 }));
    setSoundShown(true);
  };

  return (
    <div
      ref={root}
      className={`lp-root ${fontClasses}`}
      data-ja={opts.ja}
      data-zh={opts.zh}
      data-dir={opts.dir}
      data-focus={focus >= 0 ? "" : undefined}
      style={focus >= 0 ? ({ "--lp-focus-deep": PALETTES[focus].deepHex } as React.CSSProperties) : undefined}
    >
      <canvas ref={canvas} className="lp-canvas" aria-hidden />

      <nav className="lp-rail" aria-label="进度">
        <ol ref={rail} lang="ja">
          {ACT_NAMES.map((name, i) => (
            <li key={name} data-built={i <= 2 ? "" : undefined} data-current={i === 0 ? "" : undefined}>
              {name}
            </li>
          ))}
        </ol>
      </nav>

      <header className="lp-top dark">
        {soundShown && (
          <button className="lp-sound" type="button" aria-pressed={soundOn} onClick={() => setSoundOn((s) => !s)}>
            声音 {soundOn ? "开" : "关"}
          </button>
        )}
        <Button variant="outline" size="sm" nativeButton={false} render={<a href="/login" />}>
          登录
        </Button>
      </header>

      {act0}

      <div ref={wrap} className="lp-stage-wrap">
        <div className="lp-stage">
          <section className="lp-act1" aria-labelledby="lp-act1-title">
            <canvas ref={frozen} className="lp-frozen" aria-hidden />
            {staticFan}
            <div ref={copy} className="lp-act1-copy">
              <p className="lp-act1-ja" lang="ja" aria-hidden>
                分光
              </p>
              <div>
                <h2 id="lp-act1-title" className="lp-act1-title">
                  一束光，散成二十八种颜色。
                </h2>
                <p className="lp-act1-body">每一道光是一位偶像，颜色是她在原作里的印象色。</p>
              </div>
            </div>
          </section>

          <section ref={act2} className="lp-act2" aria-label="光谱">
            <div ref={track} className="lp-track">
              {/* 立绘放在轨道里：压在其他人的名牌上面，只有被聚焦那位的名牌在它上面。 */}
              <div ref={standBox} className="lp-stand" aria-hidden>
                {standFor >= 0 && layout === "motion" && (
                  <StandSlot
                    key={standFor}
                    i={standFor}
                    base={standBase}
                    speaking={greeting?.i === standFor}
                    failed={failedStands.has(standFor)}
                    onFail={() => setFailedStands((s) => new Set(s).add(standFor))}
                  />
                )}
              </div>
              {Array.from({ length: BUILT_UNITS }, (_, u) => (
                <div key={u} id={`lp-unit-${u}`} className="lp-seg" style={{ ["--lp-u" as string]: u }}>
                  <h3 className="lp-seg-name">{UNITS[u]}</h3>
                  <div className="lp-seg-row">
                    {BUILT.filter(({ idol }) => idol.unit === u).map(({ idol, i }) => {
                      const p = PALETTES[i];
                      return (
                        <button
                          key={idol.id}
                          type="button"
                          className="lp-plate"
                          data-idol={i}
                          data-focused={focus === i ? "" : undefined}
                          style={
                            {
                              "--her-text": p.textHex,
                              "--her-halo": p.haloHex,
                              "--her-deep": p.deepHex,
                            } as React.CSSProperties
                          }
                          onPointerEnter={(e) => e.pointerType === "mouse" && setFocus(i)}
                          onPointerLeave={(e) => e.pointerType === "mouse" && setFocus((f) => (f === i ? -1 : f))}
                          onFocus={() => setFocus(i)}
                          onBlur={() => setFocus((f) => (f === i ? -1 : f))}
                          onClick={() => greet(i)}
                          aria-label={`${idol.name}，听她的招呼`}
                        >
                          <span className="lp-plate-body">
                            <span className="lp-no">{String(idol.idolId).padStart(2, "0")}</span>
                            <span className="lp-name" lang="ja">
                              {idol.name}
                            </span>
                            <span className="lp-hex">{idol.color.toUpperCase()}</span>
                          </span>
                          {layout === "still" && focus === i && (
                            <img className="lp-still-avatar" src={`/landing-prototype/avatars/${idol.id}.jpg`} alt="" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {greeting && (
              <div ref={subtitle} key={greeting.n} className="lp-greeting" role="status" style={{ ["--her-text" as string]: PALETTES[greeting.i].textHex }}>
                <p className="lp-greeting-ja" lang="ja">
                  ――ここに、はじめましての一言。
                </p>
                <p className="lp-greeting-zh">占位字幕：这里会是{IDOLS[greeting.i].name}对初次见面的制作人说的一句话。台词审核后才合成语音，原型里没有声音。</p>
              </div>
            )}

            <div className="lp-unitbar">
              <span className="lp-unitbar-name">
                <span ref={unitName}>{UNITS[0]}</span>
              </span>
              <ol className="lp-unitjump" aria-label="按组合跳转">
                {UNITS.map((name, u) => (
                  <li key={name}>
                    <button
                      type="button"
                      data-unit-jump=""
                      data-current={u === 0 ? "" : undefined}
                      disabled={u >= BUILT_UNITS}
                      title={u >= BUILT_UNITS ? "原型没做这一段" : name}
                      onClick={() => jumpTo(u)}
                    >
                      {String(u + 1).padStart(2, "0")}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </div>

      <section className="lp-end">
        <p className="lp-end-title">原型到此为止</p>
        <p className="lp-end-body">后面是第 3 幕「她说日语」到第 7 幕「开始」，原型不做。</p>
        <p className="lp-disclaimer lp-footer">非官方粉丝作品，与《偶像大师 闪耀色彩》官方无关。商标与角色版权归各自权利方所有。</p>
      </section>

      <DebugPanel opts={opts} onChange={change} metrics={metrics} />
    </div>
  );
}

/** 聚焦时浮现的立绘：复用通话层的 Stand（spine-ts 3.6，独立 canvas、同一时间只挂一位）；加载不到就用头像占位。 */
function StandSlot({
  i,
  base,
  speaking,
  failed,
  onFail,
}: {
  i: number;
  base: string;
  speaking: boolean;
  failed: boolean;
  onFail: () => void;
}) {
  const idol = IDOLS[i];
  const [talking, setTalking] = useState(false);
  useEffect(() => {
    if (!speaking) return;
    setTalking(true);
    const t = window.setTimeout(() => setTalking(false), 2600);
    return () => window.clearTimeout(t);
  }, [speaking]);

  if (failed) {
    return <img className="lp-stand-avatar" src={`/landing-prototype/avatars/${idol.id}.jpg`} alt="" />;
  }
  return (
    <Suspense fallback={null}>
      <Stand
        outfits={[{ id: idol.defaultOutfit, url: `${base.replace(/\/$/, "")}/spine/idols/${idol.defaultOutfit}/` }]}
        framing="knees"
        isPaused={false}
        entrance="rise"
        direction={{ mood: "calm", speaking: talking, looking: true, nod: null }}
        isReducedMotion={false}
        onTried={(_, ok) => !ok && onFail()}
      />
    </Suspense>
  );
}
