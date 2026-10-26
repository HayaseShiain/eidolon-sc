"use client";

// PROTOTYPE（bar 地图票 08）变体 C「两幕」：盖住导航外壳；闲聊和调酒是两个画面，点单后整屏滑到调酒台。
// 闲聊：吧台背景铺满，立绘到膝盖、居中（默认像素化），大字文本框。调酒：上方一条点单备忘，调酒台放大 1.5 倍（手机上好按），
// 配方书按需盖上来。

import { useRouter } from "next/navigation";
import { useState } from "react";

import { playHref } from "@/lib/playRoute";

import { HER } from "./data";
import { BarRoom, Door, EndPanel, INK, LineText, MixStation, Px, RecipeBook, Sprite, Stage, StandBox, useFont, type Knobs } from "./pieces";
import type { Bar } from "./useBar";

const BG_SCALE = 640 / 424;

export function VariantC({ bar, knobs }: { bar: Bar; knobs: Knobs }) {
  const router = useRouter();
  const leave = () => router.push(playHref());
  const mixing = bar.phase === "mixing";
  return (
    <div className="fixed inset-0 z-[60]" style={{ background: "#000" }}>
      <Stage w={640} h={360} smooth={knobs.smooth} minFont={knobs.minFont}>
        {/* 闲聊这一幕 */}
        <div className="absolute inset-0 transition-transform duration-300" style={{ transform: mixing ? "translateX(-100%)" : "none" }}>
          <Px>
            <div className="absolute" style={{ left: 0, top: -14, width: 424, height: 257, transform: `scale(${BG_SCALE})`, transformOrigin: "0 0" }}>
              <BarRoom x={0} y={0} />
            </div>
          </Px>
          {bar.phase !== "door" && (
            <StandBox x={150} y={0} w={340} h={360} framing="knees" pixel={knobs.stand !== "hd"} mood={bar.mood} speaking={bar.speaking} />
          )}
          <Px>
            <TalkBox bar={bar} />
            <CornerButton x={588} y={8} onClick={leave}>
              离开
            </CornerButton>
          </Px>
        </div>
        {/* 调酒这一幕 */}
        <div className="absolute inset-0 transition-transform duration-300" style={{ transform: mixing ? "none" : "translateX(100%)" }}>
          <MixScene bar={bar} onLeave={leave} cells={knobs.cells} />
        </div>
        <Px>
          {bar.phase === "door" && <Door onEnter={bar.enter} />}
          {bar.phase === "end" && <EndPanel first={knobs.firstToday} onAgain={bar.restart} onLeave={leave} />}
        </Px>
      </Stage>
    </div>
  );
}

function TalkBox({ bar }: { bar: Bar }) {
  return (
    <>
      <button
        type="button"
        className="bar-hit pointer-events-auto absolute text-left"
        style={{ left: 12, top: 262, width: 616, height: 88, background: "rgba(0,0,0,0.85)", border: `1px solid ${INK.sub}`, padding: "8px 12px" }}
        onClick={bar.advance}
      >
        {bar.line && bar.phase !== "door" && bar.phase !== "end" && <LineText line={bar.line} typed={bar.typed} size={14} />}
      </button>
      {bar.phase === "talk" && bar.isLineDone && <Sprite name="ctc_0" x={606} y={330} w={15} h={15} className="bar-ctc" />}
    </>
  );
}

function MixScene({ bar, onLeave, cells }: { bar: Bar; onLeave: () => void; cells: Knobs["cells"] }) {
  const font = useFont();
  const [book, setBook] = useState(false);
  return (
    <Px>
      <div className="absolute inset-0" style={{ background: INK.bg }} />
      <div className="absolute flex items-center gap-3" style={{ left: 0, top: 0, width: 640, height: 64, background: "#000", padding: "0 16px", color: "#fff" }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: HER.color }} />
        <div className="flex flex-col">
          <span style={{ fontSize: font(9), color: INK.sub }}>{HER.name}的点单</span>
          <span style={{ fontSize: font(15) }}>{bar.memo}</span>
        </div>
      </div>
      <CornerButton x={498} y={20} onClick={() => setBook((b) => !b)}>
        {book ? "收起配方" : "配方书"}
      </CornerButton>
      <CornerButton x={588} y={20} onClick={onLeave}>
        离开
      </CornerButton>
      <div className="absolute" style={{ left: 117, top: 80, width: 270, height: 176, transform: "scale(1.5)", transformOrigin: "0 0" }}>
        <MixStation cells={cells} bar={bar} at={[0, 0]} withBg />
      </div>
      {book && <RecipeBook x={110} y={86} />}
    </Px>
  );
}

function CornerButton({ x, y, onClick, children }: { x: number; y: number; onClick: () => void; children: string }) {
  const font = useFont();
  return (
    <button
      type="button"
      className="bar-hit pointer-events-auto absolute"
      style={{ left: x, top: y, fontSize: font(10), color: "#fff", border: `1px solid ${INK.sub}`, padding: "3px 8px", background: "rgba(0,0,0,0.6)" }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
