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
  Txt,
  type Knobs,
} from "./pieces";
import type { Bar } from "./useBar";

export function VariantA({ bar, knobs }: { bar: Bar; knobs: Knobs }) {
  const router = useRouter();
  const leave = () => router.push(playHref());
  return (
    <div className="fixed inset-0 z-[60]" style={{ background: INK.bg }}>
      <Stage w={640} h={360} smooth={knobs.smooth} minFont={knobs.minFont} font={knobs.font}>
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

/** 原版的侧边菜单（设置 (445,285)、读取 (543,285)、点唱机 (445,312)、退出 (543,312)）那格：上面是点单备忘，「离开」在「退出」的位置，安卓上「全屏」在点唱机的位置。 */
function SideMenu({ bar, onLeave }: { bar: Bar; onLeave: () => void }) {
  const [lockable, setLockable] = useState(false);
  useEffect(() => setLockable(canLockLandscape()), []);
  const link = (label: string, lx: number, onClick: () => void) => (
    <>
      <Txt x={lx} y={312} runs={label} size={13} />
      <button type="button" aria-label={label} className="bar-hit pointer-events-auto absolute" style={{ left: lx - 4, top: 308, width: 60, height: 22 }} onClick={onClick} />
    </>
  );
  return (
    <>
      {bar.memo && <Txt x={445} y={282} w={172} runs={[{ text: "点单　", color: INK.sub }, { text: bar.memo }]} size={13} lineHeight={16} />}
      {lockable && link("全屏", 445, () => void fullscreenLandscape())}
      {link("离开", 543, onLeave)}
    </>
  );
}
