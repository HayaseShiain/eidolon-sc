"use client";

// PROTOTYPE（bar 地图票 08「原型：酒吧的画面」）：只在 prototype/bar 分支，不进 main。
// 三个变体，在 /play/bar 上用 ?variant=A|B|C 切换：A 原版画框（全屏）、B 嵌在外壳里、C 两幕（全屏）。
// 左上角「原型」面板调正交的开关（缩放方式、立绘高清或像素化、字保底、当天第一次与否、开店画面、模拟竖屏、声音），并显示当前状态。

import "./bar-prototype.css";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { PrototypeSwitcher } from "@/components/app/PrototypeSwitcher";

import { PortraitGuard, type Knobs } from "./pieces";
import { useBar } from "./useBar";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";

const VARIANTS = [
  { key: "A", name: "原版画框" },
  { key: "B", name: "嵌在外壳里" },
  { key: "C", name: "两幕" },
];

export function BarPrototype({ variant }: { variant: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = VARIANTS.some((v) => v.key === variant) ? variant : "A";
  const [knobs, setKnobs] = useState<Knobs>({
    smooth: false,
    stand: "default",
    minFont: 13,
    cells: "outline",
    firstToday: true,
    door: true,
    portrait: false,
    sound: true,
    bgm: false,
  });
  // 换变体、换「开店画面」都从头来
  const [run, setRun] = useState(0);
  // 原型的东西（切换条、跳到调酒、状态）都收在左上角「原型」里，展开才盖在画面上；← → 键随时能切变体。
  const [open, setOpen] = useState(false);
  return (
    <>
      <Run key={`${current}-${run}-${knobs.door}`} variant={current} knobs={knobs} chrome={open} />
      <PortraitGuard forced={knobs.portrait} />
      <KnobPanel knobs={knobs} setKnobs={setKnobs} onRestart={() => setRun((n) => n + 1)} open={open} setOpen={setOpen}>
        <PrototypeSwitcher variants={VARIANTS} current={current} onChange={(key: string) => router.replace(`${pathname}?variant=${key}`)} />
      </KnobPanel>
    </>
  );
}

function Run({ variant, knobs, chrome }: { variant: string; knobs: Knobs; chrome: boolean }) {
  const bar = useBar({ sound: knobs.sound, bgm: knobs.bgm, withDoor: knobs.door });
  return (
    <>
      {variant === "A" && <VariantA bar={bar} knobs={knobs} />}
      {variant === "B" && <VariantB bar={bar} knobs={knobs} />}
      {variant === "C" && <VariantC bar={bar} knobs={knobs} />}
      {chrome && <StateReadout bar={bar} />}
      {chrome && <JumpButton onJump={bar.jumpToMixing} />}
    </>
  );
}

function JumpButton({ onJump }: { onJump: () => void }) {
  return (
    <button
      type="button"
      onClick={onJump}
      className="fixed bottom-2 left-2 z-[100] rounded bg-black/80 px-2 py-1 text-xs text-yellow-300 ring-1 ring-yellow-400"
    >
      跳到调酒
    </button>
  );
}

function StateReadout({ bar }: { bar: ReturnType<typeof useBar> }) {
  const m = bar.mixer;
  const counts = Object.entries(m.counts)
    .map(([k, n]) => `${k.toUpperCase()}${n}`)
    .join(" ");
  const made = m.made ? (m.made.drink ? `${m.made.drink.name}${m.made.big ? "(大)" : ""}${m.made.alcoholic ? " 含酒" : ""}` : "调坏了") : "—";
  return (
    <div className="pointer-events-none fixed right-2 bottom-2 z-[100] rounded bg-black/80 px-2 py-1 font-mono text-[10px] leading-tight text-yellow-300 ring-1 ring-yellow-400">
      <div>
        {bar.phase} · 第 {bar.step} 步 · 情绪 {bar.mood}
        {bar.speaking ? " · 说话中" : ""}
      </div>
      <div>
        {counts} · 冰{m.ice ? "开" : "关"} 陈化{m.aged ? "开" : "关"} · {m.shake} · {made}
      </div>
      <div>判定：{bar.verdicts.join("、") || "—"}</div>
    </div>
  );
}

function KnobPanel({
  knobs,
  setKnobs,
  onRestart,
  open,
  setOpen,
  children,
}: {
  knobs: Knobs;
  setKnobs: (k: Knobs) => void;
  onRestart: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const set = <K extends keyof Knobs>(key: K, value: Knobs[K]) => setKnobs({ ...knobs, [key]: value });
  const row = "flex items-center justify-between gap-3";
  return (
    <div className="fixed top-2 left-2 z-[100] text-xs text-yellow-300">
      <button type="button" onClick={() => setOpen(!open)} className="rounded bg-black/80 px-2 py-1 ring-1 ring-yellow-400">
        原型 {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-1 flex max-h-[80vh] w-60 flex-col gap-1.5 overflow-y-auto rounded bg-black/90 p-2 ring-1 ring-yellow-400">
          {children}
          <label className={row}>
            缩放
            <select className="bg-black" value={knobs.smooth ? "smooth" : "px"} onChange={(e) => set("smooth", e.target.value === "smooth")}>
              <option value="px">pixelated 小数</option>
              <option value="smooth">3 倍预渲染再平滑</option>
            </select>
          </label>
          <label className={row}>
            立绘
            <select className="bg-black" value={knobs.stand} onChange={(e) => set("stand", e.target.value as Knobs["stand"])}>
              <option value="default">变体默认</option>
              <option value="hd">高清</option>
              <option value="pixel">像素化</option>
            </select>
          </label>
          <label className={row}>
            字保底
            <select className="bg-black" value={knobs.minFont} onChange={(e) => set("minFont", Number(e.target.value))}>
              <option value={0}>不保底（原尺寸）</option>
              <option value={12}>12px</option>
              <option value={13}>13px</option>
              <option value={15}>15px</option>
            </select>
          </label>
          <label className={row}>
            份数格
            <select className="bg-black" value={knobs.cells} onChange={(e) => set("cells", e.target.value as Knobs["cells"])}>
              <option value="outline">原版描边</option>
              <option value="fill">填满</option>
            </select>
          </label>
          <label className={row}>
            当天第一次
            <input type="checkbox" checked={knobs.firstToday} onChange={(e) => set("firstToday", e.target.checked)} />
          </label>
          <label className={row}>
            开店画面
            <input type="checkbox" checked={knobs.door} onChange={(e) => set("door", e.target.checked)} />
          </label>
          <label className={row}>
            模拟竖屏
            <input type="checkbox" checked={knobs.portrait} onChange={(e) => set("portrait", e.target.checked)} />
          </label>
          <label className={row}>
            音效
            <input type="checkbox" checked={knobs.sound} onChange={(e) => set("sound", e.target.checked)} />
          </label>
          <label className={row}>
            音乐（Last Call）
            <input type="checkbox" checked={knobs.bgm} onChange={(e) => set("bgm", e.target.checked)} />
          </label>
          <button type="button" className="rounded px-2 py-1 ring-1 ring-yellow-400" onClick={onRestart}>
            从头来
          </button>
        </div>
      )}
    </div>
  );
}
