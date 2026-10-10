"use client";

/**
 * PROTOTYPE：右下角的调试面板，不是设计的一部分。现场切换三个开放项（日文明朝体、中文大标题、
 * 横滚方向），强制分档（会刷新页面），并显示当前档位、帧率、DPR、色散采样次数和滚动进度。
 * 按 D 收起 / 展开；`?panel=0` 一开始就收起。
 */

import { useEffect, useState, type RefObject } from "react";

import type { Opts } from "./Landing";

export type Metrics = {
  tier: string;
  why: string;
  downgraded: string;
  fps: number;
  dpr: number;
  samples: number;
  act: number;
  stage: number;
  /** OGL 从开始加载到第一帧可用的毫秒数。 */
  glMs: number | null;
  track: number;
};

const TIERS = [
  ["auto", "自动"],
  ["full", "完整"],
  ["lite", "简化"],
  ["reduced", "减少动态"],
  ["static", "静态"],
] as const;

export function DebugPanel({
  opts,
  onChange,
  metrics,
}: {
  opts: Opts;
  onChange: (next: Partial<Opts>) => void;
  metrics: RefObject<Metrics>;
}) {
  const [open, setOpen] = useState(true);
  const [, tick] = useState(0);
  const [forced, setForced] = useState("auto");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("panel") === "0") setOpen(false);
    setForced(q.get("tier") ?? "auto");
    const t = window.setInterval(() => tick((n) => n + 1), 400);
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "d" && !(e.target as HTMLElement).closest("input,textarea,[contenteditable]")) setOpen((o) => !o);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("keydown", key);
    };
  }, []);

  const setTier = (tier: string) => {
    const url = new URL(window.location.href);
    if (tier === "auto") url.searchParams.delete("tier");
    else url.searchParams.set("tier", tier);
    window.location.assign(url);
  };

  const m = metrics.current;
  if (!open) {
    return (
      <button type="button" className="lp-debug-tab" onClick={() => setOpen(true)}>
        原型面板 D
      </button>
    );
  }

  const seg = <T extends string>(value: T, choices: readonly (readonly [T, string])[], set: (v: T) => void) => (
    <div className="lp-debug-seg">
      {choices.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <aside className="lp-debug" aria-label="原型面板">
      <div className="lp-debug-head">
        <strong>原型面板</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="收起">
          D ✕
        </button>
      </div>
      <label>日文明朝体</label>
      {seg(opts.ja, [["shippori", "Shippori B1"], ["zen", "Zen Old"]] as const, (ja) => onChange({ ja }))}
      <label>中文大标题</label>
      {seg(opts.zh, [["sans", "Noto Sans SC"], ["serif", "Noto Serif SC"]] as const, (zh) => onChange({ zh }))}
      <label>横滚方向</label>
      {seg(opts.dir, [["ltr", "左 → 右"], ["rtl", "右 → 左"]] as const, (dir) => onChange({ dir }))}
      <label>分档（刷新）</label>
      {seg(forced, TIERS, setTier)}
      <dl className="lp-debug-stats">
        <dt>档位</dt>
        <dd>
          {m.tier}（{m.why}）{m.downgraded && <em> {m.downgraded}</em>}
        </dd>
        <dt>帧率</dt>
        <dd>{m.fps || "—"} fps</dd>
        <dt>DPR / 采样</dt>
        <dd>
          {m.dpr.toFixed(2)} / {m.samples}
        </dd>
        <dt>OGL 就绪</dt>
        <dd>{m.glMs === null ? "未加载" : `${m.glMs} ms`}</dd>
        <dt>幕 / 进度</dt>
        <dd>
          第 {m.act} 幕 · 舞台 {m.stage.toFixed(2)} 屏 · 轨道 {m.track.toFixed(2)}
        </dd>
      </dl>
    </aside>
  );
}
