"use client";

// PROTOTYPE（daily-tasks-and-achievements 票 04「原型：每日任务放在哪里、长什么样」）：只在 prototype/daily-tasks 分支，不进 main。
// 三个变体用 ?dt=A|B|C 切换（底部切换条，或键盘 ← →）：
// A：礼物页抽奖台下面一节「每日任务」，做完一项时内容区顶上出一条提示（通话层展开时等它收起再出），导航上没有点。
// B：对话列表搜索框下面一条可展开的「每日任务」，做完一项时导航「礼物」上一个点，去过礼物页就消失；全部做完这一条就不见了。
// C：对话列表和礼物页的页首各一个带圆环的按钮（和公告铃铛并排），点开浮层看三项；不出提示、不加点。

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PrototypeSwitcher, prototypeEnabled } from "@/components/app/PrototypeSwitcher";
import { useDirectory } from "@/components/conversations/ConversationDirectory";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CollapseIcon, DailyTasksIcon, SuccessIcon, TaskOpenIcon } from "@/theme/icons";

import {
  dismissToast,
  doneCount,
  gave,
  isDone,
  nextDay,
  progressOf,
  resetAll,
  seenDraws,
  setVariant,
  TASKS,
  turn,
  useDailyTasks,
  VARIANTS,
  type TaskId,
} from "./store";

const RENEW = "0 点换新";

/** 一项任务：没做完是空圈，做完是勾（刚做完的那一项弹一下）；右边「抽奖 ×1」，第三项带「3/10」。 */
function TaskRow({ id, action }: { id: TaskId; action?: React.ReactNode }) {
  const s = useDailyTasks();
  const task = TASKS.find((t) => t.id === id)!;
  const done = isDone(s, id);
  const progress = progressOf(s, id);
  return (
    <li className="flex min-h-11 items-center gap-3">
      {done ? (
        <SuccessIcon
          key={s.justDone === id ? `${id}-${s.turns}-${s.gave}` : id}
          aria-hidden
          className={cn("size-5 shrink-0", s.justDone === id && "motion-safe:animate-in motion-safe:zoom-in-50")}
        />
      ) : (
        <TaskOpenIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      )}
      <span className={cn("min-w-0 flex-1 text-body", done && "text-muted-foreground line-through")}>
        {task.label}
        {task.goal > 1 && !done && (
          <span className="ml-2 text-meta text-muted-foreground tabular-nums">
            {progress}/{task.goal}
          </span>
        )}
      </span>
      {!done && action}
      <span className="shrink-0 text-meta text-muted-foreground">抽奖 ×1</span>
    </li>
  );
}

// ───────────────────────── A：礼物页里 ─────────────────────────

/** A：礼物页抽奖台下面一节。没做完的回合任务旁边「去对话」，送礼那项旁边「挑一件」（滚到我的礼物）。全部做完收成一行。 */
export function TasksSection({ hasGifts }: { hasGifts: boolean }) {
  const s = useDailyTasks();
  const { go } = useDirectory();
  if (s.variant !== "A") return null;
  const count = doneCount(s);
  if (count === TASKS.length)
    return (
      <section className="flex items-center gap-3 rounded-2xl border px-5 py-3">
        <SuccessIcon aria-hidden className="size-5" />
        <p className="flex-1 text-body">每日任务都做完了</p>
        <span className="text-meta text-muted-foreground">{RENEW}</span>
      </section>
    );
  const toConversations = (
    <Button size="sm" variant="ghost" onClick={() => go("/conversations")}>
      去对话
    </Button>
  );
  return (
    <section aria-label="每日任务" className="flex flex-col gap-1 rounded-2xl border px-5 py-3">
      <p className="flex items-baseline gap-2">
        <span className="text-header">每日任务</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {count}/{TASKS.length}
        </span>
        <span className="flex-1" />
        <span className="text-meta text-muted-foreground">{RENEW}</span>
      </p>
      <ul>
        <TaskRow id="one" action={toConversations} />
        <TaskRow
          id="gift"
          action={
            hasGifts && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => document.getElementById("my-gifts")?.scrollIntoView({ behavior: "smooth" })}
              >
                挑一件
              </Button>
            )
          }
        />
        <TaskRow id="ten" action={toConversations} />
      </ul>
    </section>
  );
}

/** A：做完一项时内容区顶上的提示，6 秒后收起；不在礼物页时带「去抽奖」。通话层展开时不出，收起后再出。 */
export function DoneToast({ isCovered }: { isCovered: boolean }) {
  const s = useDailyTasks();
  const { go } = useDirectory();
  const pathname = usePathname();
  const toast = s.variant === "A" && !isCovered ? s.toast : null;
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  const all = doneCount(s) === TASKS.length;
  const names = toast.done.map((id) => TASKS.find((t) => t.id === id)!.label).join("、");
  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-4">
      <div
        key={toast.key}
        className="pointer-events-auto flex max-w-md min-w-0 items-center gap-3 rounded-full bg-foreground py-1.5 pr-1.5 pl-3 text-sm text-background shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2"
      >
        <SuccessIcon aria-hidden className="size-4 shrink-0" />
        <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
          {all ? "每日任务都做完了" : names} · 抽奖 +{toast.done.length}
        </span>
        {pathname !== "/gifts" ? (
          <Button
            size="sm"
            variant="toast"
            onClick={() => {
              dismissToast();
              go("/gifts");
            }}
          >
            去抽奖
          </Button>
        ) : (
          <span className="w-1.5" />
        )}
      </div>
    </div>
  );
}

// ───────────────────────── B：对话列表顶上 ─────────────────────────

/** B：搜索框下面一条，三个小点表示做完几项；点开在原地展开三项。全部做完这一条不见了。 */
export function TasksStrip() {
  const s = useDailyTasks();
  const [isOpen, setOpen] = useState(false);
  if (s.variant !== "B") return null;
  const count = doneCount(s);
  if (count === TASKS.length) return null;
  return (
    <div className="shrink-0 pr-2 pb-2 pl-4">
      <div className="rounded-lg bg-muted">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpen(!isOpen)}
          className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <DailyTasksIcon aria-hidden className="size-4 text-muted-foreground" />
          <span className="flex-1 text-body">每日任务</span>
          <span aria-label={`做完 ${count} 项，共 ${TASKS.length} 项`} className="flex gap-1">
            {TASKS.map((t) => (
              <span
                key={t.id}
                className={cn(
                  "size-2 rounded-full",
                  isDone(s, t.id) ? "bg-foreground" : "bg-foreground/15",
                  s.justDone === t.id && "motion-safe:animate-in motion-safe:zoom-in-0",
                )}
              />
            ))}
          </span>
          <CollapseIcon aria-hidden className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </button>
        {isOpen && (
          <ul className="px-3 pb-1">
            {TASKS.map((t) => (
              <TaskRow key={t.id} id={t.id} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** B：任务给了抽奖次数、还没去过礼物页时，「礼物」图标右上角一个点，和「对话」上的点一个样子。 */
export function GiftsNavDot() {
  const s = useDailyTasks();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/gifts") seenDraws();
  }, [pathname, s.unseenDraws]);
  if (s.variant !== "B" || !s.unseenDraws || pathname === "/gifts") return null;
  return <span aria-hidden className="absolute top-1 right-2.5 size-1.5 rounded-full bg-foreground" />;
}

// ───────────────────────── C：页首按钮 ─────────────────────────

/** C：页首一个按钮，图标外一圈三段的圆环，做完几段亮几段；全部做完换成勾。点开浮层列三项。 */
export function TasksButton() {
  const s = useDailyTasks();
  if (s.variant !== "C") return null;
  const count = doneCount(s);
  const all = count === TASKS.length;
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-lg" aria-label={`每日任务，做完 ${count} 项`} className="relative" />}
      >
        <Ring count={count} />
        {all ? (
          <SuccessIcon className="absolute size-4" />
        ) : (
          <DailyTasksIcon className="absolute size-3.5" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="flex items-baseline gap-2">
          <span className="text-header">每日任务</span>
          <span className="flex-1" />
          <span className="text-meta text-muted-foreground">{RENEW}</span>
        </p>
        <ul>
          {TASKS.map((t) => (
            <TaskRow key={t.id} id={t.id} />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function Ring({ count }: { count: number }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const seg = c / 3;
  const gap = 2.5;
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6 -rotate-90">
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx="12"
          cy="12"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className={cn("transition-colors", i < count ? "stroke-foreground" : "stroke-foreground/15")}
          strokeDasharray={`${seg - gap} ${c - seg + gap}`}
          strokeDashoffset={-i * seg}
        />
      ))}
    </svg>
  );
}

// ───────────────────────── 外壳里的原型件 ─────────────────────────

/** 变体切换条和右上角的「模拟」面板。 */
export function DailyTasksPrototypeBits() {
  const s = useDailyTasks();
  const [isOpen, setOpen] = useState(false);
  if (!prototypeEnabled) return null;
  return (
    <>
      <div className="fixed right-2 bottom-48 z-[100] flex flex-col items-end gap-1 rounded-xl bg-black p-2 text-xs text-white shadow-lg ring-2 ring-yellow-400">
        <button type="button" className="px-1 font-medium" onClick={() => setOpen(!isOpen)}>
          模拟 {isOpen ? "▾" : "▸"}
        </button>
        {isOpen && (
          <>
            <p className="tabular-nums">
              回合 {s.turns} · {s.gave ? "送过礼" : "没送礼"} · 任务给的抽奖 {s.bonus}
            </p>
            <div className="flex flex-wrap justify-end gap-1">
              <SimButton onClick={() => turn()}>+1 回合</SimButton>
              <SimButton onClick={() => turn(9)}>+9 回合</SimButton>
              <SimButton onClick={gave}>送出一件</SimButton>
              <SimButton onClick={nextDay}>到 0 点</SimButton>
              <SimButton onClick={resetAll}>全清</SimButton>
            </div>
          </>
        )}
      </div>
      <PrototypeSwitcher variants={VARIANTS} current={s.variant} onChange={setVariant} />
    </>
  );
}

function SimButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="rounded-md bg-white/15 px-2 py-1 hover:bg-white/30" onClick={onClick}>
      {children}
    </button>
  );
}

/** 抽奖台的次数加上任务给的（只是显示）。 */
export function useBonusDraws(): number {
  return useDailyTasks().bonus;
}
