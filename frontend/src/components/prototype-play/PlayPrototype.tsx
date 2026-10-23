"use client";

// PROTOTYPE（play-and-schedule 票 02「原型：玩法页长什么样」）：只在 prototype/play-hub 分支，不进 main。
// 导航中间的「礼物」改叫「玩法」，还是 /gifts 这个路由；四个变体用 ?variant=A|B|C|D 切，栏目用 ?col=，
// ?closed=1 模拟好感度和礼物没开放（只剩日历）。正式版的路由（/play、/play/gifts…）由规格定。
//
// A 入口卡片：玩法页是一张张卡片（标题、图标、一句状态），点进去是子页，页首有返回键（手机电脑一样）。两栏加日历。
// B 两级列表：和设置一样，电脑上左边 320px 的栏目列表、右边内容；手机上先列表、点进去是子页。四栏（礼物 / 每日任务 / 成就 / 日历）。
// C 标签：页首「玩法」，下面一排标签（礼物 / 任务与成就 / 日历），内容直接摊在下面，没有子页。
// D 一整页：现在的礼物页原样，最上面多一条今天的日历。

import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cloneElement, isValidElement, useEffect, useState, type ReactNode } from "react";

import { PageShell } from "@/components/app/PageShell";
import { CAL_VARIANTS, CalendarPrototype } from "@/components/prototype-play/CalendarPrototype";
import { PrototypeSwitcher } from "@/components/app/PrototypeSwitcher";
import { SubpageHeader } from "@/components/app/SubpageHeader";
import { useDirectory } from "@/components/conversations/ConversationDirectory";
import { GiftsPage, type GiftsPart } from "@/components/gifts/GiftsPage";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { achievementsSeenUpTo, OF_ALL, unseenRows } from "@/lib/achievements";
import { getGiftState, type GiftsFor, type GiftState } from "@/lib/gifts";
import { cn } from "@/lib/utils";
import { AchievementsIcon, CalendarIcon, ForwardIcon, GiftIcon, SuccessIcon } from "@/theme/icons";

const VARIANTS = [
  { key: "A", name: "入口卡片 + 子页" },
  { key: "B", name: "两级列表，同设置" },
  { key: "C", name: "标签，直接摊开" },
  { key: "D", name: "一整页，加日历条" },
];

type Col = "gifts" | "tasks" | "achievements" | "calendar";

type Column = {
  col: Col;
  name: string;
  icon: typeof GiftIcon;
  /** 一句状态；没有就不写。 */
  status: string | null;
  /** 栏目上的点。 */
  dot: boolean;
  parts: GiftsPart[];
};

/** 日历一栏的占位：内容由票 07 的原型定，这里只写一句看看位置。 */
const CALENDAR_STATUS = "本周还有 14 项工作待排 · 下一个：10月27日 樋口円香的生日";

/** 这些栏目各自的状态：礼物看抽奖次数和背包，每日任务看做完几项，成就看有没有新解锁。 */
function useColumns(closed: boolean, merged: boolean): Column[] | null {
  const { account, newRewards } = useDirectory();
  const [state, setState] = useState<GiftState | null>(null);
  useEffect(() => {
    getGiftState().then(setState, () => {});
  }, []);
  if (!state) return null;
  const open = state.open && !closed;
  const calendar: Column = { col: "calendar", name: "日历", icon: CalendarIcon, status: CALENDAR_STATUS, dot: false, parts: [] };
  if (!open) return [calendar];
  const items = state.backpack.reduce((n, b) => n + b.count, 0);
  const gifts: Column = {
    col: "gifts",
    name: "礼物",
    icon: GiftIcon,
    status: `还有 ${state.draws} 次抽奖${items > 0 ? ` · 背包 ${items} 件` : ""}${state.reset_cards > 0 ? ` · 重置卡 ${state.reset_cards} 张` : ""}`,
    dot: newRewards,
    parts: ["gifts"],
  };
  const tasks = state.daily_tasks?.tasks ?? [];
  const done = tasks.filter((t) => t.done).length;
  const taskStatus = tasks.length === 0 ? null : done === tasks.length ? "今天都做完了" : `今天 ${done}/${tasks.length}`;
  const seenAt = account ? achievementsSeenUpTo(account.id, OF_ALL) : null;
  const unseen = state.achievements ? unseenRows({ achievements: state.achievements }, seenAt).size : 0;
  const achievementStatus = unseen > 0 ? `${unseen} 个新解锁` : "合起来的四个成就";
  if (merged)
    return [
      gifts,
      {
        col: "tasks",
        name: "每日任务与成就",
        icon: SuccessIcon,
        status: [taskStatus && `每日任务 ${taskStatus}`, unseen > 0 && `成就 ${unseen} 个新解锁`].filter(Boolean).join(" · "),
        dot: unseen > 0,
        parts: ["tasks", "achievements"],
      },
      calendar,
    ];
  return [
    gifts,
    { col: "tasks", name: "每日任务", icon: SuccessIcon, status: taskStatus, dot: false, parts: ["tasks"] },
    { col: "achievements", name: "成就", icon: AchievementsIcon, status: achievementStatus, dot: unseen > 0, parts: ["achievements"] },
    calendar,
  ];
}

export function PlayPrototype({ pick }: { pick: GiftsFor | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const variant = params.get("variant") ?? "A";
  const closed = params.get("closed") === "1";
  // 从对话页「送她一件礼物」跳来（带 to）时直接进礼物那一栏。
  const col = (params.get("col") as Col | null) ?? (pick ? "gifts" : null);
  const href = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/gifts?${p}`;
  };
  const props = { pick, col, closed, href };
  return (
    <>
      {variant === "A" && <VariantA {...props} />}
      {variant === "B" && <VariantB {...props} />}
      {variant === "C" && <VariantC {...props} />}
      {variant === "D" && <VariantD {...props} />}
      {/* 票 07：在日历子页上，切换条切的是日历的方案（?cal=）。 */}
      {col === "calendar" ? (
        <PrototypeSwitcher
          variants={CAL_VARIANTS}
          current={params.get("cal") ?? "D"}
          onChange={(key) => router.replace(href({ cal: key }), { scroll: false })}
        />
      ) : (
        <PrototypeSwitcher
          variants={VARIANTS}
          current={variant}
          onChange={(key) => router.replace(href({ variant: key, col: null, to: null }), { scroll: false })}
        />
      )}
    </>
  );
}

type VariantProps = {
  pick: GiftsFor | null;
  col: Col | null;
  closed: boolean;
  href: (next: Record<string, string | null>) => string;
};

/** 一个栏目的内容：礼物那几栏是礼物页的那几块，日历是占位。 */
function ColumnPage({
  column,
  pick,
  closed,
  header,
  above,
  onPickGift,
}: {
  column: Column;
  pick: GiftsFor | null;
  closed: boolean;
  header: ReactNode;
  above?: ReactNode;
  onPickGift: () => void;
}) {
  if (column.col === "calendar")
    return <CalendarColumn header={header} above={above} />;
  return (
    <GiftsPage
      key={column.col}
      pick={pick}
      parts={column.parts}
      header={header}
      above={above}
      closed={closed}
      onPickGift={onPickGift}
    />
  );
}

/** 票 07：日历子页换成日历和排日程的原型；SubpageHeader 的右端放月 / 周切换，页底放保存条。 */
function CalendarColumn({ header, above }: { header: ReactNode; above?: ReactNode }) {
  const params = useSearchParams();
  const cal = params.get("cal") ?? "D";
  return (
    <CalendarPrototype
      key={cal}
      variant={cal}
      frame={(end, body, footer) => (
        <PageShell
          width="full"
          isInShell
          header={isValidElement<{ end?: ReactNode }>(header) ? cloneElement(header, { end }) : header}
          footer={footer}
        >
          {above}
          {body}
        </PageShell>
      )}
    />
  );
}

export function CalendarPlaceholder() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarIcon />
        </EmptyMedia>
        <EmptyTitle>日历</EmptyTitle>
        <EmptyDescription>位置先占好；长什么样由「原型：日历和排日程的界面」定。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full bg-foreground", className)} />;
}

function Loading() {
  return (
    <PageShell width="full" isInShell header={<h1 className="text-list-title">玩法</h1>}>
      <p className="px-4 py-6 text-body text-muted-foreground">正在读取…</p>
    </PageShell>
  );
}

// ─── A 入口卡片 ────────────────────────────────────────────────────────────

function VariantA({ pick, col, closed, href }: VariantProps) {
  const router = useRouter();
  const columns = useColumns(closed, true);
  if (!columns) return <Loading />;
  const current = columns.find((c) => c.col === col);
  if (current)
    return (
      <ColumnPage
        column={current}
        pick={pick}
        closed={closed}
        header={<SubpageHeader title={current.name} backHref={href({ col: null, to: null })} />}
        onPickGift={() => router.push(href({ col: "gifts" }))}
      />
    );
  return (
    <PageShell width="full" isInShell header={<h1 className="text-list-title">玩法</h1>}>
      <div className="mx-auto grid w-full max-w-3xl gap-3 px-4 py-6 sm:grid-cols-2">
        {columns.map((c) => (
          <NextLink
            key={c.col}
            href={href({ col: c.col })}
            className={cn(
              "flex min-h-32 flex-col gap-3 rounded-2xl border p-5 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
              c.col === "gifts" && "bg-muted hover:bg-muted sm:col-span-2",
            )}
          >
            <span className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-background">
                <c.icon aria-hidden className="size-5" />
              </span>
              <span className="text-header">{c.name}</span>
              {c.dot && <Dot />}
              <span className="flex-1" />
              <ForwardIcon aria-hidden className="size-5 text-muted-foreground" />
            </span>
            {c.status && <span className="text-subtitle text-muted-foreground">{c.status}</span>}
          </NextLink>
        ))}
      </div>
    </PageShell>
  );
}

// ─── B 两级列表 ────────────────────────────────────────────────────────────

function VariantB({ pick, col, closed, href }: VariantProps) {
  const router = useRouter();
  const columns = useColumns(closed, false);
  if (!columns) return <Loading />;
  const named = columns.find((c) => c.col === col) ?? null;
  // 电脑上只打开玩法时右栏是第一栏。
  const shown = named ?? columns[0];
  return (
    <div className="flex h-full bg-background text-foreground">
      <nav aria-label="玩法" className={cn("flex w-80 shrink-0 flex-col border-r max-md:w-full max-md:border-r-0", named && "max-md:hidden")}>
        <header className="flex min-h-14 shrink-0 items-center pt-3 pr-2 pb-2 pl-4">
          <h1 className="text-list-title">玩法</h1>
        </header>
        <ul className="flex flex-col px-2">
          {columns.map((c) => (
            <li key={c.col}>
              <NextLink
                href={href({ col: c.col, to: null })}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                  c.col === shown.col && "md:bg-muted md:hover:bg-muted",
                )}
              >
                <c.icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-body">
                    {c.name}
                    {c.dot && <Dot />}
                  </span>
                  {c.status && <span className="truncate text-meta text-muted-foreground">{c.status}</span>}
                </span>
                <ForwardIcon aria-hidden className="size-4 text-muted-foreground md:hidden" />
              </NextLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={cn("min-w-0 flex-1", !named && "max-md:hidden")}>
        <ColumnPage
          column={shown}
          pick={pick}
          closed={closed}
          header={<SubpageHeader title={shown.name} backHref={href({ col: null, to: null })} isBackNarrowOnly />}
          onPickGift={() => router.push(href({ col: "gifts" }))}
        />
      </div>
    </div>
  );
}

// ─── C 标签 ────────────────────────────────────────────────────────────────

function VariantC({ pick, col, closed, href }: VariantProps) {
  const router = useRouter();
  const columns = useColumns(closed, true);
  if (!columns) return <Loading />;
  const shown = columns.find((c) => c.col === col) ?? columns[0];
  const tabs =
    columns.length > 1 ? (
      <Tabs value={shown.col} onValueChange={(v) => router.replace(href({ col: String(v), to: null }), { scroll: false })}>
        <TabsList className="w-full sm:w-fit">
          {columns.map((c) => (
            <TabsTrigger key={c.col} value={c.col}>
              {c.name}
              {c.dot && <Dot />}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    ) : null;
  return (
    <ColumnPage
      column={shown}
      pick={pick}
      closed={closed}
      header={<h1 className="text-list-title">玩法</h1>}
      above={tabs}
      onPickGift={() => router.replace(href({ col: "gifts" }), { scroll: false })}
    />
  );
}

// ─── D 一整页 ──────────────────────────────────────────────────────────────

function VariantD({ pick, closed }: VariantProps) {
  const strip = (
    <section aria-label="日历" className="flex items-center gap-3 rounded-2xl border px-5 py-3">
      <CalendarIcon aria-hidden className="size-5 shrink-0" />
      <p className="min-w-0 flex-1 truncate text-body">{CALENDAR_STATUS}</p>
      <span className="shrink-0 text-meta text-muted-foreground">日历 ›</span>
    </section>
  );
  return (
    <GiftsPage pick={pick} closed={closed} header={<h1 className="text-list-title">玩法</h1>} above={strip} />
  );
}
