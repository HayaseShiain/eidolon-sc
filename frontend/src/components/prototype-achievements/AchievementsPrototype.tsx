"use client";

// PROTOTYPE（daily-tasks-and-achievements 票 09「原型：成就放在哪里、长什么样」）：只在 prototype/achievements 分支，不进 main。
// 三个变体用 ?ac=A|B|C 切换（底部切换条，或键盘 ← →）：
// A：礼物页每日任务下面一节「成就」：合起来的四个列成行，按角色的是一面头像墙，点一位弹出她的四个；
//    解锁时导航「礼物」上一个点（同每日任务），新解锁的标一个点，看过消失；上线补算在这一节顶上一条说明。
// B：跟着她走：按角色的放在她的对话页（更多菜单「成就」打开面板），合起来的四个在礼物页一小节；
//    在对话里解锁时页首好感度标识旁边跳出奖杯和「+n」，更多菜单上留一个点；不加导航点，补算不另说。
// C：统计页里（设置 → 统计）最上面一块总表：合起来的四个，按角色的每个成就一行、展开是每位的进度；
//    解锁时内容区顶上一条提示（带「看看」），上线补算弹一个窗汇总。
// 「模拟」面板里另有两个和变体无关的开关：没解锁的阶段写多少、隐藏的角色怎么办。

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { MarkedAvatar } from "@/components/app/MarkedAvatar";
import { PrototypeSwitcher, prototypeEnabled } from "@/components/app/PrototypeSwitcher";
import { useDirectory } from "@/components/conversations/ConversationDirectory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Character } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AchievementsIcon, CloseIcon, CollapseIcon, SuccessIcon, TaskOpenIcon } from "@/theme/icons";

import {
  ABOUT,
  ALL,
  allValue,
  backfill,
  bonusOf,
  complete,
  dismissBackfill,
  dismissLatest,
  hasUnseen,
  isComplete,
  knowCharacters,
  markSeen,
  navDot,
  PER,
  PER_STAGES,
  perOf,
  perStages,
  resetAll,
  setHidden,
  setLocked,
  setVariant,
  stageOf,
  unlockAll,
  unlockOne,
  unseenKeys,
  useAchievements,
  VARIANTS,
  visitGifts,
  type Def,
  type Hidden,
  type Locked,
} from "./store";

const Dot = ({ className }: { className?: string }) => (
  <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full bg-foreground", className)} />
);

/** 阶段点：解锁的实心，没解锁的空心。 */
function Stages({ count, reached }: { count: number; reached: number }) {
  return (
    <span aria-label={`${reached}/${count} 个阶段`} className="flex shrink-0 gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cn("size-2 rounded-full", i < reached ? "bg-foreground" : "bg-foreground/15")} />
      ))}
    </span>
  );
}

/**
 * 一个成就一行：名字、阶段点；下面一行按「没解锁的阶段」开关写——
 * all：每个门槛都写（到了的深色）；next：现在多少 / 下一个门槛；none：什么都不写。右边是下一阶段的奖励（none 不写）。
 */
function AchievementLine({ def, value, isNew }: { def: Def<string>; value: number; isNew: boolean }) {
  const { locked } = useAchievements();
  const reached = stageOf(def, value);
  const done = reached === def.stages.length;
  return (
    <li className="flex min-h-11 items-center gap-3 py-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-body">
          {ABOUT[def.id as keyof typeof ABOUT]}
          {isNew && <Dot />}
        </span>
        {locked === "all" && (
          <span className="text-meta text-muted-foreground tabular-nums">
            {def.stages.map((t, i) => (
              <span key={t} className={cn(i < reached && "text-foreground")}>
                {i > 0 && " · "}
                {def.fmt(t)}
              </span>
            ))}
          </span>
        )}
        {locked === "next" && (
          <span className="text-meta text-muted-foreground tabular-nums">
            {done ? "全部解锁" : def.id === "tier" ? `下一个：${def.fmt(def.stages[reached])}` : `${def.fmt(value)} / ${def.fmt(def.stages[reached])}`}
          </span>
        )}
      </div>
      <Stages count={def.stages.length} reached={reached} />
      {locked !== "none" && (
        <span className="w-14 shrink-0 text-right text-meta text-muted-foreground">{done ? "" : `抽奖 ×${reached + 1}`}</span>
      )}
    </li>
  );
}

/** 合起来的四个。 */
function CombinedLines() {
  const s = useAchievements();
  const unseen = unseenKeys(s);
  return (
    <ul>
      {ALL.map((d) => (
        <AchievementLine
          key={d.id}
          def={d}
          value={allValue(s, d.id)}
          isNew={[...unseen].some((k) => k.startsWith(`all:${d.id}:`))}
        />
      ))}
    </ul>
  );
}

/** 她的四个，最后一行是集齐。 */
function HerLines({ character }: { character: Character }) {
  const s = useAchievements();
  const p = perOf(s, character.id);
  const unseen = unseenKeys(s);
  const done = isComplete(p);
  return (
    <ul>
      {PER.map((d) => (
        <AchievementLine
          key={d.id}
          def={d}
          value={p[d.id]}
          isNew={[...unseen].some((k) => k.startsWith(`${character.id}:${d.id}:`))}
        />
      ))}
      <li className="flex min-h-11 items-center gap-3 border-t pt-1">
        {done ? <SuccessIcon aria-hidden className="size-5" /> : <TaskOpenIcon aria-hidden className="size-5 text-muted-foreground" />}
        <span className={cn("flex-1 text-body", !done && "text-muted-foreground")}>
          {done ? "集齐了" : "集齐"}
          {unseen.has(`${character.id}:card`) && <Dot className="ml-2 inline-block align-middle" />}
        </span>
        {(s.locked !== "none" || done) && <span className="text-meta text-muted-foreground">重置卡 ×1</span>}
      </li>
    </ul>
  );
}

/** 排角色：隐藏的照开关排到最后或拿掉。 */
function useArranged(): { list: Character[]; hiddenIds: Set<string> } {
  const s = useAchievements();
  const { characters, preferences } = useDirectory();
  const hiddenIds = new Set(preferences.hidden);
  const all = characters || [];
  if (s.hidden === "omit") return { list: all.filter((c) => !hiddenIds.has(c.id)), hiddenIds };
  if (s.hidden === "last")
    return { list: [...all.filter((c) => !hiddenIds.has(c.id)), ...all.filter((c) => hiddenIds.has(c.id))], hiddenIds };
  return { list: all, hiddenIds };
}

// ───────────────────────── A：礼物页一节 ─────────────────────────

/** A：每日任务下面一节。 */
function SectionA() {
  const s = useAchievements();
  const { list, hiddenIds } = useArranged();
  const [her, setHer] = useState<Character | null>(null);
  return (
    <section aria-label="成就" className="flex flex-col gap-2 rounded-2xl border px-5 py-3">
      <p className="text-header">成就</p>
      {s.backfill && (
        <div className="flex items-center gap-3 rounded-lg bg-muted py-2 pr-1 pl-3">
          <AchievementsIcon aria-hidden className="size-4 shrink-0" />
          <p className="min-w-0 flex-1 text-sm">
            按以前的往来解锁了 {s.backfill.stages} 个阶段 · 抽奖 +{s.backfill.draws}
            {s.backfill.cards > 0 && ` · 重置卡 +${s.backfill.cards}`}
          </p>
          <Button size="icon-sm" variant="ghost" aria-label="知道了" onClick={dismissBackfill}>
            <CloseIcon />
          </Button>
        </div>
      )}
      <CombinedLines />
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 gap-y-3 border-t pt-3">
        {list.map((c) => {
          const p = perOf(s, c.id);
          const n = perStages(p);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setHer(c);
                  markSeen(`${c.id}:`);
                }}
                className={cn(
                  "relative flex w-full flex-col items-center gap-1 rounded-lg p-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  s.hidden === "last" && hiddenIds.has(c.id) && "opacity-50",
                )}
              >
                <span className={cn("relative", n === 0 && "opacity-40")}>
                  <MarkedAvatar name={c.name} src={c.avatar_url} size="lg" />
                  {isComplete(p) && <SuccessIcon aria-hidden className="absolute -right-1 -bottom-1 size-4 rounded-full bg-background" />}
                  {hasUnseen(s, c.id) && <Dot className="absolute top-0 right-0" />}
                </span>
                <span className="w-full truncate text-center text-meta">{c.name}</span>
                <span className="text-meta text-muted-foreground tabular-nums">
                  {n}/{PER_STAGES}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Dialog open={her !== null} onOpenChange={(open) => !open && setHer(null)}>
        <DialogContent>
          {her && (
            <>
              <DialogHeader className="flex-row items-center gap-3">
                <MarkedAvatar name={her.name} src={her.avatar_url} size="lg" />
                <div>
                  <DialogTitle>{her.name}</DialogTitle>
                  <DialogDescription className="tabular-nums">
                    {perStages(perOf(s, her.id))}/{PER_STAGES} 个阶段
                  </DialogDescription>
                </div>
              </DialogHeader>
              <HerLines character={her} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** A：「礼物」上的点：有进礼物页以后才解锁的；进了礼物页就消失。 */
export function GiftsNavDot() {
  const s = useAchievements();
  const pathname = usePathname();
  useEffect(() => {
    if (s.variant === "A" && pathname === "/gifts") visitGifts();
  }, [pathname, s]);
  if (s.variant !== "A" || pathname === "/gifts" || !navDot(s)) return null;
  return <Dot className="absolute top-1 right-2.5" />;
}

// ───────────────────────── B：跟着她走 ─────────────────────────

/** B：礼物页里合起来的四个，一小节。 */
function SectionB() {
  useEffect(() => () => markSeen("all:"), []);
  return (
    <section aria-label="成就" className="flex flex-col gap-1 rounded-2xl border px-5 py-3">
      <p className="text-header">成就</p>
      <CombinedLines />
    </section>
  );
}

/** B：对话页要不要加「成就」这一项。 */
export function useIsB(): boolean {
  return useAchievements().variant === "B";
}

/** B：菜单项「成就」后面的点：她有没看过的解锁。 */
export function HerDotB({ character }: { character: Character }) {
  const s = useAchievements();
  if (s.variant !== "B" || !hasUnseen(s, character.id)) return null;
  return <Dot className="ml-auto" />;
}

/** B：更多菜单键上的点：她有没看过的解锁。 */
export function MoreDotB({ character }: { character: Character }) {
  const s = useAchievements();
  if (s.variant !== "B" || !hasUnseen(s, character.id)) return null;
  return <Dot className="absolute top-2 right-2" />;
}

export function HerSheetB({
  character,
  isOpen,
  onOpenChange,
  container,
}: {
  character: Character;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  container: React.RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (isOpen) markSeen(`${character.id}:`);
  }, [isOpen, character.id]);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent container={container}>
        <DialogHeader>
          <DialogTitle>成就</DialogTitle>
        </DialogHeader>
        <HerLines character={character} />
      </DialogContent>
    </Dialog>
  );
}

/** B：在对话里解锁了她的阶段：好感度标识左边跳出奖杯和「+n」，3 秒后收起。 */
export function HeaderCueB({ character }: { character: Character }) {
  const s = useAchievements();
  const [now, setNow] = useState(() => Date.now());
  const latest = s.latest;
  const live = s.variant === "B" && latest && latest.characterId === character.id && now - latest.at < 3000;
  useEffect(() => {
    if (!latest) return;
    setNow(Date.now());
    const timer = setTimeout(() => setNow(Date.now()), 3100);
    return () => clearTimeout(timer);
  }, [latest]);
  if (!live) return null;
  return (
    <span
      key={latest.at}
      role="status"
      aria-label={`成就 ${latest.label}，抽奖 +${latest.draws}`}
      className="flex items-center gap-1 px-1 text-sm motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in"
    >
      <AchievementsIcon aria-hidden className="size-4" />
      <span className="tabular-nums">+{latest.draws}</span>
    </span>
  );
}

// ───────────────────────── C：统计页里 ─────────────────────────

/** C：统计页最上面一块。 */
export function StatsBlockC() {
  const s = useAchievements();
  const { list, hiddenIds } = useArranged();
  const [open, setOpen] = useState<string | null>(null);
  const isC = s.variant === "C";
  useEffect(() => () => void (isC && markSeen()), [isC]);
  if (!isC) return null;
  const completed = list.filter((c) => isComplete(perOf(s, c.id))).length;
  return (
    <section aria-label="成就" className="flex flex-col gap-2">
      <h2 className="text-header">成就</h2>
      <CombinedLines />
      <ul className="flex flex-col border-t">
        {PER.map((d) => {
          const reachedFirst = list.filter((c) => perOf(s, c.id)[d.id] >= d.stages[0]).length;
          const isOpen = open === d.id;
          const sorted = [...list].sort((a, b) => perOf(s, b.id)[d.id] - perOf(s, a.id)[d.id]);
          return (
            <li key={d.id} className="border-b">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : d.id)}
                className="flex min-h-11 w-full items-center gap-3 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex-1 text-body">{ABOUT[d.id]}</span>
                <span className="text-meta text-muted-foreground tabular-nums">
                  {reachedFirst}/{list.length} 位
                </span>
                {[...unseenKeys(s)].some((k) => k.includes(`:${d.id}:`)) && <Dot />}
                <CollapseIcon aria-hidden className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <ul className="pb-2">
                  {sorted.map((c) => {
                    const value = perOf(s, c.id)[d.id];
                    const reached = stageOf(d, value);
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "flex min-h-10 items-center gap-3",
                          s.hidden === "last" && hiddenIds.has(c.id) && "opacity-50",
                          reached === 0 && "text-muted-foreground",
                        )}
                      >
                        <MarkedAvatar name={c.name} src={c.avatar_url} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                        {s.locked === "next" && (
                          <span className="text-meta text-muted-foreground tabular-nums">
                            {reached === d.stages.length ? "" : `${d.fmt(value)} / ${d.fmt(d.stages[reached])}`}
                          </span>
                        )}
                        <Stages count={d.stages.length} reached={reached} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
        <li className="flex min-h-11 items-center gap-3 py-1">
          <span className="flex-1 text-body">集齐</span>
          <span className="text-meta text-muted-foreground tabular-nums">{completed} 位</span>
          {s.locked !== "none" && <span className="text-meta text-muted-foreground">每位重置卡 ×1</span>}
        </li>
      </ul>
    </section>
  );
}

/** C：解锁时内容区顶上一条，6 秒后收起；不在统计页时带「看看」。 */
export function UnlockToastC({ isCovered }: { isCovered: boolean }) {
  const s = useAchievements();
  const { go } = useDirectory();
  const pathname = usePathname();
  const latest = s.variant === "C" && !isCovered ? s.latest : null;
  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(dismissLatest, 6000);
    return () => clearTimeout(timer);
  }, [latest]);
  if (!latest) return null;
  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-4">
      <div
        key={latest.at}
        className="pointer-events-auto flex max-w-md min-w-0 items-center gap-3 rounded-full bg-foreground py-1.5 pr-1.5 pl-3 text-sm text-background shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2"
      >
        <AchievementsIcon aria-hidden className="size-4 shrink-0" />
        <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
          {latest.label} · 抽奖 +{latest.draws}
          {latest.card && " · 重置卡 +1"}
        </span>
        {pathname !== "/settings/stats" ? (
          <Button
            size="sm"
            variant="toast"
            onClick={() => {
              dismissLatest();
              go("/settings/stats");
            }}
          >
            看看
          </Button>
        ) : (
          <span className="w-1.5" />
        )}
      </div>
    </div>
  );
}

/** C：上线补算以后第一次打开，弹一个窗汇总。 */
function BackfillDialogC() {
  const s = useAchievements();
  const { go } = useDirectory();
  const b = s.variant === "C" ? s.backfill : null;
  return (
    <Dialog open={b !== null} onOpenChange={(open) => !open && dismissBackfill()}>
      <DialogContent>
        {b && (
          <>
            <DialogHeader>
              <DialogTitle>成就</DialogTitle>
              <DialogDescription>按以前的往来补算了一遍。</DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col gap-1 text-body tabular-nums">
              <li>解锁 {b.stages} 个阶段</li>
              <li>抽奖 +{b.draws}</li>
              {b.cards > 0 && <li>重置卡 +{b.cards}</li>}
            </ul>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  dismissBackfill();
                  go("/settings/stats");
                }}
              >
                看看
              </Button>
              <Button onClick={dismissBackfill}>好</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── 礼物页里的件 ─────────────────────────

/** 礼物页抽奖台下面：每日任务（照票 04 定下的样子，写死一项做完，只作陪衬），A、B 再接成就。 */
export function GiftsPageBits() {
  const s = useAchievements();
  return (
    <>
      <section aria-label="每日任务" className="flex flex-col gap-1 rounded-2xl border px-5 py-3">
        <p className="flex items-baseline gap-2">
          <span className="text-header">每日任务</span>
          <span className="text-sm text-muted-foreground tabular-nums">1/3</span>
          <span className="flex-1" />
          <span className="text-meta text-muted-foreground">0 点换新</span>
        </p>
        <ul>
          {[
            ["对话一个回合", true],
            ["送出一件礼物", false],
            ["一共 10 个回合", false],
          ].map(([label, done]) => (
            <li key={label as string} className="flex min-h-11 items-center gap-3">
              {done ? <SuccessIcon aria-hidden className="size-5" /> : <TaskOpenIcon aria-hidden className="size-5 text-muted-foreground" />}
              <span className={cn("flex-1 text-body", done && "text-muted-foreground line-through")}>{label}</span>
              <span className="text-meta text-muted-foreground">抽奖 ×1</span>
            </li>
          ))}
        </ul>
      </section>
      {s.variant === "A" && <SectionA />}
      {s.variant === "B" && <SectionB />}
    </>
  );
}

/** 抽奖台的次数加上成就给的（只是显示）。 */
export function useAchievementDraws(): number {
  return bonusOf(useAchievements()).draws;
}

// ───────────────────────── 外壳里的原型件 ─────────────────────────

/** 变体切换条、右边的「模拟」面板，和 C 的补算弹窗。 */
export function AchievementsPrototypeBits({ isCovered }: { isCovered: boolean }) {
  const s = useAchievements();
  const { characters } = useDirectory();
  const [isOpen, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    if (characters) knowCharacters(characters);
  }, [characters]);
  if (!prototypeEnabled) return null;
  const bonus = bonusOf(s);
  const here = /^\/conversation\/([^/]+)/.exec(pathname)?.[1] ?? null;
  return (
    <>
      <UnlockToastC isCovered={isCovered} />
      <BackfillDialogC />
      <div className="fixed right-2 bottom-48 z-[100] flex max-w-72 flex-col items-end gap-1 rounded-xl bg-black p-2 text-xs text-white shadow-lg ring-2 ring-yellow-400">
        <button type="button" className="px-1 font-medium" onClick={() => setOpen(!isOpen)}>
          模拟 {isOpen ? "▾" : "▸"}
        </button>
        {isOpen && (
          <>
            <p className="text-right tabular-nums">
              成就给的：抽奖 {bonus.draws} · 重置卡 {bonus.cards}
            </p>
            <div className="flex flex-wrap justify-end gap-1">
              <SimButton onClick={backfill}>上线补算</SimButton>
              <SimButton onClick={() => unlockOne(here ?? undefined)}>{here ? "她解锁一个" : "某位解锁一个"}</SimButton>
              <SimButton onClick={unlockAll}>合起来的解锁一个</SimButton>
              <SimButton onClick={() => complete(here ?? undefined)}>{here ? "集齐她" : "集齐一位"}</SimButton>
              <SimButton onClick={resetAll}>全清</SimButton>
            </div>
            <Toggle<Locked>
              label="没解锁的阶段"
              value={s.locked}
              options={[
                ["all", "全写"],
                ["next", "只写下一个"],
                ["none", "不写"],
              ]}
              onChange={setLocked}
            />
            <Toggle<Hidden>
              label="隐藏的角色"
              value={s.hidden}
              options={[
                ["same", "照常"],
                ["last", "排最后"],
                ["omit", "不显示"],
              ]}
              onChange={setHidden}
            />
          </>
        )}
      </div>
      <PrototypeSwitcher variants={VARIANTS} current={s.variant} onChange={setVariant} />
    </>
  );
}

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <span className="opacity-70">{label}</span>
      {options.map(([k, name]) => (
        <SimButton key={k} isOn={value === k} onClick={() => onChange(k)}>
          {name}
        </SimButton>
      ))}
    </div>
  );
}

function SimButton({ onClick, isOn, children }: { onClick: () => void; isOn?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn("rounded-md px-2 py-1", isOn ? "bg-yellow-400 text-black" : "bg-white/15 hover:bg-white/30")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
