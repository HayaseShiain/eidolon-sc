"use client";

// PROTOTYPE（票 15「原型：对话记录里的对话事件」）：只在 prototype/conversation-events 分支，不进 main。
// 对话事件（她挂断电话、送礼记录）在文字记录里的三种样子，挂在现有对话页上，用地址参数 ?ev=A|B|C 切换：
//   A 居中胶囊：和日期条、变化胶囊同一个样子，前面一个 Lucide 图标，后面带时间。
//   B 分隔线：整行一条细线，中间是图标、一句话和时间，像给记录分段。
//   C 谁做的放谁那边：送礼是制作人那一侧的小卡片（带礼物插画），挂断是她那一侧的一行虚线框。
// 好感度标识固定用票 06 定稿的 D。事件、列表的「最后一句」都是假的，由右下角的原型面板驱动；不发任何请求。

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowUp, Gift, PhoneOff } from "lucide-react";

import { MarkedAvatar } from "@/components/app/MarkedAvatar";
import { prototypeEnabled, PrototypeSwitcher } from "@/components/app/PrototypeSwitcher";
import type { Character } from "@/lib/api";
import { cn } from "@/lib/utils";

import type { AffinityPrototype, Tier } from "../prototype-affinity/AffinityPrototype";
import { TIERS } from "../prototype-affinity/AffinityPrototype";

export const EVENT_VARIANTS = [
  { key: "A", name: "居中胶囊" },
  { key: "B", name: "分隔线" },
  { key: "C", name: "谁做的放谁那边" },
];
export type EventVariant = "A" | "B" | "C";

const GIFTS = [
  { id: "pudding", name: "布丁" },
  { id: "cocoa", name: "热可可" },
  { id: "bouquet", name: "花束" },
  { id: "plush", name: "毛绒玩偶" },
] as const;
type GiftArt = (typeof GIFTS)[number];

/** 送礼记录后面的变化胶囊：同档开心、跨档、冷却中送礼直接解除；没有就是 null（冷却中没解除、到顶）。 */
type GiftCue = { kind: "happy" } | { kind: "closer"; tier: Tier } | { kind: "lifted" } | null;

export type FakeEvent = {
  id: number;
  kind: "gift" | "hangup";
  gift?: GiftArt;
  cue?: GiftCue;
  at: Date;
  /** 跟在哪条消息后面；null 表示放在最前（只有送礼记录的对话）。 */
  afterKey: string | null;
  /** 她在通话里挂断：通话层还开着时先不显示（面板上的「通话层开着时先不出现」）。 */
  heldByCall?: boolean;
};

/** 列表里「最后一句」遇到对话事件时：A 原文，B 图标加原文，C 跳过事件、只看说过的话（只有事件时才用原文）。 */
export type ListMode = "text" | "icon" | "skip";

type State = {
  variant: EventVariant;
  events: Record<string, FakeEvent[]>;
  onlyEvents: Record<string, boolean>;
  listMode: ListMode;
  holdWhileCall: boolean;
};

// ---- 一个很小的外部 store：对话页和列表都要读 ----

let state: State = { variant: "A", events: {}, onlyEvents: {}, listMode: "text", holdWhileCall: false };
const listeners = new Set<() => void>();
let nextId = 1;
let read = false;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  if (!read && typeof window !== "undefined") {
    read = true;
    const v = new URLSearchParams(window.location.search).get("ev");
    if (v === "A" || v === "B" || v === "C") queueMicrotask(() => set({ variant: v }));
  }
  return () => listeners.delete(l);
}
const snapshot = () => state;

export function useEvents() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

function setVariant(v: string) {
  set({ variant: v as EventVariant });
  const url = new URL(window.location.href);
  url.searchParams.set("ev", v);
  window.history.replaceState(null, "", url);
}

function add(characterId: string, event: Omit<FakeEvent, "id">) {
  const list = state.events[characterId] ?? [];
  set({ events: { ...state.events, [characterId]: [...list, { ...event, id: nextId++ }] } });
}

/** 这位角色在对话页上看得到的事件。 */
export function shownEvents(s: State, characterId: string, callOpen: boolean): FakeEvent[] {
  return (s.events[characterId] ?? []).filter((e) => !(e.heldByCall && callOpen));
}

// ---- 文字 ----

const hhmm = (at: Date) => `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`;

export function eventText(e: FakeEvent, name: string): string {
  return e.kind === "gift" ? `你送给${name}一份${e.gift!.name}` : `${name}挂断了电话`;
}

function cueText(cue: NonNullable<GiftCue>, name: string): string {
  if (cue.kind === "happy") return `${name}有点开心`;
  if (cue.kind === "closer") return `和${name}更近了一步：${cue.tier}`;
  return `${name}愿意和你说话了`;
}

const EventIcon = ({ e, className }: { e: FakeEvent; className?: string }) =>
  e.kind === "gift" ? <Gift aria-hidden className={className} /> : <PhoneOff aria-hidden className={className} />;

// ---- 对话记录里的样子 ----

/** 一条事件，连同它后面的变化胶囊（只有送礼记录会有）。 */
export function EventLine({ e, variant, character }: { e: FakeEvent; variant: EventVariant; character: Character }) {
  const name = character.name;
  let body: ReactNode;
  if (variant === "A") {
    body = (
      <div className="my-2 flex justify-center">
        <span className="flex max-w-full items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1 text-meta text-muted-foreground">
          <EventIcon e={e} className="size-3 shrink-0" />
          <span className="truncate">{eventText(e, name)}</span>
          <time className="shrink-0 tabular-nums opacity-80">{hhmm(e.at)}</time>
        </span>
      </div>
    );
  } else if (variant === "B") {
    body = (
      <div className="my-3 flex items-center gap-3 px-2 text-sm text-muted-foreground" role="note">
        <span aria-hidden className="h-px flex-1 bg-foreground/15" />
        <span className="flex shrink-0 items-center gap-1.5">
          <EventIcon e={e} className="size-4" />
          {eventText(e, name)}
          <time className="text-meta tabular-nums">{hhmm(e.at)}</time>
        </span>
        <span aria-hidden className="h-px flex-1 bg-foreground/15" />
      </div>
    );
  } else if (e.kind === "gift") {
    // C：制作人那一侧，和他的气泡同一边、同一宽度上限；小卡片带礼物插画。
    body = (
      <div className="mt-2 flex items-end justify-end gap-1.5">
        <time className="shrink-0 pb-0.5 text-meta text-muted-foreground tabular-nums">{hhmm(e.at)}</time>
        <div className="flex max-w-[72%] items-center gap-3 rounded-2xl border bg-background py-2 pr-4 pl-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/gifts/proto/flat/${e.gift!.id}.webp`} alt="" className="size-12 shrink-0 rounded-xl bg-muted object-cover" />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1 text-meta text-muted-foreground">
              <Gift aria-hidden className="size-3" />
              礼物
            </span>
            <span className="text-body">{eventText(e, name)}</span>
          </span>
        </div>
      </div>
    );
  } else {
    // C：她那一侧，头像列对齐（像她的一组的第一条），虚线框里一行字。
    body = (
      <div className="mt-2 flex items-end gap-2">
        <MarkedAvatar name={name} src={character.avatar_url} size="bubble" />
        <span className="flex items-center gap-1.5 rounded-2xl border border-dashed border-foreground/25 px-3 py-2 text-sm text-muted-foreground">
          <PhoneOff aria-hidden className="size-4" />
          {eventText(e, name)}
        </span>
        <time className="shrink-0 pb-0.5 text-meta text-muted-foreground tabular-nums">{hhmm(e.at)}</time>
      </div>
    );
  }
  return (
    <>
      {body}
      {e.cue && (
        <div className="my-2 flex justify-center">
          <span className="flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-meta text-muted-foreground">
            <ArrowUp className="size-3" />
            {cueText(e.cue, name)}
          </span>
        </div>
      )}
    </>
  );
}

// ---- 对话列表的「最后一句」 ----

/** 列表这一行要不要换掉描述：返回描述（和图标）、时间；null 表示照常用最后一条消息。 */
export function useListEvent(character: { id: string; name: string }): { text: string; icon: ReactNode; at: Date } | null {
  const s = useEvents();
  const events = s.events[character.id] ?? [];
  const last = events.at(-1);
  if (!last) return null;
  const only = s.onlyEvents[character.id];
  if (s.listMode === "skip" && !only) return null;
  return {
    text: eventText(last, character.name),
    icon: s.listMode === "icon" ? <EventIcon e={last} className="size-3.5 shrink-0" /> : null,
    at: last.at,
  };
}

// ---- 原型面板（右下角） ----

export function EventsPanel({
  p,
  character,
  lastKey,
}: {
  p: AffinityPrototype;
  character: Character;
  lastKey: string | null;
}) {
  const s = useEvents();
  const [open, setOpen] = useState(true);
  if (!prototypeEnabled) return null;
  const id = character.id;
  const only = !!s.onlyEvents[id];
  const after = only ? null : lastKey;
  const cooling = p.cooldownUntil !== null;
  const pick = () => GIFTS[(s.events[id]?.length ?? 0) % GIFTS.length];
  const gift = (cue: GiftCue, g: GiftArt = pick()) => add(id, { kind: "gift", gift: g, cue, at: new Date(), afterKey: after });
  const closer = () => {
    const next = TIERS[Math.min(4, TIERS.indexOf(p.tier) + 1)];
    p.setTier(next);
    gift({ kind: "closer", tier: next });
  };
  const hangUp = (reason: "out_of_line" | "cooldown") => {
    if (reason === "cooldown") p.change(false, true, true);
    add(id, { kind: "hangup", at: new Date(), afterKey: after, heldByCall: s.holdWhileCall });
    p.setCall({ collapsed: false, ended: reason, textOnly: false });
  };
  const btn = "rounded border border-white/30 px-2 py-1 text-left hover:bg-white/20 disabled:opacity-40";
  const on = "bg-white text-black";
  return (
    <>
      <div className="fixed right-2 bottom-16 z-[100] flex w-72 flex-col gap-2 rounded-lg bg-black p-2 text-xs text-white shadow-lg ring-2 ring-sky-400">
        <button type="button" className="text-left font-semibold" onClick={() => setOpen(!open)}>
          对话事件原型（{s.variant}） {open ? "▾" : "▸"}
        </button>
        {open && (
          <>
        <p className="text-white/60">送礼（记在最后一条消息后面）</p>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" className={btn} disabled={cooling} onClick={() => gift({ kind: "happy" })}>
            送一件：同档开心
          </button>
          <button type="button" className={btn} disabled={cooling} onClick={closer}>
            送一件：跨档
          </button>
          <button type="button" className={btn} disabled={cooling} onClick={() => gift(null)}>
            送一件：到顶，无胶囊
          </button>
          <button
            type="button"
            className={btn}
            disabled={cooling}
            onClick={() => {
              gift({ kind: "happy" }, GIFTS[0]);
              gift({ kind: "happy" }, GIFTS[1]);
              gift({ kind: "closer", tier: TIERS[Math.min(4, TIERS.indexOf(p.tier) + 1)] }, GIFTS[2]);
            }}
          >
            连送三件
          </button>
          <button type="button" className={btn} disabled={!cooling} onClick={() => gift(null)}>
            冷却中送：没解除
          </button>
          <button
            type="button"
            className={btn}
            disabled={!cooling}
            onClick={() => {
              gift({ kind: "lifted" });
              p.endCooldown();
            }}
          >
            冷却中送：解除
          </button>
        </div>
        <p className="text-white/60">她挂断电话（打开假通话层的结束卡，同时记一条事件）</p>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" className={btn} onClick={() => hangUp("out_of_line")}>
            挂断：不该说的话
          </button>
          <button type="button" className={btn} onClick={() => hangUp("cooldown")}>
            挂断：跌进冷却
          </button>
        </div>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={s.holdWhileCall} onChange={(e) => set({ holdWhileCall: e.target.checked })} />
          通话层开着时先不出现，关掉结束卡后才出现
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={only}
            onChange={(e) =>
              set({
                onlyEvents: { ...s.onlyEvents, [id]: e.target.checked },
                events: { ...s.events, [id]: [] },
              })
            }
          />
          这段对话只有送礼记录（新建的那段）
        </label>
        <p className="text-white/60">列表里的「最后一句」</p>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ["text", "原文"],
              ["icon", "图标＋原文"],
              ["skip", "跳过事件"],
            ] as const
          ).map(([mode, label]) => (
            <button key={mode} type="button" className={cn(btn, s.listMode === mode && on)} onClick={() => set({ listMode: mode })}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className={btn} onClick={() => set({ events: { ...s.events, [id]: [] } })}>
          清掉这位的事件
        </button>
          </>
        )}
      </div>
      <PrototypeSwitcher variants={EVENT_VARIANTS} current={s.variant} onChange={setVariant} />
    </>
  );
}
