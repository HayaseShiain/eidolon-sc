"use client";

// PROTOTYPE（票 06「原型：页首的好感度标识和变化提示」）：只在 prototype/affinity-badge 分支，不进 main。
// 三种好感度标识和变化提示，挂在现有对话页上，用地址参数 ?variant=A|B|C 切换：
//   A 心形键：页首「…」旁边一个心形图标加档名的键，点开说明；变化时图标跳一下、带升降小箭头，历史里不留。
//   B 名字下的副行：名字下面一行小字写档位，点名字看说明；变化时在她那条回复后面插一行居中小字，历史里留着。
//   C 信号格：五档信号格（手机隐喻），点开说明；变化时她那条气泡的时间旁留一个小箭头，历史里留着。
// 好感度、冷却、通话都是假的，由右上角的原型面板驱动；不发任何请求。

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  ArrowDown,
  ArrowUp,
  Gift,
  Heart,
  HeartCrack,
  HeartOff,
  Hourglass,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
  type LucideIcon,
} from "lucide-react";

import { prototypeEnabled } from "@/components/app/PrototypeSwitcher";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Character } from "@/lib/api";
import type { Entry } from "@/lib/conversationLog";
import type { ShownCall } from "@/lib/liveConversation";

import type { AffinityCallCue } from "../CallLayer";
import { cn } from "@/lib/utils";

export const VARIANTS = [
  { key: "A", name: "心形键" },
  { key: "B", name: "名字下的副行" },
  { key: "C", name: "信号格" },
  { key: "D", name: "定稿组合：A 页首 + B 提示" },
];
export type Variant = "A" | "B" | "C" | "D";

export const TIERS = ["冷淡", "疏远", "信任", "亲近", "亲密"] as const;
export type Tier = (typeof TIERS)[number];

/** 一次变化：方向，有没有跨档，变化之后的档位；挂在她那条回复上（翻历史时 B、C 还看得到）。 */
export type Cue = { id: number; up: boolean; tierChanged: boolean; tier: Tier; cooldown: boolean; entryKey: string | null };

export type FakeCall = { collapsed: boolean; ended: null | "out_of_line" | "cooldown"; textOnly: boolean };

const TIER_NOTE: Record<Tier, string> = {
  冷淡: "她对你明显冷淡，话很少。",
  疏远: "她有点生气或失望，比平时冷一些。",
  信任: "你们一直以来的关系。",
  亲近: "她比平时更放松，更愿意和你说心里话。",
  亲密: "她非常信赖你，会说平时不轻易说的心事。",
};

const HEART: Record<Tier, LucideIcon> = { 冷淡: HeartOff, 疏远: HeartCrack, 信任: Heart, 亲近: Heart, 亲密: Heart };
const SIGNAL: Record<Tier, LucideIcon> = {
  冷淡: SignalZero,
  疏远: SignalLow,
  信任: SignalMedium,
  亲近: SignalHigh,
  亲密: Signal,
};

/** 解除时刻：原型里固定是现在往后 5 小时，按「今天 / 明天 HH:MM」写。 */
function untilText(until: Date): string {
  const now = new Date();
  const day = until.toDateString() === now.toDateString() ? "今天" : "明天";
  return `${day} ${until.getHours()}:${String(until.getMinutes()).padStart(2, "0")}`;
}

/** 变化提示的一句话：只说升或降，不说多少；跨档时说出新档位。 */
export function cueText(cue: Cue, name: string): string {
  if (cue.cooldown) return `${name}现在不想说话了`;
  if (cue.tierChanged) return cue.up ? `和${name}更近了一步：${cue.tier}` : `${name}和你疏远了一些：${cue.tier}`;
  return cue.up ? `${name}有点开心` : `${name}有点不高兴`;
}

export function useAffinityPrototype(entries: Entry[]) {
  const [variant, setVariantState] = useState<Variant>("D");
  const [tier, setTier] = useState<Tier>("信任");
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [history, setHistory] = useState<Record<string, Cue>>({});
  // 刚发生的那次变化，2.6 秒后消失（A 的跳动、B 的副行、通话层的提示用它）。
  const [liveCue, setLiveCue] = useState<Cue | null>(null);
  const [call, setCall] = useState<FakeCall | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("variant");
    // PROTOTYPE（票 15）：这条分支固定用定稿的 D，?variant= 不再切换。
    void v;
  }, []);
  const setVariant = useCallback((v: string) => {
    setVariantState(v as Variant);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", v);
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    if (!liveCue) return;
    const timer = setTimeout(() => setLiveCue(null), 2600);
    return () => clearTimeout(timer);
  }, [liveCue]);

  const lastReply = [...entries].reverse().find((e) => e.kind === "character")?.key ?? null;
  const change = (up: boolean, tierChanged: boolean, cooldown = false) => {
    const i = TIERS.indexOf(tier);
    const next = cooldown ? "冷淡" : tierChanged ? TIERS[Math.min(4, Math.max(0, i + (up ? 1 : -1)))] : tier;
    const cue: Cue = { id: nextId.current++, up, tierChanged: tierChanged && next !== tier, tier: next, cooldown, entryKey: lastReply };
    setTier(next);
    setLiveCue(cue);
    if (lastReply) setHistory((h) => ({ ...h, [lastReply]: cue }));
    if (cooldown) setCooldownUntil(new Date(Date.now() + 5 * 3600_000));
  };

  return {
    enabled: prototypeEnabled,
    variant,
    setVariant,
    tier,
    setTier,
    cooldownUntil,
    cooldownText: cooldownUntil ? untilText(cooldownUntil) : null,
    history,
    liveCue,
    call,
    setCall,
    change,
    endCooldown: () => setCooldownUntil(null),
    clearHistory: () => setHistory({}),
  };
}
export type AffinityPrototype = ReturnType<typeof useAffinityPrototype>;

/** 点开的说明：当前档位、五档的位置、怎么变；冷却时写明什么时候能再找她。A、B、C 共用。 */
function Explainer({ p, character }: { p: AffinityPrototype; character: Character }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">
          {p.cooldownUntil ? `${character.name}现在不想说话` : `你们现在的关系：${p.tier}`}
        </p>
        <p className="text-muted-foreground">
          {p.cooldownUntil
            ? `${p.cooldownText} 以后可以再找她。送她一件礼物，她会消气得快一些。`
            : TIER_NOTE[p.tier]}
        </p>
      </div>
      <ol className="flex gap-1" aria-label="五个档位">
        {TIERS.map((tier) => (
          <li
            key={tier}
            aria-current={tier === p.tier && !p.cooldownUntil ? "true" : undefined}
            className={cn(
              "flex-1 rounded-md py-1 text-center text-meta",
              tier === p.tier && !p.cooldownUntil ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
            )}
          >
            {tier}
          </li>
        ))}
      </ol>
      <p className="text-meta text-muted-foreground">
        她对你的态度会随你说的话变化。低于「信任」时，不联系也会慢慢回到「信任」。
      </p>
    </div>
  );
}

/** A、C 页首「…」旁边的标识；B 没有（它在名字下面）。 */
export function HeaderBadge({
  p,
  character,
  subtree,
  className,
}: {
  p: AffinityPrototype;
  character: Character;
  subtree: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  if (p.variant === "B") return null;
  const cue = p.liveCue;
  const cooling = p.cooldownUntil !== null;
  let face: ReactNode;
  if (p.variant === "A" || p.variant === "D") {
    const Icon = cooling ? Hourglass : HEART[p.tier];
    face = (
      <span className="relative flex items-center gap-1">
        <span className={cn("relative flex", cue && "motion-safe:animate-bounce")}>
          <Icon
            className={cn(
              "size-5",
              cooling ? "text-muted-foreground" : "text-her-mark",
              !cooling && p.tier === "亲密" && "fill-current",
            )}
          />
          {/* 亲近：同一个 Lucide Heart 叠一层实心的，只露下半 */}
          {!cooling && p.tier === "亲近" && (
            <Heart aria-hidden className="absolute inset-0 size-5 fill-current text-her-mark [clip-path:inset(50%_0_0_0)]" />
          )}
        </span>
        <span className={cn("text-sm", cooling && "text-muted-foreground")}>{cooling ? p.cooldownText : p.tier}</span>
        {cue && !cue.cooldown && <CueArrow up={cue.up} className="absolute -top-1.5 left-3" />}
      </span>
    );
  } else {
    const Icon = SIGNAL[cooling ? "冷淡" : p.tier];
    face = (
      <span className="relative flex items-center gap-1">
        <Icon className={cn("size-5", cooling && "text-muted-foreground opacity-50", cue && "motion-safe:animate-pulse")} />
        {cooling && <span className="text-meta text-muted-foreground tabular-nums">{p.cooldownText}</span>}
        {cue && !cue.cooldown && <CueArrow up={cue.up} className="absolute -top-1.5 -right-2" />}
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size={p.variant === "C" ? "icon-lg" : "lg"}
            className={cn(className, p.variant !== "C" && "px-2")}
            aria-label={cooling ? `${character.name}现在不想说话` : `你们的关系：${p.tier}`}
          />
        }
      >
        {face}
      </PopoverTrigger>
      <PopoverContent container={subtree} align="end">
        <Explainer p={p} character={character} />
      </PopoverContent>
    </Popover>
  );
}

function CueArrow({ up, className }: { up: boolean; className?: string }) {
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-3.5 items-center justify-center rounded-full",
        up ? "bg-her-button text-her-button-fg" : "bg-foreground text-background",
        className,
      )}
    >
      <Icon className="size-2.5" strokeWidth={3} />
    </span>
  );
}

/** B 的页首名字：两行，名字下面一行档位小字；刚变化时这一行先换成变化的那句话。点了看说明。 */
export function TitleWithTier({
  p,
  character,
  subtree,
}: {
  p: AffinityPrototype;
  character: Character;
  subtree: RefObject<HTMLDivElement | null>;
}) {
  const cue = p.liveCue;
  const line = cue ? cueText(cue, character.name) : p.cooldownUntil ? `${p.cooldownText} 以后可以再找她` : p.tier;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-0.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <h1 className="w-full truncate text-header leading-tight">{character.name}</h1>
        <span
          className={cn(
            "flex w-full items-center gap-1 truncate text-meta text-muted-foreground",
            cue && "text-foreground",
          )}
        >
          {cue && !cue.cooldown && (cue.up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
          {p.cooldownUntil && !cue && <Hourglass className="size-3" />}
          {line}
        </span>
      </PopoverTrigger>
      <PopoverContent container={subtree} align="start">
        <Explainer p={p} character={character} />
      </PopoverContent>
    </Popover>
  );
}

/** B：她那条回复后面一行居中小字，和日期条一个样子；翻历史时还在。 */
export function StreamCue({ cue, name }: { cue: Cue; name: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-meta text-muted-foreground">
      {cue.up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {cueText(cue, name)}
    </span>
  );
}

/** C：她那条气泡时间旁边一个小箭头；悬停或读屏读出变化。翻历史时还在。 */
export function BubbleMark({ cue, name }: { cue: Cue; name: string }) {
  return (
    <span title={cueText(cue, name)} aria-label={cueText(cue, name)} className="pb-0.5">
      <CueArrow up={cue.up} />
    </span>
  );
}

/** 通话层里的提示：A 在台词卡上方浮出一个小胶囊；B 换掉名字下面的状态行；C 是状态行旁的信号格。 */
export function callCues(p: AffinityPrototype, name: string): AffinityCallCue {
  const cue = p.liveCue;
  if (p.variant === "A") {
    return {
      aboveLine: cue ? (
        <span className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-sm backdrop-blur-md motion-safe:animate-in motion-safe:fade-in-0">
          {cue.cooldown ? <Hourglass className="size-4" /> : <Heart className={cn("size-4", cue.up && "fill-current")} />}
          {cue.cooldown ? cueText(cue, name) : cue.up ? "↑" : "↓"}
        </span>
      ) : undefined,
    };
  }
  if (p.variant === "B" || p.variant === "D") {
    return {
      statusReplace: cue ? (
        <p className="flex items-center justify-center gap-1 text-sm text-white">
          {!cue.cooldown && (cue.up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
          {cueText(cue, name)}
        </p>
      ) : undefined,
    };
  }
  const Icon = SIGNAL[p.tier];
  return {
    status: (
      <span className={cn("relative inline-flex", cue && "motion-safe:animate-pulse")} aria-label={`你们的关系：${p.tier}`}>
        <Icon className="size-4" />
        {cue && !cue.cooldown && (
          <span className="absolute -top-1 -right-2 text-meta">{cue.up ? "↑" : "↓"}</span>
        )}
      </span>
    ),
  };
}

/** 冷却中的输入栏：一行说明写明解除时刻，旁边「送她一件礼物」。三个变体共用（文案以「冷却和她自己挂断电话」为准）。 */
export function CooldownComposer({ p, character }: { p: AffinityPrototype; character: Character }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t bg-background px-4 py-3">
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        {character.name}现在不想说话。{p.cooldownText} 以后可以再找她
      </p>
      <Button variant="outline" onClick={() => alert("原型：跳到礼物页")}>
        <Gift />
        送她一件礼物
      </Button>
    </div>
  );
}

/** 假的通话状态：接通 1 分 23 秒，或者她挂断后的结束页。 */
export function fakeShownCall(call: FakeCall, cooldownText: string | null, name: string): ShownCall {
  if (call.ended) {
    return {
      phase: "ended",
      dial: 1,
      seconds: 83,
      end: {
        reason: call.ended,
        detail: call.ended === "cooldown" ? `她现在不想说话，${cooldownText ?? "明天 14:20"} 以后可以再找她。` : null,
        counts: true,
      },
    };
  }
  void name;
  return { phase: "connected", dial: 1, since: Date.now() - 83_000, maxSeconds: null };
}

export const FAKE_LINE = { ja: "プロデューサーさん、今日もお疲れさまです。", zh: "制作人，今天也辛苦了。" };

/** 右上角的原型面板：切档位、模拟变化、冷却、通话。明显不是设计的一部分。 */
export function PrototypePanel({ p }: { p: AffinityPrototype }) {
  const [open, setOpen] = useState(false);
  if (!p.enabled) return null;
  const btn = "rounded border border-white/30 px-2 py-1 text-left hover:bg-white/20 disabled:opacity-40";
  return (
    <>
      <div className="fixed bottom-16 left-2 z-[100] w-64 rounded-lg bg-black p-2 text-xs text-white shadow-lg ring-2 ring-yellow-400">
        <button type="button" className="w-full text-left font-semibold" onClick={() => setOpen(!open)}>
          原型面板 {open ? "▾" : "▸"}　档位：{p.tier}
          {p.cooldownUntil ? "（冷却中）" : ""}
        </button>
        {open && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">
              {TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={cn(btn, tier === p.tier && "bg-white text-black")}
                  onClick={() => p.setTier(tier)}
                >
                  {tier}
                </button>
              ))}
            </div>
            <p className="text-white/60">模拟这一回合的变化（挂在最后一条她的回复上）</p>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" className={btn} onClick={() => p.change(true, false)}>
                开心一点（同档）
              </button>
              <button type="button" className={btn} onClick={() => p.change(false, false)}>
                不高兴（同档）
              </button>
              <button type="button" className={btn} onClick={() => p.change(true, true)}>
                跨档上升
              </button>
              <button type="button" className={btn} onClick={() => p.change(false, true)}>
                跨档下降
              </button>
              <button type="button" className={btn} onClick={() => p.change(false, true, true)}>
                跌进冷却
              </button>
              <button type="button" className={btn} disabled={!p.cooldownUntil} onClick={p.endCooldown}>
                冷却解除
              </button>
            </div>
            <button type="button" className={btn} onClick={p.clearHistory}>
              清掉历史里的变化标记
            </button>
            <p className="text-white/60">通话层（假的，不发请求）</p>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                className={btn}
                onClick={() => p.setCall(p.call ? null : { collapsed: false, ended: null, textOnly: false })}
              >
                {p.call ? "关掉通话层" : "打开通话层"}
              </button>
              <button
                type="button"
                className={btn}
                disabled={!p.call || p.call.ended !== null}
                onClick={() => p.call && p.setCall({ ...p.call, collapsed: !p.call.collapsed })}
              >
                {p.call?.collapsed ? "展开" : "收起"}
              </button>
              <button
                type="button"
                className={btn}
                disabled={!p.call}
                onClick={() => p.call && p.setCall({ ...p.call, collapsed: false, ended: "out_of_line" })}
              >
                她挂断：不该说的话
              </button>
              <button
                type="button"
                className={btn}
                disabled={!p.call}
                onClick={() => {
                  if (!p.call) return;
                  p.change(false, true, true);
                  p.setCall({ ...p.call, collapsed: false, ended: "cooldown" });
                }}
              >
                她挂断：冷却
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
