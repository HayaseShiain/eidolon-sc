"use client";

// PROTOTYPE（proactive-messages 票 06「原型：用户怎么看到」）：只在 prototype/proactive-messages 分支，不进 main。
// 三个变体用 ?rv=A|B|C（或底部切换条、← →）切换，记在这台设备上，换页不丢：
// - A「未读数」：列表行最后一句右边一颗她颜色的未读数胶囊（DESIGN.md 早就留了这个位置）；开着网站时那一行悄悄更新、
//   排到上面，没有别的提示；对话里搭话和平常的回复一样，同一天里跟她上一条回复并成一组。
// - B「提示」：列表行的名字和最后一句加深（不出数字），导航的「对话」图标右上角一个小点；不在她的对话页时，
//   内容区底部冒一条礼物页那种反色提示（她的头像、她说的话、「去对话」），8 秒后收起；对话里搭话另起一组。
// - C「对话里标出来」：列表行时间旁一个她颜色的小圆点；没有提示；打开对话时，没看过的搭话上面一条「新消息」分隔线，
//   这一页开着时一直在，下次打开就没了；搭话另起一组。
// 右下角原型面板：让一位角色现在（或几秒后，好先走开）搭话、全部看过、清空；用户的开关；开关放在哪（单独一类或档案页）。
// 假搭话只在内存里，刷新就没了。构建时带 NEXT_PUBLIC_PROTOTYPE=1 才显示面板和切换条。

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { prototypeEnabled } from "@/components/app/PrototypeSwitcher";
import { MarkedAvatar } from "@/components/app/MarkedAvatar";
import { Button } from "@/components/ui/button";
import type { Character, LatestConversation, Segment } from "@/lib/api";
import type { Entry } from "@/lib/conversationLog";
import type { Line } from "@/lib/messageLines";
import { herVars } from "@/theme/herVars";

import { useDirectory } from "../ConversationDirectory";

export type Variant = "A" | "B" | "C";
export const VARIANTS: { key: Variant; name: string }[] = [
  { key: "A", name: "未读数" },
  { key: "B", name: "提示" },
  { key: "C", name: "对话里标出来" },
];

/** 开关放在哪：设置里单独一类「搭话」，或档案页表单下面单独一块。 */
export type ToggleAt = "category" | "profile";

/** `isReply`：不是搭话，是造出来的、她 3 小时前的一条普通回复，好在同一天里看搭话和它并不并成一组。 */
type FakeReachOut = { key: string; characterId: string; at: string; segments: Segment[]; seen: boolean; isReply?: boolean };
type Toast = { key: number; characterId: string; text: string };

type State = {
  variant: Variant;
  toggleAt: ToggleAt;
  enabled: boolean;
  reachOuts: FakeReachOut[];
  toast: Toast | null;
  /** C 的「新消息」分隔线：打开她的对话页那一刻第一条没看过的搭话，这一页开着时留着。 */
  dividerAt: Record<string, string>;
  /** 几秒后到的搭话，还在等的条数。 */
  waiting: number;
};

const LINES: Segment[][] = [
  [
    { ja: "プロデューサーさん、この前話してた映画、観てきました！", zh: "制作人，上次说的那部电影，我去看了！" },
    { ja: "感想、聞いてくれますか？", zh: "想听听我的感想吗？" },
  ],
  [{ ja: "今日はちょっと寒いですね。ちゃんと上着、持って出かけましたか？", zh: "今天有点冷呢。出门有好好带外套吗？" }],
  [
    { ja: "……最近、ちょっと忙しそうですね", zh: "……最近好像有点忙呢" },
    { ja: "少しだけ、声が聞きたくなっちゃいました", zh: "突然有点想听听你的声音了" },
  ],
];

const STORAGE = "PROTOTYPE-reach-outs";

function initial(): State {
  const base: State = {
    variant: "A",
    toggleAt: "category",
    enabled: true,
    reachOuts: [],
    toast: null,
    dividerAt: {},
    waiting: 0,
  };
  if (typeof window === "undefined") return base;
  try {
    Object.assign(base, JSON.parse(localStorage.getItem(STORAGE) ?? "{}"));
  } catch {}
  const v = new URLSearchParams(window.location.search).get("rv");
  if (v === "A" || v === "B" || v === "C") base.variant = v;
  return base;
}

let state: State | null = null;
const listeners = new Set<() => void>();
const SERVER: State = {
  variant: "A",
  toggleAt: "category",
  enabled: true,
  reachOuts: [],
  toast: null,
  dividerAt: {},
  waiting: 0,
};

function get(): State {
  if (state === null) state = initial();
  return state;
}

function set(change: Partial<State>) {
  state = { ...get(), ...change };
  const { variant, toggleAt, enabled } = state;
  localStorage.setItem(STORAGE, JSON.stringify({ variant, toggleAt, enabled }));
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReachOuts(): State {
  return useSyncExternalStore(subscribe, get, () => SERVER);
}

export function setVariant(v: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("rv", v);
  window.history.replaceState(window.history.state, "", url);
  set({ variant: v as Variant, toast: null });
}

let counter = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** 她搭话：几秒后到。到的时候正开着她的对话页就算看过。 */
function reachOut(characterId: string, delaySeconds: number) {
  set({ waiting: get().waiting + 1 });
  setTimeout(() => {
    const segments = LINES[counter++ % LINES.length];
    const key = `proto-reach-out-${Date.now()}`;
    const onHerPage = window.location.pathname === `/conversation/${characterId}`;
    const s = get();
    const toast =
      s.variant === "B" && !onHerPage
        ? { key: Date.now(), characterId, text: segments.map((x) => x.zh).join(" ") }
        : s.toast;
    set({
      waiting: s.waiting - 1,
      reachOuts: [...s.reachOuts, { key, characterId, at: new Date().toISOString(), segments, seen: onHerPage }],
      toast,
    });
    if (toast !== s.toast) {
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => set({ toast: null }), 8000);
    }
  }, delaySeconds * 1000);
}

/** 造一条她 3 小时前的普通回复（不算搭话、算看过）。 */
function fakeReply(characterId: string) {
  const s = get();
  const at = new Date(Date.now() - 3 * 3600_000).toISOString();
  const segments = [{ ja: "はい、わかりました。また明日、ですね", zh: "嗯，知道了。那明天见" }];
  set({ reachOuts: [...s.reachOuts, { key: `proto-reply-${Date.now()}`, characterId, at, segments, seen: true, isReply: true }] });
}

function unseenOf(s: State, characterId: string): number {
  return s.reachOuts.filter((r) => r.characterId === characterId && !r.seen).length;
}

// ---- 对话列表 ----

/** 有假搭话的角色，列表最后一句换成最后一次搭话（比真记录新的时候），她也跟着排上去。 */
export function useFakeLatest(latest: Record<string, LatestConversation>): Record<string, LatestConversation> {
  const s = useReachOuts();
  if (s.reachOuts.length === 0) return latest;
  const out = { ...latest };
  for (const r of s.reachOuts) {
    const real = out[r.characterId];
    if (!real) continue;
    const realAt = real.last_message?.created_at ?? real.created_at;
    if (Date.parse(realAt) > Date.parse(r.at)) continue;
    out[r.characterId] = {
      ...real,
      last_message: {
        role: "character",
        text: null,
        ja: r.segments.map((x) => x.ja).join(""),
        zh: r.segments.map((x) => x.zh).join(""),
        created_at: r.at,
      },
    };
  }
  return out;
}

/** 这一行要不要加深（B）。 */
export function useRowEmphasis(characterId: string): boolean {
  const s = useReachOuts();
  return s.variant === "B" && unseenOf(s, characterId) > 0;
}

/** 列表行上的记号：A 未读数胶囊（最后一句那一行的右边），C 她颜色的小圆点（时间旁边）。 */
export function RowMark({ character, where }: { character: Character; where: "time" | "preview" }) {
  const s = useReachOuts();
  const n = unseenOf(s, character.id);
  if (n === 0) return null;
  if (s.variant === "A" && where === "preview") {
    return (
      <span
        style={herVars(character.color)}
        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-her-button px-1.5 text-meta text-her-button-fg tabular-nums"
      >
        {n}
      </span>
    );
  }
  if (s.variant === "C" && where === "time") {
    return <span style={herVars(character.color)} className="size-2 shrink-0 rounded-full bg-her-mark" />;
  }
  return null;
}

// ---- 导航 ----

/** B：导航「对话」图标右上角的小点，和公告铃铛的点一样（6px、前景色）。 */
export function NavDot() {
  const s = useReachOuts();
  if (s.variant !== "B" || !s.reachOuts.some((r) => !r.seen)) return null;
  return <span className="absolute top-1 right-2.5 size-1.5 rounded-full bg-foreground" />;
}

// ---- 对话页 ----

/** 打开她的对话页（和开着时新到的）就算看过；C 记下打开那一刻第一条没看过的，画分隔线。离开时去掉分隔线。 */
export function useSeenOnOpen(characterId: string) {
  const s = useReachOuts();
  const unseen = s.reachOuts.filter((r) => r.characterId === characterId && !r.seen);
  useEffect(() => {
    if (unseen.length === 0) return;
    const dividerAt = s.dividerAt[characterId] ? s.dividerAt : { ...s.dividerAt, [characterId]: unseen[0].key };
    set({
      reachOuts: get().reachOuts.map((r) => (r.characterId === characterId ? { ...r, seen: true } : r)),
      dividerAt,
    });
  });
  useEffect(
    () => () => {
      const { [characterId]: _, ...rest } = get().dividerAt;
      set({ dividerAt: rest });
    },
    [characterId],
  );
}

/** 假搭话按时间插进真记录里。 */
export function withFakeReachOuts(entries: Entry[], characterId: string, s: State): Entry[] {
  const fakes: Entry[] = s.reachOuts
    .filter((r) => r.characterId === characterId)
    .map((r) => ({
      kind: "character",
      key: r.key,
      segments: r.segments,
      pending: false,
      at: r.at,
      affinity: null,
      photo: null,
    }));
  if (fakes.length === 0) return entries;
  const out: Entry[] = [];
  let i = 0;
  for (const e of entries) {
    while (i < fakes.length && Date.parse(fakes[i].at) < Date.parse(e.at)) out.push(fakes[i++]);
    out.push(e);
  }
  return [...out, ...fakes.slice(i)];
}

/** B、C：搭话另起一组（头像、名字重来，她上一条回复留着自己的时间）。 */
export function splitReachOuts(lines: Line[], s: State): Line[] {
  if (s.variant === "A") return lines;
  const keys = new Set(s.reachOuts.filter((r) => !r.isReply).map((r) => r.key));
  return lines.map((line, i) => {
    if (line.kind !== "entry") return line;
    if (keys.has(line.entry.key)) return { ...line, first: true };
    const next = lines[i + 1];
    if (next?.kind === "entry" && keys.has(next.entry.key)) return { ...line, last: true };
    return line;
  });
}

/** C：这一条前面画「新消息」分隔线吗。 */
export function isDividerBefore(key: string, characterId: string, s: State): boolean {
  return s.variant === "C" && s.dividerAt[characterId] === key;
}

/** C 的「新消息」分隔线：和对话事件的分隔线一个样子，没有图标和时间。 */
export function NewDivider() {
  return (
    <div role="note" className="flex items-center gap-3 px-2 text-sm text-muted-foreground">
      <span aria-hidden className="h-px flex-1 bg-foreground/15" />
      <span className="shrink-0">新消息</span>
      <span aria-hidden className="h-px flex-1 bg-foreground/15" />
    </div>
  );
}

// ---- 外壳：B 的提示、原型面板 ----

/** B：不在她的对话页时内容区底部的提示（礼物页送出后那一种）。 */
export function ReachOutToast() {
  const s = useReachOuts();
  const { characters, go } = useDirectory();
  const pathname = usePathname();
  const toast = s.toast;
  const character = toast && characters?.find((c) => c.id === toast.characterId);
  const shown = toast && character && pathname !== `/conversation/${toast.characterId}`;
  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
      {shown && (
        <div
          key={toast.key}
          className="pointer-events-auto flex max-w-md min-w-0 items-center gap-3 rounded-full bg-foreground py-1.5 pr-1.5 pl-2 text-sm text-background shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        >
          <MarkedAvatar name={character.name} src={character.avatar_url} size="sm" />
          <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
            {character.name}：{toast.text}
          </span>
          <Button
            size="sm"
            variant="toast"
            onClick={() => {
              set({ toast: null });
              go(`/conversation/${toast.characterId}`);
            }}
          >
            去对话
          </Button>
        </div>
      )}
    </div>
  );
}

/** 用户的开关：设置里那一个 Switch 读写这里。 */
export function useReachOutsEnabled(): [boolean, (on: boolean) => void] {
  const s = useReachOuts();
  return [s.enabled, (enabled) => set({ enabled })];
}

export function setToggleAt(toggleAt: ToggleAt) {
  set({ toggleAt });
}

/** 右下角的原型面板（不是设计的一部分）。 */
export function ReachOutsPanel() {
  const s = useReachOuts();
  const { characters, latest } = useDirectory();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  // 手机上默认收起，免得挡住列表。
  useEffect(() => {
    if (window.innerWidth < 768) setOpen(false);
  }, []);
  const [picked, setPicked] = useState("");
  const onPage = /^\/conversation\/([^/]+)$/.exec(pathname)?.[1] ?? "";
  // 只有聊过的角色才会搭话（当前对话里要有回合）。
  const talked = (characters ?? []).filter((c) => latest[c.id]?.last_message);
  const who = picked || onPage || talked[0]?.id || "";
  if (!prototypeEnabled) return null;
  const btn = "rounded bg-white/15 px-2 py-1 hover:bg-white/25 disabled:opacity-40";
  return (
    <div className="fixed right-3 bottom-3 z-[100] w-72 max-md:bottom-16 rounded-lg bg-black p-3 text-xs text-white shadow-lg ring-2 ring-yellow-400">
      <button type="button" className="flex w-full justify-between font-semibold" onClick={() => setOpen(!open)}>
        <span>原型面板：搭话</span>
        <span>{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2">
            谁
            <select
              className="min-w-0 flex-1 rounded bg-white/15 px-1 py-1"
              value={who}
              onChange={(e) => setPicked(e.target.value)}
            >
              {talked.map((c) => (
                <option key={c.id} value={c.id} className="text-black">
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1">
            <span className="py-1">她搭话：</span>
            {[0, 5, 15].map((d) => (
              <button key={d} type="button" className={btn} disabled={!who || !s.enabled} onClick={() => reachOut(who, d)}>
                {d === 0 ? "现在" : `${d} 秒后`}
              </button>
            ))}
          </div>
          {!s.enabled && <p className="text-yellow-300">用户的开关关着，她不搭话。</p>}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={btn}
              onClick={() => set({ reachOuts: get().reachOuts.map((r) => ({ ...r, seen: true })) })}
            >
              全部看过
            </button>
            <button type="button" className={btn} disabled={!who} onClick={() => fakeReply(who)}>
              先造一条她 3 小时前的回复
            </button>
            <button type="button" className={btn} onClick={() => set({ reachOuts: [], toast: null, dividerAt: {} })}>
              清空
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span>开关在：</span>
            {(
              [
                ["category", "单独一类"],
                ["profile", "档案页"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`${btn} ${s.toggleAt === k ? "ring-1 ring-yellow-400" : ""}`}
                onClick={() => setToggleAt(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <pre className="max-h-40 overflow-auto rounded bg-white/10 p-1.5 text-[10px] leading-snug whitespace-pre-wrap">
            {[
              `变体 ${s.variant}，用户开关：${s.enabled ? "开" : "关"}`,
              s.waiting ? `还有 ${s.waiting} 条在路上` : "",
              ...s.reachOuts.map((r) => {
                const name = characters?.find((c) => c.id === r.characterId)?.name ?? r.characterId;
                const what = r.isReply ? "回复" : r.seen ? "搭话 看过" : "搭话 没看过";
                return `${name} ${new Date(r.at).toLocaleTimeString()} ${what}`;
              }),
            ]
              .filter(Boolean)
              .join("\n") || "还没有假搭话"}
          </pre>
        </div>
      )}
    </div>
  );
}
