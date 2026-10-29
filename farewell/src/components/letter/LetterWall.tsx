"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { copy } from "@/i18n";
import { LETTERS, markLetterRead, readLetters } from "@/lib/letter";
import { cn } from "@/lib/utils";
import { letterVars } from "@/theme/herVars";

import { klee } from "./fonts";
import { LetterLayer, type Writer } from "./LetterLayer";

const t = copy.letter;

/** 信封墙上的一段：组合名（没有组合的那一段是「283プロ」）和这个组合里写了信的人。 */
export type WallUnit = { name: string; writers: (Writer & { id: string })[] };

/**
 * 她们的信（/letters）的信封墙：每位一枚她的信封，按组合分段。点了她那一枚，大信封从那里放大到屏幕中间（LetterLayer），
 * 收起时落回来。这台设备上读过的（拆开过的）那枚封口是翻开的；刚读完落回来时，封口当场翻开。
 * 网址带 `?letter=<角色标识>` 时一进来就打开她的信。
 */
export function LetterWall({ units }: { units: WallUnit[] }) {
  const [read, setRead] = useState<ReadonlySet<string>>(() => new Set());
  /** 刚读完、落回来的那一位：只有她的封口翻开时带动画，别人的读过就直接是翻开的。 */
  const [justRead, setJustRead] = useState<string | null>(null);
  /** 信打开着的那一位，和她那一枚空着的时候（从点了到大信封落回来）。 */
  const [open, setOpen] = useState<string | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const envelopes = useRef(new Map<string, HTMLElement>());
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const writers = units.flatMap((u) => u.writers);
  const writer = writers.find((w) => w.id === open) ?? null;

  useEffect(() => {
    setRead(new Set(readLetters()));
    const asked = new URLSearchParams(window.location.search).get("letter");
    if (asked && writers.some((w) => w.id === asked)) {
      setOpen(asked);
      setLifted(asked);
    }
    // 只在进页面时看一次网址。
  }, []);

  const pick = (id: string) => {
    setOpen(id);
    setLifted(id);
  };

  const returned = useCallback(
    (wasOpened: boolean) => {
      setLifted(null);
      if (!open || !wasOpened) return;
      markLetterRead(open);
      setRead((before) => new Set(before).add(open));
      setJustRead(open);
    },
    [open],
  );

  const closed = useCallback(() => {
    if (open) buttons.current.get(open)?.focus({ preventScroll: true });
    setOpen(null);
  }, [open]);

  return (
    <div className={klee.variable}>
      {units.map((unit) => (
        <section key={unit.name} className="lt-unit">
          <h2 className="lt-unit-name" lang="ja">
            {unit.name}
          </h2>
          <ul className="lt-row">
            {unit.writers.map((w) => (
              <li key={w.id} className="@container">
                <button
                  ref={(el) => void (el ? buttons.current.set(w.id, el) : buttons.current.delete(w.id))}
                  type="button"
                  aria-label={t.title(w.name)}
                  onClick={() => pick(w.id)}
                  className="group mt-[36cqw] block w-full rounded-md outline-none focus-visible:ring-3 focus-visible:ring-white/60"
                  style={letterVars(w.color)}
                >
                  <SmallEnvelope
                    ref={(el) => void (el ? envelopes.current.set(w.id, el) : envelopes.current.delete(w.id))}
                    name={w.name}
                    isRead={read.has(w.id)}
                    isOpening={justRead === w.id}
                    isLifted={lifted === w.id}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {open && writer && LETTERS[open] && (
        <LetterLayer
          key={open}
          writer={writer}
          letter={LETTERS[open]}
          origin={envelopes.current.get(open) ?? null}
          onReturn={returned}
          onClosed={closed}
        />
      )}
    </div>
  );
}

/**
 * 信封墙上她的一枚：和打开后的大信封同一个样子（信封背面、她颜色的封蜡压着一颗星），只是小，所以不写抬头，
 * 她的名字写大、放在中间。读过的封口往上翻开，露出里面那一面，封蜡跟着翻到背面去。
 * 封口比大信封的短一点（信封高的一半），翻开以后高出信封 31cqw（信封是 8:5），按钮上面留着这块地方再多一点（mt-[36cqw]）。
 */
function SmallEnvelope({
  ref,
  name,
  isRead,
  isOpening,
  isLifted,
}: {
  ref: (el: HTMLSpanElement | null) => void;
  name: string;
  isRead: boolean;
  isOpening: boolean;
  isLifted: boolean;
}) {
  return (
    <span
      ref={ref}
      className={cn(
        "relative block aspect-[8/5] rounded-md bg-letter-envelope shadow-xl ring-1 ring-letter-envelope-edge perspective-normal transition-transform duration-300 group-hover:-translate-y-1",
        isLifted && "invisible",
      )}
    >
      <svg aria-hidden viewBox="0 0 160 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path
          d="M0 100 L66 52 M160 100 L94 52"
          fill="none"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          className="stroke-letter-envelope-edge"
        />
      </svg>
      <span
        lang="ja"
        className="absolute inset-x-0 bottom-[9%] text-center font-letter text-[10cqw] leading-none font-semibold text-her-letter-ink"
      >
        {name}
      </span>
      <span
        className={cn(
          "absolute inset-x-0 top-0 block h-1/2 origin-top transform-3d",
          isRead && "rotate-x-180",
          isOpening && "transition-transform delay-150 duration-700 ease-in-out",
        )}
      >
        <svg aria-hidden viewBox="0 0 160 55" preserveAspectRatio="none" className="absolute inset-0 size-full backface-hidden">
          <path
            d="M0 0 H160 L80 55 Z"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className="fill-letter-envelope stroke-letter-envelope-edge"
          />
        </svg>
        {/* 封口里面那一面：翻开以后才看得见。左右翻过来朝后（三角形左右对称，样子不变）；上下翻的话尖会朝着信封。 */}
        <svg
          aria-hidden
          viewBox="0 0 160 55"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full rotate-y-180 backface-hidden"
        >
          <path
            d="M0 0 H160 L80 55 Z"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className="fill-letter-rule stroke-letter-envelope-edge"
          />
        </svg>
        <span className="absolute top-full left-1/2 grid size-[15cqw] -translate-1/2 place-items-center rounded-full bg-her-seal text-her-seal-fg shadow-md ring-[1.2cqw] ring-her-seal/30 backface-hidden">
          <svg aria-hidden viewBox="0 0 24 24" className="size-[6.5cqw] fill-current">
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z" />
          </svg>
        </span>
      </span>
    </span>
  );
}
