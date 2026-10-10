/**
 * PROTOTYPE（prototype/landing-page 分支，永不合并）：落地页第 0、1 幕和第 2 幕 illumination STARS 一段。
 * 要回答的问题见 .scratch/landing-page/grilling-notes.md 文末和交接文档：光的质感、日文明朝体、
 * 中文大标题、横滚方向、滚动手感。开放项用 URL 参数（`?ja=` `?zh=` `?dir=` `?tier=`）或右下角的调试面板现场切换。
 *
 * 首屏标题是这里服务端渲染的 DOM 文字（LCP 元素），从一开始就可见；白光先用 CSS 画，
 * OGL 在首屏画出来以后才动态加载。
 */

import type { Metadata } from "next";
import { Noto_Serif_SC, Shippori_Mincho_B1, Zen_Old_Mincho } from "next/font/google";

import "./landing.css";

import { Landing, type Opts } from "./Landing";
import { frozenFrame, PALETTES } from "./scene";

// 只在这个路由里加载的展示字体。都是很大的 CJK 字体，Google Fonts 按 unicode-range 切片，用到哪片下哪片。
const shippori = Shippori_Mincho_B1({ weight: ["400", "600", "800"], subsets: ["latin"], variable: "--lp-shippori", preload: false });
const zen = Zen_Old_Mincho({ weight: ["400", "600", "900"], subsets: ["latin"], variable: "--lp-zen", preload: false });
const serifSc = Noto_Serif_SC({ weight: ["500", "700", "900"], subsets: ["latin"], variable: "--lp-serif-sc", preload: false });

export const metadata: Metadata = {
  title: "Eidolon-SC · 落地页原型",
  robots: { index: false },
};

/**
 * 首屏前定档：URL 的 `?tier=` 优先；否则「减少动态效果」→ reduced，省流量 → static，
 * 触屏（hover:none）→ lite，其余 full；不支持 WebGL 一律 static。
 * reduced 和 static 用竖排的「静止」版式，其余用钉住加横滚的「运动」版式。
 */
const TIER_SCRIPT = `(function(){try{var d=document.documentElement,q=new URLSearchParams(location.search).get('tier'),t=null,why='';
if(q&&q!=='auto'){t=q;why='URL 指定'}else{var c=navigator.connection;
if(matchMedia('(prefers-reduced-motion: reduce)').matches){t='reduced';why='减少动态效果'}
else if(c&&c.saveData){t='static';why='省流量'}
else if(matchMedia('(hover: none)').matches){t='lite';why='触屏'}else{t='full';why='默认'}}
if(t!=='static'){var cv=document.createElement('canvas');if(!(cv.getContext('webgl2')||cv.getContext('webgl'))){t='static';why='不支持 WebGL'}}
d.dataset.lpTier=t;d.dataset.lpWhy=why;d.dataset.lpLayout=(t==='reduced'||t==='static')?'still':'motion';}catch(e){}})();`;

function param(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LandingPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const opts: Opts = {
    ja: param(sp.ja) === "zen" ? "zen" : "shippori",
    zh: param(sp.zh) === "serif" ? "serif" : "sans",
    dir: param(sp.dir) === "rtl" ? "rtl" : "ltr",
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: TIER_SCRIPT }} />
      <Landing
        opts={opts}
        standBase={param(sp.stand) ?? "http://localhost:8765"}
        fontClasses={`${shippori.variable} ${zen.variable} ${serifSc.variable}`}
        act0={<Act0 />}
        staticFan={<StaticFan />}
      />
    </>
  );
}

/** 第 0 幕：一片黑，一束白光，标题。 */
function Act0() {
  return (
    <section className="lp-act0" aria-labelledby="lp-title">
      <div className="lp-beam-css" aria-hidden />
      <div className="lp-act0-text">
        <h1 id="lp-title" className="lp-title">
          Eidolon-SC
        </h1>
        <p className="lp-lede">和 283 事务所的偶像说说话</p>
      </div>
      <p className="lp-act0-ja" lang="ja" aria-hidden>
        <span className="lp-tcy">283</span>プロのアイドルと、おはなしを。
      </p>
      <p className="lp-disclaimer">非官方粉丝作品，与《偶像大师 闪耀色彩》官方无关。</p>
      <p className="lp-hint" aria-hidden>
        向下滚动
      </p>
    </section>
  );
}

/** 静态档（不支持 WebGL 或省流量）的第 1 幕：SVG 画的定格光谱，几何和着色器版同一套。 */
function StaticFan() {
  const w = 1600;
  const h = 900;
  const scene = frozenFrame({ w, h }, "ltr");
  const { prism, beam } = scene;
  return (
    <svg className="lp-fan-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <filter id="lp-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <line x1={beam.x0} y1={beam.y0} x2={beam.x1} y2={beam.y1} stroke="#fff" strokeOpacity="0.35" strokeWidth="12" filter="url(#lp-glow)" />
      <line x1={beam.x0} y1={beam.y0} x2={beam.x1} y2={beam.y1} stroke="#fff" strokeWidth="2" />
      <polygon
        points={`${prism.ax},${prism.ay} ${prism.bx},${prism.by} ${prism.cx},${prism.cy}`}
        fill="#fff"
        fillOpacity="0.03"
        stroke="#e8eeff"
        strokeOpacity="0.6"
        strokeWidth="1.2"
      />
      {scene.bands.map((b, i) => {
        const x0 = b.ox + b.dx * b.start;
        const y0 = b.oy + b.dy * b.start;
        const x1 = b.ox + b.dx * b.len;
        const y1 = b.oy + b.dy * b.len;
        return (
          <g key={i} opacity={Math.min(1, b.intensity * 1.6)}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={PALETTES[i].haloHex} strokeWidth="10" strokeOpacity="0.55" filter="url(#lp-glow)" />
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.2" />
          </g>
        );
      })}
    </svg>
  );
}
