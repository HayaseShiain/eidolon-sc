"use client";

// PROTOTYPE（daily-tasks-and-achievements 票 09「原型：成就放在哪里、长什么样」）：只在 prototype/achievements 分支，不进 main。
// 屏幕底部正中的变体切换条：左右箭头或键盘 ← → 切换。

import { useEffect } from "react";

import { BackIcon, ForwardIcon } from "@/theme/icons";

/** 开发模式，或者构建时带了 NEXT_PUBLIC_PROTOTYPE=1，才显示原型的东西。 */
export const prototypeEnabled = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_PROTOTYPE === "1";

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
}) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );
  const go = (step: number) => onChange(variants[(index + step + variants.length) % variants.length].key);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement | null)?.isContentEditable)
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  if (!prototypeEnabled) return null;
  const v = variants[index];
  return (
    <div className="fixed bottom-32 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-1.5 py-1 text-sm text-white shadow-lg ring-2 ring-yellow-400">
      <button type="button" className="rounded-full p-1.5 hover:bg-white/20" aria-label="上一个变体" onClick={() => go(-1)}>
        <BackIcon className="size-4" />
      </button>
      <span className="min-w-40 px-2 text-center tabular-nums">
        {v.key}（{v.name}）
      </span>
      <button type="button" className="rounded-full p-1.5 hover:bg-white/20" aria-label="下一个变体" onClick={() => go(1)}>
        <ForwardIcon className="size-4" />
      </button>
    </div>
  );
}
