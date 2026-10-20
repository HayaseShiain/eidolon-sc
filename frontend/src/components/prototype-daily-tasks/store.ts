// PROTOTYPE（daily-tasks-and-achievements 票 04「原型：每日任务放在哪里、长什么样」）：只在 prototype/daily-tasks 分支，不进 main。
// 每日任务的进度只存在内存里（刷新就没了）。真发出的回合（liveConversation 的 done）和真送出的礼物（礼物页）会推进它，
// 「模拟」面板也能推进。任务给的抽奖次数只加在抽奖台的显示上，真去抽时用的还是服务器的次数。

import { useSyncExternalStore } from "react";

export type TaskId = "one" | "gift" | "ten";

export const TASKS: { id: TaskId; label: string; goal: number }[] = [
  { id: "one", label: "对话一个回合", goal: 1 },
  { id: "gift", label: "送出一件礼物", goal: 1 },
  { id: "ten", label: "一共 10 个回合", goal: 10 },
];

export const VARIANTS = [
  { key: "A", name: "礼物页里 · 顶上提示" },
  { key: "B", name: "对话列表顶上 · 礼物上的点" },
  { key: "C", name: "页首按钮 · 圆环" },
];

type Toast = { key: number; done: TaskId[] };

type State = {
  variant: string;
  turns: number;
  gave: boolean;
  /** 任务给的抽奖次数，加在抽奖台的显示上。 */
  bonus: number;
  /** B：任务给了次数、还没去过礼物页。 */
  unseenDraws: boolean;
  /** A：刚做完的那一项（或几项），等通话层收起以后再出。 */
  toast: Toast | null;
  /** 刚做完的，给打勾那一下的动画用。 */
  justDone: TaskId | null;
};

let state: State = {
  variant: "A",
  turns: 0,
  gave: false,
  bonus: 0,
  unseenDraws: false,
  toast: null,
  justDone: null,
};
const listeners = new Set<() => void>();
let readUrl = false;

const SAVED = "prototype-daily-tasks";

function set(change: Partial<State>) {
  state = { ...state, ...change };
  sessionStorage.setItem(SAVED, JSON.stringify({ turns: state.turns, gave: state.gave, bonus: state.bonus }));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  if (!readUrl && typeof window !== "undefined") {
    readUrl = true;
    const v = new URLSearchParams(window.location.search).get("dt");
    if (v && VARIANTS.some((x) => x.key === v)) state = { ...state, variant: v };
    const saved = sessionStorage.getItem(SAVED);
    if (saved) state = { ...state, ...JSON.parse(saved) };
  }
  listeners.add(l);
  return () => listeners.delete(l);
}

const initial = state;
export function useDailyTasks(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}

export function setVariant(variant: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("dt", variant);
  window.history.replaceState(window.history.state, "", url);
  set({ variant });
}

export function progressOf(s: Pick<State, "turns" | "gave">, id: TaskId): number {
  return id === "gift" ? (s.gave ? 1 : 0) : Math.min(s.turns, id === "one" ? 1 : 10);
}

export function isDone(s: Pick<State, "turns" | "gave">, id: TaskId): boolean {
  return progressOf(s, id) >= TASKS.find((t) => t.id === id)!.goal;
}

export function doneCount(s: Pick<State, "turns" | "gave">): number {
  return TASKS.filter((t) => isDone(s, t.id)).length;
}

function advance(next: Pick<State, "turns" | "gave">) {
  const newlyDone = TASKS.filter((t) => !isDone(state, t.id) && isDone(next, t.id)).map((t) => t.id);
  if (newlyDone.length === 0) {
    set(next);
    return;
  }
  set({
    ...next,
    bonus: state.bonus + newlyDone.length,
    unseenDraws: true,
    toast: { key: Date.now(), done: newlyDone },
    justDone: newlyDone[newlyDone.length - 1],
  });
}

/** 记下一个回合（真发出的或模拟的）。 */
export function turn(n = 1) {
  advance({ turns: state.turns + n, gave: state.gave });
}

/** 送出一件礼物（真送的或模拟的）。 */
export function gave() {
  advance({ turns: state.turns, gave: true });
}

/** 模拟北京时间 0 点：任务清零，任务给过的抽奖次数留着。 */
export function nextDay() {
  set({ turns: 0, gave: false, toast: null, justDone: null });
}

export function resetAll() {
  set({ turns: 0, gave: false, bonus: 0, unseenDraws: false, toast: null, justDone: null });
}

export function seenDraws() {
  if (state.unseenDraws) set({ unseenDraws: false });
}

export function dismissToast() {
  set({ toast: null });
}
