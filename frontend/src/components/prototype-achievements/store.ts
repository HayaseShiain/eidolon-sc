// PROTOTYPE（daily-tasks-and-achievements 票 09「原型：成就放在哪里、长什么样」）：只在 prototype/achievements 分支，不进 main。
// 成就的进度只存在内存里（加一份 sessionStorage，刷新还在）。真发出的回合（liveConversation 的 done）会给那位角色 +1 回合，
// 其余靠「模拟」面板推进。成就给的抽奖次数只加在抽奖台的显示上，真去抽时用的还是服务器的次数。
// 门槛和奖励照票 05、票 08：第 n 阶段给 n 次抽奖；一位角色按角色算的阶段全部解锁（集齐）再给 1 张重置卡。

import { useSyncExternalStore } from "react";

export type PerId = "turns" | "call" | "gifts" | "tier";
export type AllId = "met" | "close" | "days" | "draws";

export type Def<Id extends string> = {
  id: Id;
  /** 一个阶段的名字里用：「回合 第 2 阶段」。 */
  name: string;
  stages: number[];
  /** 门槛或进度怎么写。 */
  fmt: (n: number) => string;
};

const minutes = (m: number) => (m < 60 ? `${m} 分钟` : `${Math.floor(m / 60)} 小时`);
const TIERS = ["", "亲近", "亲密"];

export const PER: Def<PerId>[] = [
  { id: "turns", name: "回合", stages: [10, 100, 300, 1000, 3000], fmt: (n) => `${n} 个回合` },
  { id: "call", name: "通话", stages: [10, 60, 300, 1200], fmt: minutes },
  { id: "gifts", name: "礼物", stages: [1, 10, 30, 100], fmt: (n) => `${n} 件` },
  { id: "tier", name: "好感度", stages: [1, 2], fmt: (n) => TIERS[n] || "—" },
];

export const ALL: Def<AllId>[] = [
  { id: "met", name: "往来", stages: [3, 10, 28], fmt: (n) => `${n} 位` },
  { id: "close", name: "亲密", stages: [1, 3, 10], fmt: (n) => `${n} 位` },
  { id: "days", name: "来访", stages: [7, 30, 100, 365], fmt: (n) => `${n} 天` },
  { id: "draws", name: "抽奖", stages: [10, 50, 200, 500], fmt: (n) => `${n} 次` },
];

/** 每个成就一句话说明（门槛旁边）。 */
export const ABOUT: Record<PerId | AllId, string> = {
  turns: "和她的回合",
  call: "和她通话",
  gifts: "送她的礼物",
  tier: "她的好感度到过",
  met: "往来过的角色",
  close: "到过亲密的角色",
  days: "来过的天数",
  draws: "抽过的奖",
};

export const PER_STAGES = PER.reduce((n, d) => n + d.stages.length, 0); // 15

export const VARIANTS = [
  { key: "A", name: "礼物页一节 · 头像墙" },
  { key: "B", name: "跟着她走 · 对话页面板" },
  { key: "C", name: "统计页里 · 总表" },
];

/** 没解锁的阶段：all 门槛和奖励都写；next 只写下一个；none 只画空点、不写门槛。 */
export type Locked = "all" | "next" | "none";
/** 隐藏的角色：same 照常；last 排到最后、变淡；omit 不显示（合起来的照样算她）。 */
export type Hidden = "same" | "last" | "omit";

export type Per = Record<PerId, number>;
const ZERO: Per = { turns: 0, call: 0, gifts: 0, tier: 0 };

export type Unlock = { key: string; label: string; draws: number; card: boolean; characterId: string | null };

type State = {
  variant: string;
  locked: Locked;
  hidden: Hidden;
  per: Record<string, Per>;
  days: number;
  draws: number;
  /** 看过的解锁（`key`），没看过的标「新」。 */
  seen: string[];
  /** A：进礼物页时已经有的解锁；有不在这里的，「礼物」上一个点。 */
  navSeen: string[];
  /** 上线补算的结果，没关掉之前显示。 */
  backfill: { stages: number; draws: number; cards: number } | null;
  /** 刚解锁的（B 的页首、C 的提示条用）。 */
  latest: (Unlock & { at: number }) | null;
};

let state: State = {
  variant: "A",
  locked: "next",
  hidden: "same",
  per: {},
  days: 0,
  draws: 0,
  seen: [],
  navSeen: [],
  backfill: null,
  latest: null,
};
const listeners = new Set<() => void>();
let started = false;
let characterIds: string[] = [];

const SAVED = "prototype-achievements";

function set(change: Partial<State>) {
  state = { ...state, ...change };
  const { variant: _v, latest: _l, ...kept } = state;
  sessionStorage.setItem(SAVED, JSON.stringify(kept));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  if (!started && typeof window !== "undefined") {
    started = true;
    const v = new URLSearchParams(window.location.search).get("ac");
    if (v && VARIANTS.some((x) => x.key === v)) state = { ...state, variant: v };
    const saved = sessionStorage.getItem(SAVED);
    if (saved) state = { ...state, ...JSON.parse(saved) };
  }
  listeners.add(l);
  return () => listeners.delete(l);
}

const initial = state;
export function useAchievements(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}

export function setVariant(variant: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("ac", variant);
  window.history.replaceState(window.history.state, "", url);
  set({ variant });
}

export const setLocked = (locked: Locked) => set({ locked });
export const setHidden = (hidden: Hidden) => set({ hidden });

// ───────────────────────── 算 ─────────────────────────

export function perOf(s: Pick<State, "per">, id: string): Per {
  return s.per[id] ?? ZERO;
}

export function allValue(s: Pick<State, "per" | "days" | "draws">, id: AllId): number {
  const all = Object.values(s.per);
  if (id === "met") return all.filter((p) => p.turns > 0).length;
  if (id === "close") return all.filter((p) => p.tier >= 2).length;
  return id === "days" ? s.days : s.draws;
}

/** 到了第几阶段（0 是一个都没有）。 */
export function stageOf(def: Def<string>, value: number): number {
  return def.stages.filter((t) => value >= t).length;
}

export function perStages(p: Per): number {
  return PER.reduce((n, d) => n + stageOf(d, p[d.id]), 0);
}

export const isComplete = (p: Per) => perStages(p) === PER_STAGES;

export const perKey = (characterId: string, id: PerId, stage: number) => `${characterId}:${id}:${stage}`;
export const allKey = (id: AllId, stage: number) => `all:${id}:${stage}`;
export const cardKey = (characterId: string) => `${characterId}:card`;

/** 解锁了的所有阶段（和集齐的重置卡）。 */
function unlocks(s: Pick<State, "per" | "days" | "draws">, names: Record<string, string>): Unlock[] {
  const out: Unlock[] = [];
  for (const [id, p] of Object.entries(s.per)) {
    for (const d of PER)
      for (let n = 1; n <= stageOf(d, p[d.id]); n++)
        out.push({ key: perKey(id, d.id, n), label: `${names[id] ?? id} · ${d.name} 第 ${n} 阶段`, draws: n, card: false, characterId: id });
    if (isComplete(p)) out.push({ key: cardKey(id), label: `集齐${names[id] ?? id}`, draws: 0, card: true, characterId: id });
  }
  for (const d of ALL)
    for (let n = 1; n <= stageOf(d, allValue(s, d.id)); n++)
      out.push({ key: allKey(d.id, n), label: `${d.name} 第 ${n} 阶段`, draws: n, card: false, characterId: null });
  return out;
}

let names: Record<string, string> = {};
export function knowCharacters(list: { id: string; name: string }[]) {
  characterIds = list.map((c) => c.id);
  names = Object.fromEntries(list.map((c) => [c.id, c.name]));
}

export function bonusOf(s: State): { draws: number; cards: number } {
  const u = unlocks(s, names);
  return { draws: u.reduce((n, x) => n + x.draws, 0), cards: u.filter((x) => x.card).length };
}

export function unseenKeys(s: State): Set<string> {
  const seen = new Set(s.seen);
  return new Set(unlocks(s, names).map((u) => u.key).filter((k) => !seen.has(k)));
}

export function hasUnseen(s: State, characterId?: string): boolean {
  const keys = unseenKeys(s);
  if (characterId === undefined) return keys.size > 0;
  return [...keys].some((k) => k.startsWith(`${characterId}:`));
}

/** 看过了：不给参数是全部，给了是这一位（和 all: 开头的合起来的）。 */
export function markSeen(prefix?: string) {
  const keys = [...unseenKeys(state)].filter((k) => prefix === undefined || k.startsWith(prefix));
  if (keys.length) set({ seen: [...state.seen, ...keys] });
}

/** 推进以后，新解锁的取最后一个当「刚解锁」。 */
function advance(change: Partial<State>) {
  const before = new Set(unlocks(state, names).map((u) => u.key));
  const next = { ...state, ...change };
  const fresh = unlocks(next, names).filter((u) => !before.has(u.key));
  const latest = fresh.length ? { ...fresh[fresh.length - 1], at: Date.now() } : state.latest;
  if (fresh.length > 1) {
    const total = fresh.reduce((n, u) => n + u.draws, 0);
    latest!.draws = total;
    latest!.label = fresh.map((u) => u.label).join("、");
    latest!.card = fresh.some((u) => u.card);
  }
  set({ ...change, latest });
}

function bump(characterId: string, id: PerId, to: number) {
  const p = perOf(state, characterId);
  advance({ per: { ...state.per, [characterId]: { ...p, [id]: to } } });
}

/** 真发出的一个回合。 */
export function turn(characterId: string) {
  const p = perOf(state, characterId);
  bump(characterId, "turns", p.turns + 1);
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** 模拟：某一位（不给就随便一位）按角色的一个成就推到下一阶段。 */
export function unlockOne(characterId?: string) {
  const id = characterId ?? pick(characterIds);
  if (!id) return;
  const p = perOf(state, id);
  const open = PER.filter((d) => stageOf(d, p[d.id]) < d.stages.length);
  if (!open.length) return;
  const d = pick(open);
  bump(id, d.id, d.stages[stageOf(d, p[d.id])]);
}

/** 模拟：合起来的一个成就推到下一阶段（来访或抽奖）。 */
export function unlockAll() {
  const d = pick(ALL.filter((x) => (x.id === "days" || x.id === "draws") && stageOf(x, allValue(state, x.id)) < x.stages.length));
  if (!d) return;
  advance({ [d.id]: d.stages[stageOf(d, allValue(state, d.id))] });
}

/** 模拟：某一位差最后一个阶段就集齐，再推一下。 */
export function complete(characterId?: string) {
  const id = characterId ?? characterIds.find((c) => !isComplete(perOf(state, c))) ?? characterIds[0];
  if (!id) return;
  state = { ...state, per: { ...state.per, [id]: { turns: 2999, call: 1200, gifts: 100, tier: 2 } } };
  bump(id, "turns", 3000);
}

/** 模拟：用了两个月的活跃用户上线那天的补算（约 40 次抽奖），补出来的全算没看过。 */
export function backfill() {
  const fixture: [number, Per][] = [
    [0, { turns: 420, call: 95, gifts: 14, tier: 2 }],
    [1, { turns: 130, call: 40, gifts: 6, tier: 1 }],
    [2, { turns: 64, call: 12, gifts: 3, tier: 1 }],
    [3, { turns: 22, call: 0, gifts: 1, tier: 0 }],
    [5, { turns: 11, call: 0, gifts: 0, tier: 0 }],
    [8, { turns: 3, call: 0, gifts: 0, tier: 0 }],
  ];
  const per: Record<string, Per> = {};
  for (const [i, p] of fixture) if (characterIds[i]) per[characterIds[i]] = p;
  const next = { per, days: 46, draws: 0 };
  const u = unlocks(next, names);
  set({
    ...next,
    seen: [],
    navSeen: [],
    latest: null,
    backfill: { stages: u.filter((x) => !x.card).length, draws: u.reduce((n, x) => n + x.draws, 0), cards: u.filter((x) => x.card).length },
  });
}

export function navDot(s: State): boolean {
  const seen = new Set(s.navSeen);
  return unlocks(s, names).some((u) => !seen.has(u.key));
}

export function visitGifts() {
  if (navDot(state)) set({ navSeen: unlocks(state, names).map((u) => u.key) });
}

export const dismissBackfill = () => set({ backfill: null });
export const dismissLatest = () => set({ latest: null });

export function resetAll() {
  set({ per: {}, days: 0, draws: 0, seen: [], navSeen: [], backfill: null, latest: null });
}
