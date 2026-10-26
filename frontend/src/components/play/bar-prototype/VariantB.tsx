"use client";

// PROTOTYPE（bar 地图票 08）变体 B「嵌在外壳里」：玩法子页照常有页首和导航外壳；不用原版外框，像素画面只剩吧台背景和调酒台，
// 立绘放大、不裁；台词、点单备忘、配方书、结束都是应用自己的高清界面（shadcn），字不跟着像素画面缩。

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageShell } from "@/components/app/PageShell";
import { PlaySubpageHeader } from "@/components/play/PlayShell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { playHref } from "@/lib/playRoute";
import { herVars } from "@/theme/herVars";

import { DRINKS, FLAVORS, HER, INGREDIENTS, KINDS, type Drink } from "./data";
import { BarRoom, Door, Hd, LineText, MixStation, Px, Stage, StandBox, type Knobs } from "./pieces";
import type { Bar } from "./useBar";

const W = 694;
const H = 257;

export function VariantB({ bar, knobs }: { bar: Bar; knobs: Knobs }) {
  const router = useRouter();
  const [book, setBook] = useState(false);
  return (
    <div className="h-full" style={herVars(HER.color)}>
      <PageShell width="full" isInShell isScrollable={false} header={<PlaySubpageHeader title="VA-283" />}>
        <div className="relative flex min-h-0 flex-1 flex-col p-2">
          <Stage w={W} h={H} integer={false} smooth={knobs.smooth} minFont={knobs.minFont}>
            <Px w={W} h={H}>
              <div className="absolute inset-0" style={{ background: "#000" }} />
              <BarRoom x={0} y={0} />
            </Px>
            {bar.phase !== "door" && (
              <StandBox x={40} y={0} w={344} h={257} clip={[0, 0, 424, 257]} framing="waist" pixel={knobs.stand === "pixel"} mood={bar.mood} speaking={bar.speaking} />
            )}
            <Px w={W} h={H}>
              <MixStation cells={knobs.cells} bar={bar} at={[424, 0]} withBg />
            </Px>
            {/* 台词：高清字，名字条用她的颜色 */}
            <Hd x={0} y={170} w={424} h={87}>
              <button type="button" onClick={bar.advance} className="absolute inset-0 bg-black/75 px-3 pt-5 pb-2 text-left">
                {bar.line && bar.phase !== "door" && bar.phase !== "end" && <LineText line={bar.line} typed={bar.typed} size={15} hd />}
                {bar.phase === "talk" && bar.isLineDone && <span className="bar-ctc absolute right-3 bottom-2 text-xs text-white">▼</span>}
              </button>
              {bar.line && bar.phase !== "door" && (
                <span className="absolute -top-3 left-3 rounded-full bg-primary px-3 py-0.5 text-sm text-primary-foreground">
                  {bar.line.who === "her" ? HER.name : "制作人"}
                </span>
              )}
            </Hd>
            {/* 点单备忘和配方书按钮 */}
            <Hd x={424} y={176} w={270} h={81} className="flex flex-col justify-center gap-1.5 bg-card px-3 text-card-foreground">
              <div className="text-sm">
                <span className="text-muted-foreground">点单　</span>
                {bar.lastMemo ?? "—"}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setBook(true)}>
                  配方书
                </Button>
              </div>
            </Hd>
            {bar.phase === "door" && (
              <Px w={640} h={360} className="origin-top-left">
                <div style={{ transform: `scale(${H / 360})`, transformOrigin: "0 0" }} className="absolute inset-0">
                  <Door onEnter={bar.enter} />
                </div>
              </Px>
            )}
          </Stage>
          {bar.phase === "end" && (
            <div className="absolute inset-0 grid place-items-center bg-background/70">
              <div className="flex flex-col items-center gap-4 rounded-xl border bg-card px-8 py-6">
                {knobs.firstToday ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg">抽奖 +1</span>
                    <span className="text-primary">♥ 好感度上升</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">{HER.name}走了</span>
                )}
                <div className="flex gap-2">
                  <Button onClick={bar.restart}>再营业</Button>
                  <Button variant="outline" onClick={() => router.push(playHref())}>
                    离开
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageShell>
      <RecipeSheet open={book} onOpenChange={setBook} />
    </div>
  );
}

const PARTS = (d: Drink) => {
  if (!d.recipe) return "瓶装，直接上";
  const parts = INGREDIENTS.map((ing, i) => {
    const n = d.recipe![i];
    if (n === null) return `${ing.name} 可选`;
    return n > 0 ? `${n} ${ing.name}` : null;
  }).filter(Boolean);
  return [parts.join("、"), d.ice ? "加冰" : null, d.aged ? "陈化" : null, d.method === "mix" ? "摇和" : "搅拌"].filter(Boolean).join("，");
};

/** 配方书做成高清的侧边面板：照原版四个标签，列表加配方；官方中文配方卡的图放在下面。 */
function RecipeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState("flavor");
  const [picked, setPicked] = useState<Drink | null>(null);
  const groups: [string, Drink[]][] =
    tab === "name"
      ? [...new Set(DRINKS.filter((d) => d.page !== null).map((d) => d.name[0]))].sort().map((l) => [l, DRINKS.filter((d) => d.page !== null && d.name[0] === l)])
      : tab === "flavor"
        ? FLAVORS.map(([k, n]) => [n, DRINKS.filter((d) => d.page !== null && d.flavor === k)])
        : tab === "kind"
          ? KINDS.map(([k, n]) => [n, DRINKS.filter((d) => d.page !== null && d.kind === k)])
          : [["瓶装饮品", DRINKS.filter((d) => d.page === null)]];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>配方书</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList>
              <TabsTrigger value="name">名称</TabsTrigger>
              <TabsTrigger value="flavor">口味</TabsTrigger>
              <TabsTrigger value="kind">种类</TabsTrigger>
              <TabsTrigger value="bottle">瓶装</TabsTrigger>
            </TabsList>
          </Tabs>
          {picked ? (
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="ghost" className="self-start" onClick={() => setPicked(null)}>
                ‹ 返回
              </Button>
              <div className="text-base font-medium">{picked.name}</div>
              <div className="text-sm">{PARTS(picked)}</div>
              {picked.page !== null && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/prototype-bar/img/recipe_${picked.page}.png`} alt="" className="w-full [image-rendering:pixelated]" />
              )}
            </div>
          ) : (
            groups.map(([name, drinks]) => (
              <div key={name} className="flex flex-col gap-1">
                <div className="text-xs text-muted-foreground">{name}</div>
                {drinks.map((d) => (
                  <button key={d.id} type="button" className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setPicked(d)}>
                    {d.name}
                    <span className="ml-2 text-xs text-muted-foreground">{d.note ?? PARTS(d)}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
