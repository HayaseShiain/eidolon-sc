"use client";

// PROTOTYPE（bar 地图票 08）变体 A「原版画框」：盖住导航外壳、整屏一块 640×360；原版的外框、各区坐标原样，
// 立绘裁在客人窗里（到腰），调酒时配方书盖住她；点单备忘和「离开」放在原版侧边菜单那格。

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { playHref } from "@/lib/playRoute";

import {
  BarRoom,
  canLockLandscape,
  Door,
  EndPanel,
  fullscreenLandscape,
  INK,
  Logo,
  MixStation,
  Px,
  RecipeBook,
  Sprite,
  Stage,
  StandBox,
  TextBox,
  useFont,
  type Knobs,
} from "./pieces";
import type { Bar } from "./useBar";

export function VariantA({ bar, knobs }: { bar: Bar; knobs: Knobs }) {
  const router = useRouter();
  const leave = () => router.push(playHref());
  return (
    <div className="fixed inset-0 z-[60]" style={{ background: INK.bg }}>
      <Stage w={640} h={360} smooth={knobs.smooth} minFont={knobs.minFont}>
        <Px>
          <BarRoom />
        </Px>
        {bar.phase !== "door" && (
          <StandBox
            x={45}
            y={27}
            w={280}
            h={241}
            clip={[19, 27, 410, 241]}
            framing="waist"
            pixel={knobs.stand === "pixel"}
            mood={bar.mood}
            speaking={bar.speaking}
          />
        )}
        <Px>
          {bar.phase === "mixing" && <RecipeBook x={18} y={20} />}
          <Sprite name="frame" x={0} y={0} w={640} h={360} />
          <Logo />
          <MixStation cells={knobs.cells} bar={bar} />
          <TextBox bar={bar} x={17} y={276} w={412} h={65} />
          <SideMenu bar={bar} onLeave={leave} />
          {bar.phase === "door" && <Door onEnter={bar.enter} />}
          {bar.phase === "end" && <EndPanel first={knobs.firstToday} onAgain={bar.restart} onLeave={leave} />}
        </Px>
      </Stage>
    </div>
  );
}

/** 原版的侧边菜单（设置、读取、点唱机、退出）那格 (435,276) 190×65：上面是点单备忘，下面「离开」，安卓上多一个「全屏」。 */
function SideMenu({ bar, onLeave }: { bar: Bar; onLeave: () => void }) {
  const font = useFont();
  const [lockable, setLockable] = useState(false);
  useEffect(() => setLockable(canLockLandscape()), []);
  return (
    <div className="pointer-events-auto absolute flex flex-col justify-between" style={{ left: 437, top: 278, width: 186, height: 61, padding: "3px 6px", color: "#fff" }}>
      <div style={{ fontSize: font(9), lineHeight: 1.35 }}>
        {bar.memo ? (
          <>
            <span style={{ color: INK.sub }}>点单　</span>
            {bar.memo}
          </>
        ) : null}
      </div>
      <div className="flex justify-end gap-4" style={{ fontSize: font(9) }}>
        {lockable && (
          <button type="button" className="bar-hit" style={{ color: "#fff" }} onClick={() => void fullscreenLandscape()}>
            全屏
          </button>
        )}
        <button type="button" className="bar-hit" style={{ color: "#fff" }} onClick={onLeave}>
          离开
        </button>
      </div>
    </div>
  );
}
