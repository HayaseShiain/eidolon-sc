"use client";

// PROTOTYPE（bar 地图票 08）变体 A「原版画框」：盖住导航外壳、整屏一块 640×360；原版的外框、各区坐标原样，
// 立绘裁在客人窗里（到腰），调酒时配方书盖住她；点单备忘和「离开」放在原版侧边菜单那格。

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { playHref } from "@/lib/playRoute";

import { JukeboxSetup, SmallPlayer, useJukebox, type Jukebox } from "./jukebox";
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
  const juke = useJukebox({ chooseFirst: knobs.jukebox, play: bar.play });
  const [touch, setTouch] = useState(false);
  const [lockable, setLockable] = useState(false);
  useEffect(() => {
    setTouch(matchMedia("(pointer: coarse)").matches);
    setLockable(canLockLandscape());
  }, []);
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
            pixel={knobs.stand !== "hd"}
            mood={bar.mood}
            speaking={bar.speaking}
          />
        )}
        <Px>
          {bar.phase === "mixing" && <RecipeBook x={18} y={20} play={bar.play} />}
          <Sprite name="frame" x={0} y={0} w={640} h={360} />
          <Logo />
          {juke.open && <SmallPlayer juke={juke} />}
          <MixStation cells={knobs.cells} bar={bar} />
          <TextBox bar={bar} x={17} y={276} w={412} h={65} />
          <SideMenu bar={bar} juke={juke} onLeave={leave} />
          {/* 先选歌、再开店：选歌界面底下是还没开门的酒吧 */}
          {bar.phase === "door" && juke.ready && (
            <>
              <Door
                onEnter={() => {
                  bar.enter();
                  juke.ensurePlaying();
                }}
              />
              {lockable && (
                <>
                  <Txt x={560} y={330} runs="全屏" size={13} />
                  <button type="button" aria-label="全屏" className="bar-hit pointer-events-auto absolute" style={{ left: 552, top: 324, width: 50, height: 24 }} onClick={() => void fullscreenLandscape()} />
                </>
              )}
            </>
          )}
          {bar.phase === "end" && <EndPanel first={knobs.firstToday} onAgain={bar.restart} onLeave={leave} />}
          {!juke.ready && <JukeboxSetup juke={juke} play={bar.play} touch={touch} />}
        </Px>
      </Stage>
    </div>
  );
}

/**
 * 原版的侧边菜单（设置 (445,285)、读取 (543,285)、点唱机 (445,312)、退出 (543,312)），没有悬停效果：
 * 上面一行的位置放点单备忘；「点唱机」开着时橙黄、没选好歌之前灰；「离开」在「退出」的位置。
 */
function SideMenu({ bar, juke, onLeave }: { bar: Bar; juke: Jukebox; onLeave: () => void }) {
  const link = (label: string, lx: number, color: string, onClick: () => void) => (
    <>
      <Txt x={lx + 5} y={313} runs={label} size={13} color={color} />
      <button type="button" aria-label={label} className="bar-hit pointer-events-auto absolute" style={{ left: lx, top: 312, width: 72, height: 20 }} onClick={onClick} />
    </>
  );
  return (
    <>
      {bar.memo && <Txt x={445} y={282} w={172} runs={[{ text: "点单　", color: INK.sub }, { text: bar.memo }]} size={13} lineHeight={16} />}
      {link("点唱机", 445, !juke.ready ? "#808080" : juke.open ? "#ffbb31" : "#fff", juke.toggleOpen)}
      {link("离开", 543, "#fff", onLeave)}
    </>
  );
}
