"use client";

// PROTOTYPE（票 14「原型：礼物页」）：只在 prototype/gifts-page 分支，不进 main。
// 礼物页三个变体共用的假数据和小部件：礼物目录（票 09）、抽奖（票 10）、送礼的加分（票 01、09、11）、重置卡（票 07）。
// 什么都不发请求；角色是真的（DirectoryProvider），好感度、背包、次数全在内存里，由左下角的原型面板驱动。

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { MarkedAvatar } from "@/components/app/MarkedAvatar";
import { useDirectory } from "@/components/conversations/ConversationDirectory";
import type { Character } from "@/lib/api";
import { cn } from "@/lib/utils";
import { herVars } from "@/theme/herVars";
import {
  CooldownIcon,
  DrinkIcon,
  FlowerIcon,
  FoodIcon,
  ForwardIcon,
  HeartCrackIcon,
  HeartIcon,
  HeartOffIcon,
  ResetCardIcon,
  TrinketIcon,
} from "@/theme/icons";

// ---- 礼物目录（票 09 定的 19 件） ----

export type Category = "吃的" | "饮品" | "花草" | "小物件";
export type Rarity = "普通" | "少见" | "稀有";
export type Gift = { id: string; name: string; category: Category; rarity: Rarity; art?: string };

export const CATEGORIES: Category[] = ["吃的", "饮品", "花草", "小物件"];

export const CATALOG: Gift[] = [
  { id: "cake", name: "蛋糕", category: "吃的", rarity: "普通" },
  { id: "icecream", name: "冰淇淋", category: "吃的", rarity: "普通" },
  { id: "pudding", name: "布丁", category: "吃的", rarity: "普通", art: "pudding" },
  { id: "chocolate", name: "巧克力", category: "吃的", rarity: "普通" },
  { id: "candy", name: "糖果", category: "吃的", rarity: "普通" },
  { id: "nikuman", name: "肉包", category: "吃的", rarity: "普通" },
  { id: "wagashi", name: "和果子", category: "吃的", rarity: "少见" },
  { id: "tea", name: "红茶", category: "饮品", rarity: "普通" },
  { id: "coffee", name: "咖啡", category: "饮品", rarity: "普通" },
  { id: "milktea", name: "奶茶", category: "饮品", rarity: "普通" },
  { id: "cocoa", name: "热可可", category: "饮品", rarity: "少见", art: "cocoa" },
  { id: "honey", name: "蜂蜜热饮", category: "饮品", rarity: "少见" },
  { id: "bouquet", name: "花束", category: "花草", rarity: "少见", art: "bouquet" },
  { id: "bonsai", name: "盆栽", category: "花草", rarity: "少见" },
  { id: "preserved", name: "永生花", category: "花草", rarity: "稀有" },
  { id: "book", name: "书", category: "小物件", rarity: "少见" },
  { id: "cd", name: "音乐 CD", category: "小物件", rarity: "少见" },
  { id: "plush", name: "毛绒玩偶", category: "小物件", rarity: "稀有", art: "plush" },
  { id: "jewelry", name: "首饰", category: "小物件", rarity: "稀有" },
];
export const giftOf = (id: string) => CATALOG.find((g) => g.id === id)!;

const BONUS: Record<Rarity, number> = { 普通: 3, 少见: 5, 稀有: 7 };

// ---- 好感度（票 01：0–100，五档，正常值 50；冷却从 0 起，回到 10 解除，低于 50 时每天 +10） ----

export type Tier = "冷淡" | "疏远" | "信任" | "亲近" | "亲密";
export const tierOf = (v: number): Tier => (v < 20 ? "冷淡" : v < 40 ? "疏远" : v < 65 ? "信任" : v < 85 ? "亲近" : "亲密");
const NORMAL = 50;

/** 「今天 18:05」「明天 9:30」。 */
export function clockText(at: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = at.toDateString() === now.toDateString() ? "今天" : at.toDateString() === tomorrow.toDateString() ? "明天" : `${at.getMonth() + 1} 月 ${at.getDate()} 日`;
  return `${day} ${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`;
}

/** 冷却中的解除时刻：每天 +10、按小时均匀，回到 10 解除。 */
const cooldownEnds = (v: number) => new Date(Date.now() + ((10 - v) / 10) * 24 * 3600_000);

// ---- 原型的全部状态 ----

export type Look = "flat" | "watercolor" | "soft3d";
export const LOOKS: { key: Look; name: string }[] = [
  { key: "flat", name: "柔和平涂" },
  { key: "watercolor", name: "水彩" },
  { key: "soft3d", name: "软 3D" },
];
export type Forced = "随机" | Rarity | "重置卡";

type State = {
  draws: number;
  inventory: Record<string, number>;
  resetCards: number;
  values: Record<string, number>;
  cooling: Record<string, boolean>;
  look: Look;
  inCall: boolean;
  /** 从对话页跳过来时预先选好的她（地址里的 ?to=）。 */
  to: string | null;
  forced: Forced;
  judgeOff: boolean;
};

const SOME: Record<string, number> = { pudding: 2, cocoa: 1, bouquet: 1, tea: 3, candy: 1, plush: 1, book: 1 };
const MANY: Record<string, number> = Object.fromEntries(CATALOG.map((g, i) => [g.id, 1 + (i % 4)]));

/** 前几位角色摆成不同的档位，好看出差别：亲近、冷却中、疏远、亲密、信任但还没回到 50；其余都在 50。 */
function initialValues(characters: Character[]): { values: Record<string, number>; cooling: Record<string, boolean> } {
  const preset = [70, 0, 30, 90, 45];
  const values: Record<string, number> = {};
  const cooling: Record<string, boolean> = {};
  characters.forEach((c, i) => {
    values[c.id] = preset[i] ?? NORMAL;
    if (i === 1) cooling[c.id] = true;
  });
  return { values, cooling };
}

/** 她喜欢的礼物：假的，按位置凑一个；页面上不显示（送礼记录也不标，票 11），只影响加多少。 */
const likes = (characterIndex: number, giftIndex: number) => (characterIndex + giftIndex) % 6 === 0;

export type DrawOutcome = { kind: "gift"; gift: Gift } | { kind: "reset" };

export type SendResult = {
  character: Character;
  gift: Gift;
  /** 送礼记录后面那个胶囊的话；没有变化（到顶了、冷却中还没解除）时为 null。 */
  cue: string | null;
  /** 冷却中送了、还没解除时，新的解除时刻。 */
  stillCoolingUntil: Date | null;
};

export function useGifts() {
  const { characters } = useDirectory();
  const [s, setS] = useState<State>({
    draws: 3,
    inventory: SOME,
    resetCards: 1,
    values: {},
    cooling: {},
    look: "flat",
    inCall: false,
    to: null,
    forced: "随机",
    judgeOff: false,
  });

  useEffect(() => {
    const to = new URLSearchParams(location.search).get("to");
    if (to) setS((x) => ({ ...x, to }));
  }, []);
  useEffect(() => {
    if (characters && Object.keys(s.values).length === 0) setS((x) => ({ ...x, ...initialValues(characters) }));
  }, [characters, s.values]);

  const set = (patch: Partial<State>) => setS((x) => ({ ...x, ...patch }));
  const value = (id: string) => s.values[id] ?? NORMAL;

  const owned = useMemo(() => CATALOG.filter((g) => (s.inventory[g.id] ?? 0) > 0), [s.inventory]);

  const draw = (): DrawOutcome | null => {
    if (s.draws <= 0) return null;
    let outcome: DrawOutcome;
    const pick = (r: Rarity): DrawOutcome => {
      const pool = CATALOG.filter((g) => g.rarity === r);
      return { kind: "gift", gift: pool[Math.floor(Math.random() * pool.length)] };
    };
    if (s.forced === "重置卡") outcome = { kind: "reset" };
    else if (s.forced !== "随机") outcome = pick(s.forced);
    else {
      const r = Math.random() * 100;
      outcome = r < 1 ? { kind: "reset" } : r < 70 ? pick("普通") : r < 95 ? pick("少见") : pick("稀有");
    }
    setS((x) => ({
      ...x,
      draws: x.draws - 1,
      resetCards: x.resetCards + (outcome.kind === "reset" ? 1 : 0),
      inventory:
        outcome.kind === "gift" ? { ...x.inventory, [outcome.gift.id]: (x.inventory[outcome.gift.id] ?? 0) + 1 } : x.inventory,
    }));
    return outcome;
  };

  /** 把攒下的次数一次抽完（B、C 里的「全部抽完」）。 */
  const drawAll = (): DrawOutcome[] => {
    const out: DrawOutcome[] = [];
    let inv = { ...s.inventory };
    let resets = 0;
    for (let i = 0; i < s.draws; i++) {
      const r = Math.random() * 100;
      const rarity: Rarity = r < 70 ? "普通" : r < 95 ? "少见" : "稀有";
      if (r < 1 || (s.forced === "重置卡" && i === 0)) {
        out.push({ kind: "reset" });
        resets++;
        continue;
      }
      const pool = CATALOG.filter((g) => g.rarity === (s.forced !== "随机" && s.forced !== "重置卡" ? s.forced : rarity));
      const gift = pool[Math.floor(Math.random() * pool.length)];
      inv = { ...inv, [gift.id]: (inv[gift.id] ?? 0) + 1 };
      out.push({ kind: "gift", gift });
    }
    setS((x) => ({ ...x, draws: 0, inventory: inv, resetCards: x.resetCards + resets }));
    return out;
  };

  const send = (giftId: string, characterId: string): SendResult | null => {
    const character = characters?.find((c) => c.id === characterId);
    if (!character || (s.inventory[giftId] ?? 0) <= 0) return null;
    const gift = giftOf(giftId);
    const ci = characters!.indexOf(character);
    const gi = CATALOG.indexOf(gift);
    const before = value(characterId);
    const wasCooling = !!s.cooling[characterId];
    const bonus = wasCooling ? 3 : BONUS[gift.rarity] + (likes(ci, gi) ? 3 : 0);
    const after = Math.min(100, before + bonus);
    const nowCooling = wasCooling && after < 10;
    setS((x) => ({
      ...x,
      inventory: { ...x.inventory, [giftId]: x.inventory[giftId] - 1 },
      values: { ...x.values, [characterId]: after },
      cooling: { ...x.cooling, [characterId]: nowCooling },
    }));
    const name = character.name;
    let cue: string | null;
    if (wasCooling) cue = nowCooling ? null : `${name}愿意和你说话了`;
    else if (after === before) cue = null;
    else if (tierOf(after) !== tierOf(before)) cue = `和${name}更近了一步：${tierOf(after)}`;
    else cue = `${name}有点开心`;
    return { character, gift, cue, stillCoolingUntil: nowCooling ? cooldownEnds(after) : null };
  };

  /** 重置卡会拉回的角色：低于正常值 50 的（票 07）。 */
  const resetTargets = (characters ?? []).filter((c) => value(c.id) < NORMAL);
  const applyReset = () => {
    setS((x) => {
      const values = { ...x.values };
      for (const c of resetTargets) values[c.id] = NORMAL;
      return { ...x, values, cooling: {}, resetCards: x.resetCards - 1 };
    });
  };

  const affinity = (id: string) => {
    const v = value(id);
    return { value: v, tier: tierOf(v), cooling: !!s.cooling[id], until: s.cooling[id] ? cooldownEnds(v) : null };
  };

  return { ...s, set, characters, owned, draw, drawAll, send, resetTargets, applyReset, affinity };
}
export type Gifts = ReturnType<typeof useGifts>;

// ---- 抽奖次数的说法 ----

/** 次数旁边的一句：下次什么时候发；攒满 7 次时说不会再多。 */
export function drawNote(draws: number): string {
  if (draws >= 7) return "已攒满 7 次，抽掉之前不会再发";
  if (draws === 0) return "今天的已经抽了，明天 0:00 再发 1 次";
  return "明天 0:00 再发 1 次，最多攒 7 次";
}

// ---- 小部件 ----

const CATEGORY_ICON: Record<Category, typeof FoodIcon> = { 吃的: FoodIcon, 饮品: DrinkIcon, 花草: FlowerIcon, 小物件: TrinketIcon };

/** 礼物插画：有样图的四件按面板选的画风显示，其余用分类的 Lucide 图标占位（只是原型；定稿每件都有插画，票 09）。 */
export function GiftArt({ gift, look, className }: { gift: Gift; look: Look; className?: string }) {
  const Icon = CATEGORY_ICON[gift.category];
  return (
    <div className={cn("flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted", className)}>
      {gift.art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/gifts/proto/${look}/${gift.art}.webp`} alt="" className="size-[88%] object-contain" />
      ) : (
        <Icon aria-hidden className="size-2/5 text-muted-foreground/60" />
      )}
    </div>
  );
}

/** 重置卡不是礼物，没有插画，用 Lucide 图标。 */
export function ResetArt({ className }: { className?: string }) {
  return (
    <div className={cn("flex aspect-square shrink-0 items-center justify-center rounded-xl border border-dashed bg-background", className)}>
      <ResetCardIcon aria-hidden className="size-2/5 text-foreground" />
    </div>
  );
}

/** 档位：五档心形（票 06 定的样子，这里用中性色），冷却中换成沙漏加解除时刻。 */
export function TierLabel({ a, compact = false }: { a: ReturnType<Gifts["affinity"]>; compact?: boolean }) {
  if (a.cooling)
    return (
      <span className="flex min-w-0 items-center gap-1 text-subtitle text-muted-foreground">
        <CooldownIcon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{compact ? "冷却中" : `冷却中 · ${clockText(a.until!)} 解除`}</span>
      </span>
    );
  return (
    <span className="flex min-w-0 items-center gap-1 text-subtitle text-muted-foreground">
      <TierHeart tier={a.tier} />
      <span className="truncate">{a.tier}</span>
    </span>
  );
}

export function TierHeart({ tier }: { tier: Tier }) {
  if (tier === "冷淡") return <HeartOffIcon aria-hidden className="size-3.5 shrink-0" />;
  if (tier === "疏远") return <HeartCrackIcon aria-hidden className="size-3.5 shrink-0" />;
  if (tier === "亲近")
    return (
      <span aria-hidden className="relative size-3.5 shrink-0">
        <HeartIcon className="absolute inset-0 size-3.5" />
        <HeartIcon className="absolute inset-0 size-3.5 fill-current [clip-path:inset(50%_0_0_0)]" />
      </span>
    );
  return <HeartIcon aria-hidden className={cn("size-3.5 shrink-0", tier === "亲密" && "fill-current")} />;
}

export function Avatar({ c, size = "lg" }: { c: Character; size?: "sm" | "bubble" | "lg" | "list" }) {
  return <MarkedAvatar name={c.name} src={c.avatar_url} size={size} />;
}

/** 通话中切到礼物页时的通话条（假的）：放在礼物页最上面，铺满导航栏右边整块，样子和对话页上的一样。 */
export function FakeCallBar({ c }: { c: Character }) {
  return (
    <div style={herVars(c.color)} className="shrink-0">
      <button
        type="button"
        onClick={() => alert("原型：点了回到通话层（通话提到外壳里以后，在礼物页上直接展开）")}
        className="flex h-call-bar w-full items-center gap-2 bg-her-call-deep px-4 text-left text-white outline-none"
      >
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-white" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums">和{c.name}通话中 03:12</span>
        <span className="flex shrink-0 items-center text-sm text-white/80">
          回到通话
          <ForwardIcon aria-hidden className="size-4" />
        </span>
      </button>
    </div>
  );
}

/** 抽奖次数：7 个小点，攒了几次亮几个。 */
export function DrawPips({ draws }: { draws: number }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className={cn("size-2 rounded-full", i < draws ? "bg-foreground" : "bg-foreground/15")} />
      ))}
    </span>
  );
}

// ---- 左下角的原型面板 ----

function Seg<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; t: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-14 shrink-0 text-white/60">{label}</span>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn("rounded px-1.5 py-0.5", o.v === value ? "bg-white text-black" : "bg-white/10 hover:bg-white/20")}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function PrototypePanel({ g }: { g: Gifts }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!matchMedia("(min-width: 768px)").matches) setOpen(false);
  }, []);
  const cs = g.characters ?? [];
  const inv = Object.values(g.inventory).reduce((a, b) => a + b, 0);
  const coolingNames = cs.filter((c) => g.cooling[c.id]).map((c) => c.name);
  const panel = (children: ReactNode) => (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-[100] rounded-lg bg-black p-2 text-xs text-white shadow-lg ring-2 ring-yellow-400 max-md:right-2 max-md:bottom-16",
        open ? "w-80" : "w-auto",
      )}
    >
      {children}
    </div>
  );
  if (!open)
    return panel(
      <button type="button" onClick={() => setOpen(true)} className="w-full text-left">
        原型面板 ▸
      </button>,
    );
  return panel(
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={() => setOpen(false)} className="text-left font-medium">
        原型面板 ▾
      </button>
      <Seg label="抽奖次数" value={g.draws} options={[0, 1, 3, 7].map((v) => ({ v, t: String(v) }))} onChange={(draws) => g.set({ draws })} />
      <Seg
        label="下一抽"
        value={g.forced}
        options={(["随机", "普通", "少见", "稀有", "重置卡"] as Forced[]).map((v) => ({ v, t: v }))}
        onChange={(forced) => g.set({ forced })}
      />
      <Seg
        label="背包"
        value={inv === 0 ? "empty" : inv > 30 ? "many" : "some"}
        options={[
          { v: "empty", t: "空" },
          { v: "some", t: "几件" },
          { v: "many", t: "很多" },
        ]}
        onChange={(v) => g.set({ inventory: v === "empty" ? {} : v === "many" ? MANY : SOME })}
      />
      <Seg label="重置卡" value={g.resetCards} options={[0, 1, 2].map((v) => ({ v, t: String(v) }))} onChange={(resetCards) => g.set({ resetCards })} />
      <Seg
        label="好感度"
        value={g.resetTargets.length > 0 ? "mixed" : "fine"}
        options={[
          { v: "mixed", t: "有冷却、有疏远" },
          { v: "fine", t: "都不低于 50" },
        ]}
        onChange={(v) =>
          g.set(
            v === "mixed"
              ? initialValues(cs)
              : { values: Object.fromEntries(cs.map((c) => [c.id, Math.max(50, g.values[c.id] ?? 50)])), cooling: {} },
          )
        }
      />
      <Seg label="画风" value={g.look} options={LOOKS.map((l) => ({ v: l.key, t: l.name }))} onChange={(look) => g.set({ look })} />
      <Seg
        label="预选她"
        value={g.to ?? ""}
        options={[{ v: "", t: "没有" }, ...cs.slice(0, 2).map((c, i) => ({ v: c.id, t: i === 1 ? `${c.name}（冷却中）` : c.name }))]}
        onChange={(v) => g.set({ to: v || null })}
      />
      <Seg
        label="通话中"
        value={g.inCall}
        options={[
          { v: false, t: "否" },
          { v: true, t: `是（和${cs[0]?.name ?? "她"}）` },
        ]}
        onChange={(inCall) => g.set({ inCall })}
      />
      <Seg
        label="判断模型"
        value={g.judgeOff}
        options={[
          { v: false, t: "有" },
          { v: true, t: "没配（整块关闭）" },
        ]}
        onChange={(judgeOff) => g.set({ judgeOff })}
      />
      <p className="border-t border-white/20 pt-1.5 text-white/70">
        次数 {g.draws} · 背包 {inv} 件 · 重置卡 {g.resetCards} · 冷却中：{coolingNames.join("、") || "无"} · 低于 50：
        {g.resetTargets.map((c) => `${c.name} ${g.values[c.id]}`).join("、") || "无"}
      </p>
    </div>,
  );
}
