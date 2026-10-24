"use client";

// PROTOTYPE（cycles 票 06「原型：周期子页长什么样」）：只在 prototype/cycles-page 分支，不进 main。
// 「周期」子页（/play/cycles）的三个方案，?variant=A|B|C 切换，底部黄框切换条或键盘 ← →：
//   A 名单进人：先一份 29 人的名单（每行她推算的下次经期），点进某一位（?who=）看资料、月历、记录和讲解。
//   B 一屏月历：页首下面一排头像选人，下面就是她的月历；点一天就在这天记、改；电脑上右边一栏放资料、记录和讲解。
//   C 圆盘和周期条：弹窗选人；主视觉是周期圆盘（今天在第几天），下面一条条周期（记过的、往后 3 个推算的），不画月历；
//     讲解单独一个标签。
//   D B 改（默认）：用户 2026-10-25 选了 B，按反馈改——头像条上面加对话列表同款的搜索框和筛选键；月历用 A 的整格铺底加圈；
//     电脑上右栏只放数字和最近 3 次记录（多了「展开全部」），讲解和免责挪到两栏下面通栏，左右不再一短一长。
// 玩法页第一级的「周期」卡状态用 /play?card=A|B|C 切（见 cyclesCardStatus）。
// 记录是假数据、只在内存里（刷新就回到初始）；推算是 LAPLACE 算法的简化版，只为画得像，规格以票 05 为准。

import { Minus, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { MarkedAvatar } from "@/components/app/MarkedAvatar";
import { PrototypeSwitcher } from "@/components/app/PrototypeSwitcher";
import {
  useDirectory,
  useWide,
} from "@/components/conversations/ConversationDirectory";
import { PlayShell } from "@/components/play/PlayShell";
import { SubpageHeader } from "@/components/app/SubpageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { matchesSearch } from "@/lib/characterSearch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Character } from "@/lib/api";
import {
  addDays,
  type CalendarMonth,
  monthCells,
  monthOf,
  partsOf,
  shiftMonth,
  todayIn,
} from "@/lib/calendar";
import { playHref } from "@/lib/playRoute";
import { cn } from "@/lib/utils";
import { herVars } from "@/theme/herVars";
import {
  BackIcon,
  FilterIcon,
  ForwardIcon,
  NextMonthIcon,
  PreviousMonthIcon,
  SearchIcon,
  TrashIcon,
} from "@/theme/icons";

type Search = { [key: string]: string | string[] | undefined };

const VARIANTS = [
  { key: "D", name: "B 改" },
  { key: "A", name: "名单进人" },
  { key: "B", name: "一屏月历" },
  { key: "C", name: "圆盘和周期条" },
];

// ───────────────────────────── 假数据和推算 ─────────────────────────────

type Rec = { start: string; days: number };

type Reason = "once" | "irregular" | "missed" | "late";

const REASON_TEXT: Record<Reason, string> = {
  once: "再记一次就能按她自己的周期推算。",
  irregular: "她的周期长短不一，估算只作参考。",
  missed: "中间可能漏记了一次。",
  late: "这次可能还没记下。",
};

type Estimate = {
  cycle: number;
  period: number;
  reasons: Reason[];
  /** 往后 3 个推算的经期（第一个可能已经过了预计日子还没记，那时带 late）。 */
  periods: Rec[];
  /** 平均差，能比两个周期以后才有。 */
  avgError: number | null;
};

const today = () =>
  todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date());

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** 只用这些记录算周期长度（不含 late）；简化的 LAPLACE。 */
function cycleOf(records: Rec[]): { cycle: number; reasons: Reason[] } {
  if (records.length < 2) return { cycle: 28, reasons: ["once"] };
  const gaps = records
    .slice(-9)
    .slice(1)
    .map((r, i, arr) =>
      daysBetween((i === 0 ? records.slice(-9)[0] : arr[i - 1]).start, r.start),
    )
    .filter((g) => g >= 15 && g <= 60);
  if (gaps.length === 0) return { cycle: 28, reasons: ["once"] };
  const anchor = Math.min(38, Math.max(22, Math.min(...gaps)));
  const kept = gaps.filter((g) => g < anchor * 1.6);
  const reasons: Reason[] = [];
  if (kept.length < gaps.length) reasons.push("missed");
  if (kept.length === 0) {
    return {
      cycle: Math.round(gaps[0] / Math.round(gaps[0] / 28)),
      reasons: ["missed"],
    };
  }
  if (Math.max(...kept) - Math.min(...kept) > 7) reasons.push("irregular");
  return { cycle: median(kept), reasons };
}

function estimate(records: Rec[], now: string): Estimate | null {
  if (records.length === 0) return null;
  const { cycle, reasons } = cycleOf(records);
  const period =
    records.length < 2
      ? Math.max(records[0].days, 5)
      : median(records.slice(-6).map((r) => r.days));
  const last = records[records.length - 1];
  const first = addDays(last.start, cycle);
  const all = [...reasons];
  if (first < now) all.push("late");
  const periods = [0, 1, 2].map((k) => ({
    start: addDays(first, k * cycle),
    days: period,
  }));
  // 平均差：每个后来的记录只用它之前的记录算当时的估计。
  const errors: number[] = [];
  for (let i = 1; i < records.length; i++) {
    const before = records.slice(0, i);
    const c = cycleOf(before).cycle;
    const gap = daysBetween(before[before.length - 1].start, records[i].start);
    if (gap < 15 || gap > 60 || gap >= c * 1.6) continue;
    errors.push(Math.abs(gap - c));
  }
  const avgError =
    errors.length >= 2
      ? Math.round((errors.reduce((a, b) => a + b, 0) / errors.length) * 10) /
        10
      : null;
  return { cycle, period, reasons: all, periods, avgError };
}

type DayKind = "recorded" | "estimated" | "premenstrual" | null;

function dayKind(date: string, records: Rec[], est: Estimate | null): DayKind {
  if (records.some((r) => date >= r.start && date < addDays(r.start, r.days)))
    return "recorded";
  if (!est) return null;
  if (
    est.periods.some((p) => date >= p.start && date < addDays(p.start, p.days))
  )
    return "estimated";
  if (est.periods.some((p) => date >= addDays(p.start, -5) && date < p.start))
    return "premenstrual";
  return null;
}

/** 前几位各一种情况，其余没记过。 */
function seedBook(characters: Character[], now: string): Record<string, Rec[]> {
  const seeds: Rec[][] = [
    // 规律，29 天
    Array.from({ length: 12 }, (_, i) => ({
      start: addDays(now, -23 - (11 - i) * 29),
      days: 5,
    })),
    // 只记了一次
    [{ start: addDays(now, -9), days: 4 }],
    // 长短不一（未成年常见）
    [-150, -126, -90, -66, -32].map((d, i) => ({
      start: addDays(now, d),
      days: [6, 5, 7, 5, 6][i],
    })),
    // 漏记一次
    [-120, -92, -36].map((d) => ({ start: addDays(now, d), days: 5 })),
    // 过了预计日子还没新记录
    [-100, -71, -42].map((d) => ({ start: addDays(now, d), days: 6 })),
    // 正在经期（今天前两天记的）
    [-60, -31, -2].map((d) => ({ start: addDays(now, d), days: 5 })),
  ];
  return Object.fromEntries(characters.map((c, i) => [c.id, seeds[i] ?? []]));
}

let book: Record<string, Rec[]> | null = null;

/** 内存里的记录本：同一个页面会话里各变体、第一级的卡共用。 */
function useBook(characters: Character[] | null) {
  const now = today();
  if (!book && characters) book = seedBook(characters, now);
  const [, bump] = useState(0);
  const records = (id: string) => book?.[id] ?? [];
  const save = (id: string, rec: Rec, replacing?: string) => {
    if (!book) return;
    const rest = (book[id] ?? []).filter((r) => r.start !== replacing);
    book[id] = [...rest, rec].sort((a, b) => a.start.localeCompare(b.start));
    bump((n) => n + 1);
  };
  const remove = (id: string, start: string) => {
    if (!book) return;
    book[id] = (book[id] ?? []).filter((r) => r.start !== start);
    bump((n) => n + 1);
  };
  return { now, records, save, remove };
}

// ───────────────────────────── 文案 ─────────────────────────────

const LEAD = "凭她的言行记下她的经期，这里替你推算。";
const DISCLAIMER =
  "推算只是估计，不是医疗建议，不能用来避孕；身体不适请看医生。";

function md(date: string): string {
  const { month, day } = partsOf(date);
  return `${month}月${day}日`;
}

/** 名单、卡片上她的一句状态。 */
function herStatus(records: Rec[], now: string): string {
  const est = estimate(records, now);
  if (!est) return "还没记过";
  const kind = dayKind(now, records, est);
  if (kind === "recorded") {
    const r = records.find(
      (x) => now >= x.start && now < addDays(x.start, x.days),
    );
    return `经期第 ${r ? daysBetween(r.start, now) + 1 : 1} 天`;
  }
  if (kind === "estimated") return "推算在经期";
  const next = est.periods.find((p) => p.start >= now) ?? est.periods[0];
  if (kind === "premenstrual") return `推算在经前 · ${md(next.start)} 来`;
  if (est.reasons.includes("late"))
    return `推算 ${md(est.periods[0].start)} 来，还没记下`;
  return `推算 ${md(next.start)} 来 · 还有 ${daysBetween(now, next.start)} 天`;
}

/** 玩法页第一级「周期」卡的状态：/play?card=A|B|C。 */
export function cyclesCardStatus(
  card: string,
  characters: Character[] | null,
): string {
  if (!characters) return "";
  const now = today();
  if (!book) book = seedBook(characters, now);
  const recorded = characters.filter((c) => (book?.[c.id] ?? []).length > 0);
  if (recorded.length === 0) return LEAD;
  const nexts = recorded
    .map((c) => {
      const est = estimate(book?.[c.id] ?? [], now);
      const p = est?.periods.find((x) => x.start >= now);
      return { c, start: p?.start ?? "9999" };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  const name = (c: Character) => c.short_name ?? c.name;
  if (card === "B") return `下一个：${md(nexts[0].start)} ${name(nexts[0].c)}`;
  if (card === "C") {
    const inPeriod = recorded.filter((c) => {
      const k = dayKind(
        now,
        book?.[c.id] ?? [],
        estimate(book?.[c.id] ?? [], now),
      );
      return k === "recorded" || k === "estimated";
    });
    if (inPeriod.length > 0)
      return `${inPeriod.map(name).join("、")}可能在经期`;
    return `下一个：${md(nexts[0].start)} ${name(nexts[0].c)}`;
  }
  return `记过 ${recorded.length} 位 · 最近 ${name(nexts[0].c)} ${md(nexts[0].start)}`;
}

// ───────────────────────────── 共用的小件 ─────────────────────────────

/** 讲解六块：同一个 name 的 <details> 一次只开一块（规格里换 shadcn Accordion）。来源是小链接。 */
const KNOWLEDGE: { title: string; lines: [string, string][] }[] = [
  {
    title: "怎么算的",
    lines: [
      ["只记了一次时，按 28 天一个周期、经期 5 天粗略估计。", "LAPLACE"],
      [
        "记满两次后，取最近几个周期长度的中位数；明显像漏记的间隔先剔掉。",
        "LAPLACE",
      ],
      ["下次经期 = 上次第一天 + 周期长度；经前是它前面 5 天。", "默沙东"],
      ["推算只看日期，看不到她身体里发生了什么。", "LAPLACE"],
      [
        "排卵一般在下次经期前约 14 天，但黄体期约 12.4±2 天，28 天周期里正好在第 14 天排卵的只有约一成。",
        "Bull 2019",
      ],
      ["算法参考 LAPLACE Cycles。", "LAPLACE"],
    ],
  },
  {
    title: "基础知识",
    lines: [
      ["周期 21–35 天都正常，经期一般 2–7 天。", "中国 AUB 指南"],
      [
        "一个周期分经期、卵泡期、排卵、黄体期，长短的差异主要来自卵泡期。",
        "默沙东",
      ],
      ["只有约 13% 的周期正好 28 天。", "Bull 2019"],
    ],
  },
  {
    title: "青春期",
    lines: [
      ["中国女孩初潮的中位年龄约 12 岁。", "Ma 2023"],
      ["初潮后一两年不规律很常见，21–45 天都算正常。", "青春期 AUB 共识"],
      ["15 岁还没来、一次间隔超过 90 天、经期超过 7 天，应该看医生。", "ACOG"],
    ],
  },
  {
    title: "经前和经期",
    lines: [
      [
        "经前几天可能易怒、低落、胀痛、睡不好，经期开始后几小时内消退。",
        "默沙东",
      ],
      ["经期可能下腹痛、腰酸、疲倦，第一天最重，两三天后缓解。", "默沙东"],
      ["疼得影响生活、突然剧痛或发热，要看医生。", "中华医学会"],
    ],
  },
  {
    title: "怎么体贴",
    lines: [
      ["多休息、睡够，热敷下腹，适当活动，少糖少盐少咖啡因。", "默沙东"],
      ["她不想说就别追问，也别评判她的情绪。", "LAPLACE"],
    ],
  },
  {
    title: "常见误区",
    lines: [
      ["❌ 住在一起月经会同步：后来的研究没能重复出来。", "Yang 2006"],
      ["❌ 周期都是 28 天、第 14 天排卵。", "Bull 2019"],
      [
        "❌ 推迟就是怀孕：压力、作息都会让它推迟，推算也判断不了是否怀孕。",
        "默沙东",
      ],
      [
        "❌「安全期」是安全的：只靠日历推算，常规使用一年约 12/100 会怀孕。",
        "WHO",
      ],
    ],
  },
];

function Knowledge({ heading = true }: { heading?: boolean }) {
  return (
    <section className="flex flex-col">
      {heading && <h2 className="pb-2 text-header">讲解</h2>}
      <div className="divide-y rounded-2xl border">
        {KNOWLEDGE.map((block) => (
          <details
            key={block.title}
            name="cycles-knowledge"
            className="group px-4"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-body font-medium">
              {block.title}
              <span
                aria-hidden
                className="text-muted-foreground transition-transform group-open:rotate-90"
              >
                ›
              </span>
            </summary>
            {block.title === "怎么算的" && <ExampleChart />}
            <ul className="flex flex-col gap-2 pb-4 text-sm">
              {block.lines.map(([line, source]) => (
                <li key={line}>
                  {line}{" "}
                  <a
                    href="#"
                    className="text-meta text-muted-foreground underline underline-offset-2"
                  >
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

/** 「怎么算的」里那张通用示意图：28 天的例子，排卵日、易孕期只画在这里。中性色。 */
function ExampleChart() {
  const day = (n: number) => `${((n - 1) / 28) * 100}%`;
  return (
    <figure className="flex flex-col gap-1 pb-3">
      <div className="relative h-6 overflow-hidden rounded-full bg-muted">
        <span
          className="absolute inset-y-0 bg-foreground/70"
          style={{ left: day(1), width: day(6) }}
        />
        <span
          className="absolute inset-y-0 bg-foreground/25"
          style={{ left: day(9), width: day(7) }}
        />
        <span
          className="absolute inset-y-0 w-1 bg-foreground"
          style={{ left: day(14) }}
        />
        <span
          className="absolute inset-y-0 bg-foreground/15"
          style={{ left: day(24), width: day(6) }}
        />
      </div>
      <div className="relative h-4 text-meta text-muted-foreground tabular-nums">
        <span className="absolute" style={{ left: day(1) }}>
          第 1 天
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: day(14) }}>
          14
        </span>
        <span className="absolute right-0">28</span>
      </div>
      <figcaption className="text-meta text-muted-foreground">
        28 天的例子：经期（深）、易孕期（第 9–15 天）、排卵日（第 14
        天）、经前（最后 5 天）。只是通用示意，不代表任何一位。
      </figcaption>
    </figure>
  );
}

function Disclaimer() {
  return <p className="text-meta text-muted-foreground">{DISCLAIMER}</p>;
}

function FadeNotes({ est }: { est: Estimate | null }) {
  if (!est || est.reasons.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-subtitle text-muted-foreground">
      {est.reasons.map((r) => (
        <li key={r}>
          {REASON_TEXT[r]}
          {r === "irregular" && (
            <a href="#" className="ml-1 underline underline-offset-2">
              青春期
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** 一次记录：第一天（不能晚于今天）和天数（1–10，默认当前估计的经期天数）。改的时候多一个删除。 */
function RecordDialog({
  open,
  character,
  initial,
  isEditing,
  now,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  character: Character;
  initial: Rec;
  isEditing: boolean;
  now: string;
  onClose: () => void;
  onSave: (rec: Rec) => void;
  onDelete: () => void;
}) {
  const [start, setStart] = useState(initial.start);
  const [days, setDays] = useState(initial.days);
  const [shown, setShown] = useState(initial);
  if (shown !== initial) {
    setShown(initial);
    setStart(initial.start);
    setDays(initial.days);
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={herVars(character.color)}>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? `改${character.name}的一次经期`
              : `记${character.name}的一次经期`}
          </DialogTitle>
          <DialogDescription>
            第一天按档案时区，不能晚于今天。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            第一天
            <Input
              type="date"
              max={now}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            天数
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="少一天"
                disabled={days <= 1}
                onClick={() => setDays(days - 1)}
              >
                <Minus />
              </Button>
              <span className="min-w-12 text-center text-header tabular-nums">
                {days} 天
              </span>
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="多一天"
                disabled={days >= 10}
                onClick={() => setDays(days + 1)}
              >
                <Plus />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          {isEditing && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={onDelete}
            >
              <TrashIcon />
              删除这次
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!start || start > now}
            onClick={() => onSave({ start, days })}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 记、改一次的状态：A、B、C 共用。 */
function useRecordDialog(
  character: Character | null,
  est: Estimate | null,
  now: string,
  bookApi: ReturnType<typeof useBook>,
) {
  const [editing, setEditing] = useState<{
    initial: Rec;
    replacing?: string;
  } | null>(null);
  const openNew = (start = now) =>
    setEditing({ initial: { start, days: est?.period ?? 5 } });
  const openEdit = (rec: Rec) =>
    setEditing({ initial: rec, replacing: rec.start });
  const dialog = character && (
    <RecordDialog
      open={editing !== null}
      character={character}
      initial={editing?.initial ?? { start: now, days: 5 }}
      isEditing={editing?.replacing !== undefined}
      now={now}
      onClose={() => setEditing(null)}
      onSave={(rec) => {
        bookApi.save(character.id, rec, editing?.replacing);
        setEditing(null);
      }}
      onDelete={() => {
        if (editing?.replacing) bookApi.remove(character.id, editing.replacing);
        setEditing(null);
      }}
    />
  );
  return { openNew, openEdit, dialog };
}

/** 月历：样式 fill（A：整格铺底）或 band（B：格子底部一条带）。 */
function MonthGrid({
  records,
  est,
  now,
  style,
  picked,
  onPick,
}: {
  records: Rec[];
  est: Estimate | null;
  now: string;
  style: "fill" | "band";
  picked?: string | null;
  onPick?: (date: string) => void;
}) {
  const [month, setMonth] = useState<CalendarMonth>(monthOf(now));
  const faded = (est?.reasons.length ?? 0) > 0;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="上个月"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <PreviousMonthIcon />
        </Button>
        <h2 className="min-w-28 text-center text-header tabular-nums">
          {month.year}年{month.month}月
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="下个月"
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <NextMonthIcon />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {["一", "二", "三", "四", "五", "六", "日"].map((h) => (
          <span
            key={h}
            className="bg-background py-1 text-center text-meta text-muted-foreground"
          >
            {h}
          </span>
        ))}
        {monthCells(month, now).map((cell) => {
          const kind = dayKind(cell.date, records, est);
          const isFuture = kind !== "recorded" && kind !== null;
          const prevKind = dayKind(addDays(cell.date, -1), records, est);
          const nextKind = dayKind(addDays(cell.date, 1), records, est);
          return (
            <button
              key={cell.date}
              type="button"
              aria-pressed={picked === cell.date}
              onClick={() => onPick?.(cell.date)}
              className={cn(
                "relative flex min-h-12 flex-col items-start bg-background p-1 text-left hover:bg-muted/60 md:min-h-16",
                picked === cell.date && "bg-muted",
                style === "fill" &&
                  kind === "recorded" &&
                  "bg-her-wall hover:bg-her-wall",
                style === "fill" && kind === "premenstrual" && "bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-subtitle tabular-nums",
                  !cell.isInMonth && "opacity-50",
                  cell.isToday && "bg-foreground text-background",
                  style === "fill" &&
                    kind === "recorded" &&
                    !cell.isToday &&
                    "ring-2 ring-her-mark",
                  style === "fill" &&
                    kind === "estimated" &&
                    !cell.isToday &&
                    "outline-1 outline-dashed outline-her-mark",
                  style === "fill" && isFuture && faded && "opacity-50",
                )}
              >
                {partsOf(cell.date).day}
              </span>
              {style === "fill" &&
                kind === "premenstrual" &&
                prevKind !== "premenstrual" && (
                  <span
                    className={cn(
                      "mt-auto text-meta text-muted-foreground max-md:hidden",
                      faded && "opacity-50",
                    )}
                  >
                    经前
                  </span>
                )}
              {style === "band" && kind && (
                <span
                  className={cn(
                    "absolute bottom-1.5 h-1.5",
                    prevKind === kind ? "left-0" : "left-1.5 rounded-l-full",
                    nextKind === kind ? "right-0" : "right-1.5 rounded-r-full",
                    kind === "recorded" && "bg-her-mark",
                    kind === "estimated" && "bg-her-mark/35",
                    kind === "premenstrual" && "h-0.5 bg-muted-foreground/50",
                    isFuture && faded && "opacity-50",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
      <Legend style={style} />
    </section>
  );
}

function Legend({ style }: { style: "fill" | "band" }) {
  const item = (mark: ReactNode, text: string) => (
    <span className="flex items-center gap-1.5">
      {mark}
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted-foreground">
      {style === "fill" ? (
        <>
          {item(
            <span className="size-3 rounded-full bg-her-wall ring-2 ring-her-mark" />,
            "记下的经期",
          )}
          {item(
            <span className="size-3 rounded-full outline-1 outline-dashed outline-her-mark" />,
            "推算的经期",
          )}
          {item(
            <span className="size-3 rounded-sm bg-muted ring-1 ring-border" />,
            "推算的经前",
          )}
        </>
      ) : (
        <>
          {item(
            <span className="h-1.5 w-4 rounded-full bg-her-mark" />,
            "记下的经期",
          )}
          {item(
            <span className="h-1.5 w-4 rounded-full bg-her-mark/35" />,
            "推算的经期",
          )}
          {item(
            <span className="h-0.5 w-4 rounded-full bg-muted-foreground/50" />,
            "推算的经前",
          )}
        </>
      )}
    </div>
  );
}

/** 周期、经期、平均差三格。 */
function Stats({
  est,
  compact = false,
}: {
  est: Estimate | null;
  compact?: boolean;
}) {
  const tiles: [string, string][] = [
    ["周期", est ? `约 ${est.cycle} 天` : "—"],
    ["经期", est ? `约 ${est.period} 天` : "—"],
    ["过去的估算平均差", est?.avgError != null ? `${est.avgError} 天` : "—"],
  ];
  if (compact) {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {tiles.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className="grid grid-cols-3 gap-2">
      {tiles.map(([k, v]) => (
        <div
          key={k}
          className="flex flex-col gap-0.5 rounded-xl bg-muted px-3 py-2"
        >
          <dt className="truncate text-meta text-muted-foreground">{k}</dt>
          <dd className="text-header tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 下次经期和经前一句。 */
function NextLine({ est, now }: { est: Estimate | null; now: string }) {
  if (!est)
    return (
      <p className="text-sm text-muted-foreground">
        还没记过。记下一次，这里就开始推算。
      </p>
    );
  const next = est.periods.find((p) => p.start >= now);
  if (!next) return null;
  return (
    <p className="text-sm">
      下次经期推算在{" "}
      <span className="font-medium tabular-nums">{md(next.start)}</span>（还有{" "}
      {daysBetween(now, next.start)} 天），经前从{" "}
      <span className="tabular-nums">{md(addDays(next.start, -5))}</span> 起。
    </p>
  );
}

/** 记过的经期，新的在上：第一天、天数、和上一次的间隔，点铅笔改。 */
function History({
  records,
  onEdit,
  limit,
  className,
}: {
  records: Rec[];
  onEdit: (rec: Rec) => void;
  limit?: number;
  className?: string;
}) {
  const [isAll, setAll] = useState(false);
  if (records.length === 0) return null;
  const all = records
    .map((r, i) => ({
      r,
      gap: i > 0 ? daysBetween(records[i - 1].start, r.start) : null,
    }))
    .reverse();
  // 只多 1 次时全露（同看板「展开全部 {n} 位」）。
  const folds = limit !== undefined && all.length > limit + 1;
  const rows = folds && !isAll ? all.slice(0, limit) : all;
  return (
    <section className={cn("flex flex-col gap-1", className)}>
      <h2 className="pb-1 text-header">记过的经期</h2>
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {rows.map(({ r, gap }) => (
          <div
            key={r.start}
            className="flex min-h-11 items-center gap-3 rounded-lg px-1 hover:bg-muted/60"
          >
            <span className="w-16 shrink-0 text-sm tabular-nums">
              {md(r.start)}
            </span>
            <span className="flex-1 text-subtitle text-muted-foreground tabular-nums">
              {r.days} 天{gap !== null && ` · 隔 ${gap} 天`}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`改${md(r.start)}这次`}
              onClick={() => onEdit(r)}
            >
              <Pencil />
            </Button>
          </div>
        ))}
      </div>
      {folds && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setAll(!isAll)}
        >
          {isAll ? "收起" : `展开全部 ${all.length} 次`}
        </Button>
      )}
    </section>
  );
}

// ───────────────────────────── 入口 ─────────────────────────────

export function CyclesPrototype({ search }: { search: Search }) {
  const router = useRouter();
  const { characters } = useDirectory();
  const variant = typeof search.variant === "string" ? search.variant : "D";
  const who = typeof search.who === "string" ? search.who : null;
  const bookApi = useBook(characters);
  const go = (next: { variant?: string; who?: string | null }) => {
    const params = new URLSearchParams();
    params.set("variant", next.variant ?? variant);
    const w = next.who === undefined ? who : next.who;
    if (w) params.set("who", w);
    router.replace(`${playHref("cycles")}?${params}`, { scroll: false });
  };
  const switcher = (
    <PrototypeSwitcher
      variants={VARIANTS}
      current={variant}
      onChange={(v) => go({ variant: v })}
    />
  );
  if (!characters) {
    return (
      <PlayShell header={<SubpageHeader title="周期" backHref={playHref()} />}>
        <p className="text-body text-muted-foreground">正在读取</p>
      </PlayShell>
    );
  }
  const her = characters.find((c) => c.id === who) ?? null;
  const props = {
    characters,
    her,
    bookApi,
    pick: (id: string | null) => go({ who: id }),
  };
  return (
    <>
      {variant === "B" ? (
        <VariantB {...props} />
      ) : variant === "C" ? (
        <VariantC {...props} />
      ) : variant === "D" ? (
        <VariantD {...props} />
      ) : (
        <VariantA {...props} />
      )}
      {switcher}
    </>
  );
}

type VariantProps = {
  characters: Character[];
  her: Character | null;
  bookApi: ReturnType<typeof useBook>;
  pick: (id: string | null) => void;
};

// ───────────────────────────── A 名单进人 ─────────────────────────────

function VariantA({ characters, her, bookApi, pick }: VariantProps) {
  const { now } = bookApi;
  if (!her) {
    const rows = characters.map((c) => ({ c, recs: bookApi.records(c.id) }));
    const recorded = rows
      .filter((r) => r.recs.length > 0)
      .map((r) => ({
        ...r,
        next:
          estimate(r.recs, now)?.periods.find((p) => p.start >= now)?.start ??
          "",
      }))
      .sort((a, b) => a.next.localeCompare(b.next));
    const others = rows.filter((r) => r.recs.length === 0);
    const row = ({ c, recs }: { c: Character; recs: Rec[] }) => (
      <button
        key={c.id}
        type="button"
        onClick={() => pick(c.id)}
        className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/60"
      >
        <MarkedAvatar name={c.name} src={c.avatar_url} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-row-name">{c.name}</span>
          <span className="truncate text-subtitle text-muted-foreground">
            {herStatus(recs, now)}
          </span>
        </span>
        <ForwardIcon
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground"
        />
      </button>
    );
    return (
      <PlayShell header={<SubpageHeader title="周期" backHref={playHref()} />}>
        <p className="text-sm text-muted-foreground">{LEAD}</p>
        {recorded.length > 0 && (
          <div className="flex flex-col">{recorded.map(row)}</div>
        )}
        <section className="flex flex-col">
          <h2 className="px-2 pb-1 text-subtitle text-muted-foreground">
            还没记过
          </h2>
          {others.map(row)}
        </section>
        <Disclaimer />
      </PlayShell>
    );
  }
  return <HerPageA her={her} bookApi={bookApi} onBack={() => pick(null)} />;
}

function HerPageA({
  her,
  bookApi,
  onBack,
}: {
  her: Character;
  bookApi: VariantProps["bookApi"];
  onBack: () => void;
}) {
  const { now } = bookApi;
  const records = bookApi.records(her.id);
  const est = estimate(records, now);
  const { openNew, openEdit, dialog } = useRecordDialog(her, est, now, bookApi);
  return (
    <PlayShell
      header={
        <div className="flex w-full items-center gap-2">
          <Button
            variant="ghost"
            size="icon-lg"
            className="-ml-2"
            aria-label="返回"
            onClick={onBack}
          >
            <BackIcon />
          </Button>
          <MarkedAvatar name={her.name} src={her.avatar_url} size="sm" />
          <h1 className="min-w-0 flex-1 truncate text-header">{her.name}</h1>
          <Button
            size="sm"
            style={herVars(her.color)}
            onClick={() => openNew()}
          >
            <Plus />
            记一次
          </Button>
        </div>
      }
      overlays={dialog}
    >
      <div style={herVars(her.color)} className="flex flex-col gap-4">
        <Stats est={est} />
        <div className="flex flex-col gap-1">
          <NextLine est={est} now={now} />
          <FadeNotes est={est} />
        </div>
        <MonthGrid records={records} est={est} now={now} style="fill" />
        <History records={records} onEdit={openEdit} />
        <Knowledge />
        <Disclaimer />
      </div>
    </PlayShell>
  );
}

// ───────────────────────────── B 一屏月历 ─────────────────────────────

function VariantB({ characters, her: picked, bookApi, pick }: VariantProps) {
  const { now } = bookApi;
  const her = picked ?? characters[0];
  const records = bookApi.records(her.id);
  const est = estimate(records, now);
  const [day, setDay] = useState<string | null>(null);
  const { openNew, openEdit, dialog } = useRecordDialog(her, est, now, bookApi);
  const isWide = useWide();
  const onDay = day
    ? records.find((r) => day >= r.start && day < addDays(r.start, r.days))
    : undefined;
  const kind = day ? dayKind(day, records, est) : null;
  const side = (
    <div className="flex flex-col gap-4">
      <Stats est={est} compact />
      <FadeNotes est={est} />
      <History records={records} onEdit={openEdit} />
      <Knowledge />
      <Disclaimer />
    </div>
  );
  return (
    <PlayShell
      header={<SubpageHeader title="周期" backHref={playHref()} />}
      overlays={dialog}
    >
      <p className="text-sm text-muted-foreground">{LEAD}</p>
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
        {characters.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === her.id}
            onClick={() => {
              setDay(null);
              pick(c.id);
            }}
            className={cn(
              "flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl py-2 hover:bg-muted/60",
              c.id === her.id && "bg-muted hover:bg-muted",
            )}
          >
            <MarkedAvatar name={c.name} src={c.avatar_url} />
            <span className="w-full truncate px-1 text-center text-meta">
              {c.short_name ?? c.name}
            </span>
          </button>
        ))}
      </div>
      <div
        style={herVars(her.color)}
        className="grid gap-6 md:grid-cols-[1fr_15rem]"
      >
        <div className="flex flex-col gap-3">
          <NextLine est={est} now={now} />
          <MonthGrid
            records={records}
            est={est}
            now={now}
            style="band"
            picked={day}
            onPick={setDay}
          />
          <div className="flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2">
            {day ? (
              <>
                <span className="flex-1 text-sm">
                  <span className="tabular-nums">{md(day)}</span>
                  <span className="text-muted-foreground">
                    {kind === "recorded"
                      ? " · 记下的经期"
                      : kind === "estimated"
                        ? " · 推算的经期"
                        : kind === "premenstrual"
                          ? " · 推算的经前"
                          : ""}
                  </span>
                </span>
                {onDay ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(onDay)}
                  >
                    <Pencil />
                    改这次
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={day > now}
                    onClick={() => openNew(day)}
                  >
                    <Plus />
                    {day > now ? "不能记未来" : "这天是第一天"}
                  </Button>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                点一天来记下她这次经期的第一天。
              </span>
            )}
          </div>
        </div>
        {isWide ? side : <div className="flex flex-col gap-4">{side}</div>}
      </div>
    </PlayShell>
  );
}

// ───────────────────────────── C 圆盘和周期条 ─────────────────────────────

function VariantC({ characters, her: picked, bookApi, pick }: VariantProps) {
  const { now } = bookApi;
  const her = picked ?? characters[0];
  const records = bookApi.records(her.id);
  const est = estimate(records, now);
  const [tab, setTab] = useState<"estimate" | "learn">("estimate");
  const [choosing, setChoosing] = useState(false);
  const { openNew, openEdit, dialog } = useRecordDialog(her, est, now, bookApi);
  const tabs = (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[tab]}
      onValueChange={(v) => v[0] && setTab(v[0] as "estimate" | "learn")}
    >
      <ToggleGroupItem value="estimate">推算</ToggleGroupItem>
      <ToggleGroupItem value="learn">讲解</ToggleGroupItem>
    </ToggleGroup>
  );
  const chooser = (
    <Dialog open={choosing} onOpenChange={setChoosing}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>看谁的周期</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-4 gap-x-2 gap-y-3 overflow-y-auto">
          {characters.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === her.id}
              onClick={() => {
                pick(c.id);
                setChoosing(false);
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-2 hover:bg-muted/60",
                c.id === her.id && "bg-muted",
              )}
            >
              <MarkedAvatar name={c.name} src={c.avatar_url} />
              <span className="w-full truncate px-1 text-center text-subtitle">
                {c.short_name ?? c.name}
              </span>
              <span className="w-full truncate px-1 text-center text-meta text-muted-foreground">
                {bookApi.records(c.id).length > 0
                  ? herStatus(bookApi.records(c.id), now).replace(/^推算 /, "")
                  : "没记过"}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
  return (
    <PlayShell
      header={<SubpageHeader title="周期" backHref={playHref()} end={tabs} />}
      overlays={[chooser, dialog]}
    >
      {tab === "learn" ? (
        <>
          <p className="text-sm text-muted-foreground">{LEAD}</p>
          <Knowledge heading={false} />
          <Disclaimer />
        </>
      ) : (
        <div style={herVars(her.color)} className="flex flex-col gap-5">
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="flex min-h-11 items-center gap-3 self-start rounded-full border py-1 pr-4 pl-1 hover:bg-muted/60"
          >
            <MarkedAvatar name={her.name} src={her.avatar_url} size="sm" />
            <span className="text-sm font-medium">{her.name}</span>
            <span className="text-meta text-muted-foreground">换一位 ▾</span>
          </button>
          <Ring records={records} est={est} now={now} />
          <FadeNotes est={est} />
          <div className="flex items-center justify-between">
            <h2 className="text-header">一个个周期</h2>
            <Button size="sm" onClick={() => openNew()}>
              <Plus />
              记一次
            </Button>
          </div>
          <CycleBars records={records} est={est} now={now} onEdit={openEdit} />
          <Disclaimer />
        </div>
      )}
    </PlayShell>
  );
}

/** 周期圆盘：一圈是一个推算的周期，经期一段实色、经前一段淡色，今天一个点。 */
function Ring({
  records,
  est,
  now,
}: {
  records: Rec[];
  est: Estimate | null;
  now: string;
}) {
  const size = 220;
  const r = 90;
  const len = 2 * Math.PI * r;
  if (!est) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-header">还没记过</p>
        <p className="text-sm text-muted-foreground">{LEAD}</p>
      </div>
    );
  }
  const last = records[records.length - 1];
  const day = daysBetween(last.start, now) + 1;
  const cycle = est.cycle;
  const arc = (from: number, days: number) => ({
    strokeDasharray: `${(days / cycle) * len} ${len}`,
    strokeDashoffset: `${-((from - 1) / cycle) * len}`,
  });
  const angle =
    ((Math.min(day, cycle) - 0.5) / cycle) * 2 * Math.PI - Math.PI / 2;
  const next = est.periods.find((p) => p.start >= now);
  const faded = est.reasons.length > 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          fill="none"
          strokeWidth={16}
        >
          <circle cx={size / 2} cy={size / 2} r={r} className="stroke-muted" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className="stroke-her-mark"
            style={arc(1, last.days)}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className={cn(
              "stroke-her-mark",
              faded ? "opacity-15" : "opacity-30",
            )}
            style={arc(cycle - 4, 5)}
          />
        </g>
        <circle
          cx={size / 2 + r * Math.cos(angle)}
          cy={size / 2 + r * Math.sin(angle)}
          r={9}
          className="fill-foreground stroke-background"
          strokeWidth={3}
        />
        <text
          x="50%"
          y="44%"
          textAnchor="middle"
          className="fill-foreground text-2xl font-semibold tabular-nums"
        >
          第 {day} 天
        </text>
        <text
          x="50%"
          y="56%"
          textAnchor="middle"
          className="fill-muted-foreground text-subtitle"
        >
          约 {cycle} 天一个周期
        </text>
        {next && (
          <text
            x="50%"
            y="66%"
            textAnchor="middle"
            className="fill-muted-foreground text-subtitle"
          >
            下次 {md(next.start)} · 还有 {daysBetween(now, next.start)} 天
          </text>
        )}
      </svg>
      <div className="flex gap-4 text-meta text-muted-foreground">
        <span>经期 约 {est.period} 天</span>
        <span>经前 5 天</span>
        <span>平均差 {est.avgError != null ? `${est.avgError} 天` : "—"}</span>
      </div>
    </div>
  );
}

/** 一个周期一行：左边第一天，条的长度是周期长度，经期一段实色、经前一段淡；往后 3 个推算的淡下去。 */
function CycleBars({
  records,
  est,
  now,
  onEdit,
}: {
  records: Rec[];
  est: Estimate | null;
  now: string;
  onEdit: (rec: Rec) => void;
}) {
  if (!est) return null;
  const max = 45;
  const rows = [
    ...records.map((r, i) => ({
      start: r.start,
      days: r.days,
      length:
        i + 1 < records.length
          ? daysBetween(r.start, records[i + 1].start)
          : est.cycle,
      rec: r as Rec | null,
      isCurrent: i + 1 === records.length,
    })),
    ...est.periods.map((p) => ({
      start: p.start,
      days: p.days,
      length: est.cycle,
      rec: null,
      isCurrent: false,
    })),
  ].reverse();
  const faded = est.reasons.length > 0;
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.start} className="flex min-h-11 items-center gap-3">
          <span
            className={cn(
              "w-16 shrink-0 text-sm tabular-nums",
              !row.rec && "text-muted-foreground",
            )}
          >
            {md(row.start)}
          </span>
          <div
            className={cn(
              "relative h-3 flex-1",
              !row.rec && faded && "opacity-50",
            )}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                row.rec ? "bg-muted" : "border border-dashed",
              )}
              style={{ width: `${(row.length / max) * 100}%` }}
            />
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                row.rec ? "bg-her-mark" : "bg-her-mark/35",
              )}
              style={{ width: `${(row.days / max) * 100}%` }}
            />
            <div
              className="absolute inset-y-0 rounded-r-full bg-her-mark/15"
              style={{
                left: `${((row.length - 5) / max) * 100}%`,
                width: `${(5 / max) * 100}%`,
              }}
            />
            {row.isCurrent && (
              <div
                className="absolute -inset-y-1 w-0.5 bg-foreground"
                style={{
                  left: `${(Math.min(daysBetween(row.start, now), row.length) / max) * 100}%`,
                }}
              />
            )}
          </div>
          <span className="w-20 shrink-0 text-right text-meta text-muted-foreground tabular-nums">
            {row.rec
              ? row.isCurrent
                ? `${row.days} 天 · 这一轮`
                : `${row.days} / ${row.length} 天`
              : "推算"}
          </span>
          {row.rec ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`改${md(row.start)}这次`}
              onClick={() => onEdit(row.rec!)}
            >
              <Pencil />
            </Button>
          ) : (
            <span className="size-7 shrink-0" />
          )}
        </li>
      ))}
    </ol>
  );
}

// ───────────────────────────── D B 改 ─────────────────────────────

type Shown = "all" | "recorded" | "now" | "unrecorded";

const SHOWN: { value: Shown; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "recorded", label: "记过的" },
  { value: "now", label: "推算在经前、经期的" },
  { value: "unrecorded", label: "还没记过的" },
];

function isShown(shown: Shown, records: Rec[], now: string): boolean {
  if (shown === "all") return true;
  if (shown === "unrecorded") return records.length === 0;
  if (shown === "recorded") return records.length > 0;
  return dayKind(now, records, estimate(records, now)) !== null;
}

/** 筛选键：同对话列表（36px ghost 图标键，宽屏 Popover、窄屏 Drawer）；不是「全部」时右上角一个中性小点。 */
function ShownFilter({
  shown,
  onChange,
  counts,
}: {
  shown: Shown;
  onChange: (s: Shown) => void;
  counts: Record<Shown, number>;
}) {
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const label =
    shown === "all"
      ? "筛选"
      : `筛选，只看${SHOWN.find((x) => x.value === shown)?.label}`;
  const icon = (
    <>
      <FilterIcon />
      {shown !== "all" && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-muted-foreground"
        />
      )}
    </>
  );
  const choices = (
    <RadioGroup
      value={shown}
      onValueChange={(v) => {
        onChange(v as Shown);
        setOpen(false);
      }}
      className="gap-1"
    >
      {SHOWN.map((x) => (
        <label
          key={x.value}
          className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted/60"
        >
          <RadioGroupItem value={x.value} />
          <span className="flex-1">{x.label}</span>
          <span className="text-meta text-muted-foreground tabular-nums">
            {counts[x.value]} 位
          </span>
        </label>
      ))}
    </RadioGroup>
  );
  if (wide) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={label}
              className="relative"
            />
          }
        >
          {icon}
        </PopoverTrigger>
        <PopoverContent align="end">
          <PopoverHeader>
            <PopoverTitle>头像条里显示谁</PopoverTitle>
          </PopoverHeader>
          {choices}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={label}
        className="relative"
        onClick={() => setOpen(true)}
      >
        {icon}
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>头像条里显示谁</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{choices}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function VariantD({ characters, her: picked, bookApi, pick }: VariantProps) {
  const { now } = bookApi;
  const her = picked ?? characters[0];
  const records = bookApi.records(her.id);
  const est = estimate(records, now);
  const [day, setDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<Shown>("all");
  const { openNew, openEdit, dialog } = useRecordDialog(her, est, now, bookApi);
  const onDay = day
    ? records.find((r) => day >= r.start && day < addDays(r.start, r.days))
    : undefined;
  const kind = day ? dayKind(day, records, est) : null;
  const counts = Object.fromEntries(
    SHOWN.map((x) => [
      x.value,
      characters.filter((c) => isShown(x.value, bookApi.records(c.id), now))
        .length,
    ]),
  ) as Record<Shown, number>;
  // 搜索时不看筛选（同对话列表：搜索时隐藏的人照样出现）；选中的她始终留在条里。
  const strip = characters.filter(
    (c) =>
      c.id === her.id ||
      (query.trim()
        ? matchesSearch(c, query)
        : isShown(shown, bookApi.records(c.id), now)),
  );
  const noMatch =
    query.trim() !== "" && !characters.some((c) => matchesSearch(c, query));
  return (
    <PlayShell
      header={<SubpageHeader title="周期" backHref={playHref()} />}
      overlays={dialog}
    >
      <p className="text-sm text-muted-foreground">{LEAD}</p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-muted px-3 text-muted-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <SearchIcon aria-hidden className="size-4 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索名字或组合"
              aria-label="搜索名字或组合"
              className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <ShownFilter shown={shown} onChange={setShown} counts={counts} />
        </div>
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
          {strip.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === her.id}
              onClick={() => {
                setDay(null);
                pick(c.id);
              }}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl py-2 hover:bg-muted/60",
                c.id === her.id && "bg-muted hover:bg-muted",
              )}
            >
              <MarkedAvatar name={c.name} src={c.avatar_url} />
              <span className="w-full truncate px-1 text-center text-meta">
                {c.short_name ?? c.name}
              </span>
            </button>
          ))}
          {noMatch && (
            <p className="self-center px-2 text-sm text-muted-foreground">
              没有找到这位偶像
            </p>
          )}
        </div>
      </div>
      <div
        style={herVars(her.color)}
        className="grid items-start gap-6 md:grid-cols-[1fr_15rem]"
      >
        <div className="flex flex-col gap-3">
          <NextLine est={est} now={now} />
          <MonthGrid
            records={records}
            est={est}
            now={now}
            style="fill"
            picked={day}
            onPick={setDay}
          />
          <div className="flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2">
            {day ? (
              <>
                <span className="flex-1 text-sm">
                  <span className="tabular-nums">{md(day)}</span>
                  <span className="text-muted-foreground">
                    {kind === "recorded"
                      ? " · 记下的经期"
                      : kind === "estimated"
                        ? " · 推算的经期"
                        : kind === "premenstrual"
                          ? " · 推算的经前"
                          : ""}
                  </span>
                </span>
                {onDay ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(onDay)}
                  >
                    <Pencil />
                    改这次
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={day > now}
                    onClick={() => openNew(day)}
                  >
                    <Plus />
                    {day > now ? "不能记未来" : "这天是第一天"}
                  </Button>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                点一天来记下她这次经期的第一天。
              </span>
            )}
          </div>
        </div>
        {/* 电脑上右栏不比左栏高：高度跟着月历那一栏，记录展开后在栏里滚。 */}
        <div className="md:relative md:self-stretch">
          <div className="flex flex-col gap-4 md:absolute md:inset-0">
            <Stats est={est} compact />
            <FadeNotes est={est} />
            <History
              records={records}
              onEdit={openEdit}
              limit={3}
              className="md:min-h-0 md:flex-1"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 pt-2">
        <Knowledge />
        <Disclaimer />
      </div>
    </PlayShell>
  );
}
