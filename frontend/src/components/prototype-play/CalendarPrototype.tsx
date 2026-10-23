"use client";

// PROTOTYPE（play-and-schedule 票 07「原型：日历和排日程的界面」）：只在 prototype/calendar-schedule 分支，不进 main。
// 挂在玩法页变体 A 的「日历」子页（/gifts?variant=A&col=calendar），三个方案用 ?cal=A|B|C 切，底部切换条切的是它。
// 数据全是写死的假数据，存在内存里（草稿正式版存本机，这里刷新就没了）。上面黄框是原型自己的控制：模拟此刻、北京以西。
//
// A 点格子：默认周视图，点空格从抽屉里挑一项；保存前先剔掉已经开始的（确认框不列，写一句）。
// B 先挑工作：待排的工作摆在格子旁边（手机上是一排横滑），选中一项，格子里能放的地方亮起来，点一下放进去；
//   确认框列出全部草稿，确认后已经开始的退回待排、提示一句。
// C 月历为主：默认月视图，点一天在下面看这天的三个时间段，从那里排；周视图是一列一列的日程表，不是格子；
//   待排的每一项有「排到…」，列出能放的时间段。

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { MarkedAvatar } from "@/components/app/MarkedAvatar";
import { useDirectory } from "@/components/conversations/ConversationDirectory";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { herVars } from "@/theme/herVars";
import {
  AppearanceJobIcon,
  BackIcon,
  BirthdayIcon,
  BusinessJobIcon,
  FailureIcon,
  FilterIcon,
  ForwardIcon,
  HolidayIcon,
  LockedIcon,
  PracticeJobIcon,
  PrivateJobIcon,
  AddIcon,
} from "@/theme/icons";

export const CAL_VARIANTS = [
  { key: "D", name: "定稿：电脑 B、手机 A" },
  { key: "A", name: "点格子挑工作" },
  { key: "B", name: "先挑工作再放" },
  { key: "C", name: "月历为主，按天排" },
];

// ─── 假数据 ────────────────────────────────────────────────────────────────

type Cat = "练习" | "出镜" | "事务" | "私人";
type Slot = 0 | 1 | 2;
type Job = { id: string; idol: string; name: string; note: string; cat: Cat; len: 1 | 2 | 3; only?: Slot[] };
type Placement = { jobId: string; day: number; slot: Slot };
type Now = { day: number; slot: Slot | null };
type Filter = "birthday" | "producer" | "holiday" | "schedule";

const SLOTS = [
  { name: "上午", hours: "6–12" },
  { name: "下午", hours: "12–18" },
  { name: "晚上", hours: "18–24" },
] as const;
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const CAT_ICON = { 练习: PracticeJobIcon, 出镜: AppearanceJobIcon, 事务: BusinessJobIcon, 私人: PrivateJobIcon };

/** 本周一是 2026-10-19，今天是周五 10-23。 */
const MONDAY = new Date(2026, 9, 19);

const WEEK_JOBS: Job[][] = [
  [
    { id: "mano-1", idol: "真乃", name: "声乐课", note: "在录音棚上两小时的声乐课。", cat: "练习", len: 1 },
    { id: "mano-2", idol: "真乃", name: "外景拍摄", note: "为杂志拍一整天的外景，地点在海边公园。", cat: "出镜", len: 3 },
    { id: "hiori-1", idol: "灯織", name: "舞蹈课", note: "基础舞蹈课，练新曲的走位。", cat: "练习", len: 1 },
    { id: "hiori-2", idol: "灯織", name: "广播录音", note: "录一期深夜广播的嘉宾环节。", cat: "出镜", len: 1, only: [1, 2] },
    { id: "hiori-3", idol: "灯織", name: "商谈", note: "和品牌方谈一次合作。", cat: "事务", len: 1, only: [0, 1] },
    { id: "meguru-1", idol: "めぐる", name: "综艺录制", note: "录一档游戏综艺，半天。", cat: "出镜", len: 2 },
    { id: "meguru-2", idol: "めぐる", name: "和朋友吃饭", note: "和同学出去吃饭。", cat: "私人", len: 1, only: [1, 2] },
    { id: "kogane-1", idol: "恋鐘", name: "排练", note: "演唱会前的整段排练。", cat: "练习", len: 2 },
    { id: "kogane-2", idol: "恋鐘", name: "采访", note: "音乐杂志的一次采访。", cat: "出镜", len: 1 },
    { id: "tenka-1", idol: "甜花", name: "写真拍摄", note: "拍写真集的一整天。", cat: "出镜", len: 3 },
    { id: "tenka-2", idol: "甜花", name: "声乐课", note: "一对一的声乐课。", cat: "练习", len: 1 },
    { id: "amana-1", idol: "甘奈", name: "杂志采访", note: "时尚杂志的小采访。", cat: "出镜", len: 1 },
    { id: "amana-2", idol: "甘奈", name: "买东西", note: "去商场逛逛、买点东西。", cat: "私人", len: 1, only: [1, 2] },
    { id: "amana-3", idol: "甘奈", name: "舞蹈课", note: "新曲的舞蹈课，半天。", cat: "练习", len: 2 },
    { id: "asahi-1", idol: "あさひ", name: "舞蹈课", note: "舞蹈课，半天。", cat: "练习", len: 2 },
    { id: "asahi-2", idol: "あさひ", name: "试镜", note: "一部电视剧的试镜。", cat: "事务", len: 1 },
    { id: "asahi-3", idol: "あさひ", name: "开会", note: "和事务所开会，定下个月的安排。", cat: "事务", len: 1, only: [0, 1] },
  ],
  [
    { id: "rinze-1", idol: "凛世", name: "茶道体验", note: "为节目录一段茶道体验。", cat: "出镜", len: 2 },
    { id: "rinze-2", idol: "凛世", name: "声乐课", note: "声乐课。", cat: "练习", len: 1 },
    { id: "natsuha-1", idol: "夏葉", name: "健身拍摄", note: "运动品牌的广告拍摄，一整天。", cat: "出镜", len: 3 },
    { id: "natsuha-2", idol: "夏葉", name: "开会", note: "和事务所开会。", cat: "事务", len: 1, only: [0, 1] },
    { id: "chiyoko-1", idol: "智代子", name: "舞蹈课", note: "舞蹈课，半天。", cat: "练习", len: 2 },
    { id: "chiyoko-2", idol: "智代子", name: "去甜品店", note: "去新开的甜品店。", cat: "私人", len: 1, only: [1, 2] },
    { id: "kaho-1", idol: "果穂", name: "综艺录制", note: "录一档儿童节目。", cat: "出镜", len: 2, only: [0, 1] },
    { id: "kaho-2", idol: "果穂", name: "排练", note: "排练。", cat: "练习", len: 1 },
    { id: "kiriko-1", idol: "霧子", name: "采访", note: "杂志采访。", cat: "出镜", len: 1 },
    { id: "kiriko-2", idol: "霧子", name: "声乐课", note: "声乐课。", cat: "练习", len: 1 },
    { id: "toru-1", idol: "透", name: "杂志拍摄", note: "拍杂志封面，一整天。", cat: "出镜", len: 3 },
    { id: "toru-2", idol: "透", name: "试镜", note: "广告试镜。", cat: "事务", len: 1 },
    { id: "madoka-1", idol: "円香", name: "广播录音", note: "录广播。", cat: "出镜", len: 2, only: [1, 2] },
    { id: "madoka-2", idol: "円香", name: "舞蹈课", note: "舞蹈课。", cat: "练习", len: 1 },
  ],
];

/** 一开始就保存过的几项：周一上午灯織的舞蹈课（做完了）、周三甜花一整天的写真（做完了）、周六晚上恋鐘的采访（还没到）。 */
const INITIAL_SAVED: Placement[][] = [
  [
    { jobId: "hiori-1", day: 0, slot: 0 },
    { jobId: "tenka-1", day: 2, slot: 0 },
    { jobId: "kogane-2", day: 5, slot: 2 },
  ],
  [],
];

const HOLIDAYS: Record<string, string> = {
  "2026-09-21": "敬老の日",
  "2026-09-22": "国民の休日",
  "2026-09-23": "秋分の日",
  "2026-10-12": "スポーツの日",
  "2026-11-03": "文化の日",
  "2026-11-23": "勤労感謝の日",
};
const BIRTHDAYS: Record<string, string[]> = {
  "09-08": ["緋田美琴"],
  "09-23": ["幽谷霧子"],
  "10-02": ["鈴木羽那"],
  "10-19": ["杜野凛世"],
  "10-27": ["樋口円香"],
  "11-11": ["福丸小糸"],
  "11-26": ["西城樹里"],
  "12-04": ["黛冬優子"],
  "12-25": ["大崎甜花", "大崎甘奈"],
};
const PRODUCER_BIRTHDAY = "10-30";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (week: number, day: number) => new Date(2026, 9, 19 + week * 7 + day);
const dayLabel = (week: number, day: number) => `${WEEKDAYS[day]} ${dateOf(week, day).getMonth() + 1}月${dateOf(week, day).getDate()}日`;
const jobOf = (week: number, id: string) => WEEK_JOBS[week].find((j) => j.id === id)!;
const cellsOf = (week: number, p: Placement) =>
  Array.from({ length: jobOf(week, p.jobId).len }, (_, k) => ({ day: p.day, slot: (p.slot + k) as Slot }));
const slotRange = (job: Job, slot: Slot) =>
  job.len === 3 ? "全天" : job.len === 2 ? `${SLOTS[slot].name}和${SLOTS[slot + 1].name}` : SLOTS[slot].name;

// ─── 她的颜色和头像 ─────────────────────────────────────────────────────────
// 每一项单独注入一次 herVars(官方色)，用 her-wall 当底、her-mark 当竖条和圆点（同统计页的排行）。
// 正式版要先改 DESIGN.md 的 The Her-Colour-Only-Here Rule，把日历加进去。

/** 短名（工作里写的）和全名（生日里写的）→ 角色 id。 */
const CID: Record<string, string> = {
  真乃: "mano", 灯織: "hiori", めぐる: "meguru", 恋鐘: "kogane", 甜花: "tenka", 甘奈: "amana", あさひ: "asahi",
  凛世: "rinze", 夏葉: "natsuha", 智代子: "chiyoko", 果穂: "kaho", 霧子: "kiriko", 透: "toru", 円香: "madoka",
  緋田美琴: "mikoto", 幽谷霧子: "kiriko", 鈴木羽那: "hana", 杜野凛世: "rinze", 樋口円香: "madoka", 福丸小糸: "koito",
  西城樹里: "juri", 黛冬優子: "fuyuko", 大崎甜花: "tenka", 大崎甘奈: "amana",
};
type Look = { style: CSSProperties | undefined; avatar: string | null; full: string };
const LooksContext = createContext<(name: string) => Look>((name) => ({ style: undefined, avatar: null, full: name }));
const useLook = (name: string) => useContext(LooksContext)(name);
const useLooks = () => useContext(LooksContext);

function LooksProvider({ children }: { children: ReactNode }) {
  const { characters } = useDirectory();
  const look = (name: string): Look => {
    const c = characters?.find((x) => x.id === CID[name]);
    return c ? { style: herVars(c.color), avatar: c.avatar_url, full: c.name } : { style: undefined, avatar: null, full: name };
  };
  return <LooksContext.Provider value={look}>{children}</LooksContext.Provider>;
}

/** 屏宽到 md（768px）没有。 */
function useIsWide() {
  const [isWide, setWide] = useState(true);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 768px)");
    setWide(q.matches);
    const on = () => setWide(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return isWide;
}

// ─── 状态 ──────────────────────────────────────────────────────────────────

type Store = {
  now: Now;
  isWest: boolean;
  saved: Placement[][];
  drafts: Placement[][];
  filters: Set<Filter>;
};

function timeOf(now: Now, week: number, day: number, slot: Slot): "past" | "now" | "future" {
  if (week > 0) return "future";
  if (day < now.day) return "past";
  if (day > now.day) return "future";
  if (now.slot === null) return "future";
  return slot < now.slot ? "past" : slot === now.slot ? "now" : "future";
}

function useSchedule() {
  const [store, setStore] = useState<Store>({
    now: { day: 4, slot: 1 },
    isWest: false,
    saved: INITIAL_SAVED,
    drafts: [[], []],
    filters: new Set<Filter>(["birthday", "producer", "holiday", "schedule"]),
  });
  const [week, setWeek] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const shownWeek = store.isWest ? week : 0;

  const placements = (w: number) => [
    ...store.saved[w].map((p) => ({ ...p, isSaved: true })),
    ...store.drafts[w].map((p) => ({ ...p, isSaved: false })),
  ];
  /** 格子 → 占着它的那一项。 */
  const occupant = (w: number, day: number, slot: Slot) =>
    placements(w).find((p) => cellsOf(w, p).some((c) => c.day === day && c.slot === slot)) ?? null;
  const placed = (w: number, jobId: string) => placements(w).find((p) => p.jobId === jobId) ?? null;
  const pending = (w: number) => WEEK_JOBS[w].filter((j) => !placed(w, j.id));
  const hasStarted = (w: number, p: Placement) => cellsOf(w, p).some((c) => timeOf(store.now, w, c.day, c.slot) !== "future");

  /** 这一项能不能从这一格开始排；不能就给一句原因。 */
  const whyNot = (w: number, job: Job, day: number, slot: Slot): string | null => {
    if (slot + job.len > 3) return job.len === 3 ? "一整天的工作只能从上午排" : "当天排不下";
    for (let k = 0; k < job.len; k++) {
      const s = (slot + k) as Slot;
      const t = timeOf(store.now, w, day, s);
      if (t === "past") return "已经过了";
      if (t === "now") return "正在进行";
      if (job.only && !job.only.includes(s)) return `只能排在${job.only.map((x) => SLOTS[x].name).join("、")}`;
      const o = occupant(w, day, s);
      if (o && o.jobId !== job.id) return "格子里有别的工作";
    }
    return null;
  };
  const startsFor = (w: number, job: Job) =>
    Array.from({ length: 7 }, (_, day) => [0, 1, 2].map((slot) => ({ day, slot: slot as Slot }))).flat()
      .filter((c) => whyNot(w, job, c.day, c.slot) === null);
  const freeLeft = (w: number) =>
    Array.from({ length: 21 }, (_, i) => ({ day: Math.floor(i / 3), slot: (i % 3) as Slot })).filter(
      (c) => timeOf(store.now, w, c.day, c.slot) === "future" && !occupant(w, c.day, c.slot),
    ).length;

  const setDrafts = (w: number, next: Placement[]) =>
    setStore((s) => ({ ...s, drafts: s.drafts.map((d, i) => (i === w ? next : d)) }));
  const place = (w: number, jobId: string, day: number, slot: Slot) =>
    setDrafts(w, [...store.drafts[w].filter((p) => p.jobId !== jobId), { jobId, day, slot }]);
  const unplace = (w: number, jobId: string) => setDrafts(w, store.drafts[w].filter((p) => p.jobId !== jobId));

  /** 保存：已经开始的退回待排，其余锁住。 */
  const save = (w: number) => {
    const ok = store.drafts[w].filter((p) => !hasStarted(w, p));
    const started = store.drafts[w].filter((p) => hasStarted(w, p));
    setStore((s) => ({
      ...s,
      saved: s.saved.map((d, i) => (i === w ? [...d, ...ok] : d)),
      drafts: s.drafts.map((d, i) => (i === w ? [] : d)),
    }));
    return { ok, started };
  };

  return {
    store,
    setStore,
    week: shownWeek,
    setWeek,
    notice,
    setNotice,
    placements,
    occupant,
    placed,
    pending,
    hasStarted,
    whyNot,
    startsFor,
    freeLeft,
    place,
    unplace,
    save,
  };
}

type Schedule = ReturnType<typeof useSchedule>;

// ─── 入口 ──────────────────────────────────────────────────────────────────

/** 日历子页的内容。header 的右端由这里决定，所以整块交给调用处的 render。 */
export function CalendarPrototype({
  variant,
  frame,
}: {
  variant: string;
  frame: (end: ReactNode, body: ReactNode, footer: ReactNode) => ReactNode;
}) {
  const s = useSchedule();
  const [view, setView] = useState<"month" | "week">(variant === "C" ? "month" : "week");
  const [month, setMonth] = useState({ y: 2026, m: 9 });
  const [pickedDay, setPickedDay] = useState<string>("2026-10-23");
  const viewToggle = (
    <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as "month" | "week")} variant="outline" size="sm">
      <ToggleGroupItem value="month">月</ToggleGroupItem>
      <ToggleGroupItem value="week">周</ToggleGroupItem>
    </ToggleGroup>
  );
  const month_ = (
    <MonthView
      s={s}
      month={month}
      setMonth={setMonth}
      picked={pickedDay}
      onPick={setPickedDay}
      filterStyle={variant === "A" ? "menu" : "chips"}
    />
  );
  let body: ReactNode;
  let footer: ReactNode = null;
  if (variant === "D") {
    body = view === "month" ? month_ : <SchemeD s={s} />;
    footer = <SaveBar s={s} mode="before" />;
  } else if (variant === "B") {
    body = view === "month" ? month_ : <SchemeB s={s} />;
    footer = <SaveBar s={s} mode="after" />;
  } else if (variant === "C") {
    body = view === "month" ? <SchemeCMonth s={s} monthView={month_} picked={pickedDay} /> : <SchemeCWeek s={s} />;
    footer = <SaveBar s={s} mode="before" />;
  } else {
    body = view === "month" ? month_ : <SchemeA s={s} />;
    footer = <SaveBar s={s} mode="before" />;
  }
  return frame(
    viewToggle,
    <LooksProvider>
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 pb-40">
      <SimPanel s={s} />
      {s.notice && <Notice text={s.notice} onDismiss={() => s.setNotice(null)} />}
      {body}
      {variant !== "D" && <ChatPreview s={s} />}
    </div>
    </LooksProvider>,
    s.store.drafts[s.week].length > 0 ? <LooksProvider>{footer}</LooksProvider> : undefined,
  );
}

// ─── 原型控制 ──────────────────────────────────────────────────────────────

function SimPanel({ s }: { s: Schedule }) {
  const { now, isWest } = s.store;
  const setNow = (next: Partial<Now>) => s.setStore((st) => ({ ...st, now: { ...st.now, ...next } }));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-2 border-dashed border-yellow-400 px-3 py-2 text-meta">
      <span className="font-semibold">原型 · 模拟此刻</span>
      <label className="flex items-center gap-1">
        <select className="rounded border bg-background px-1 py-0.5" value={now.day} onChange={(e) => setNow({ day: Number(e.target.value) })}>
          {WEEKDAYS.map((w, i) => (
            <option key={w} value={i}>
              {dayLabel(0, i)}
            </option>
          ))}
        </select>
        <select
          className="rounded border bg-background px-1 py-0.5"
          value={now.slot ?? -1}
          onChange={(e) => setNow({ slot: Number(e.target.value) < 0 ? null : (Number(e.target.value) as Slot) })}
        >
          <option value={-1}>凌晨 0–6</option>
          {SLOTS.map((x, i) => (
            <option key={x.name} value={i}>
              {x.name} {x.hours}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={isWest} onChange={(e) => s.setStore((st) => ({ ...st, isWest: e.target.checked }))} />
        北京以西（下周的工作已经发布）
      </label>
      <span className="text-muted-foreground">草稿只存在内存里，刷新就清空</span>
    </div>
  );
}

function Notice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border px-3 py-2 text-body">
      <FailureIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{text}</p>
      <Button variant="ghost" size="xs" onClick={onDismiss}>
        知道了
      </Button>
    </div>
  );
}

// ─── 共用：周标题、工作块、待排、保存 ─────────────────────────────────────

function WeekHeader({ s, end }: { s: Schedule; end?: ReactNode }) {
  const w = s.week;
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon-sm" aria-label="上一周" disabled={w === 0} onClick={() => s.setWeek(0)}>
        <BackIcon />
      </Button>
      <h2 className="text-header">
        {w === 0 ? "本周" : "下周"}
        <span className="ml-2 text-subtitle font-normal text-muted-foreground">
          {dateOf(w, 0).getMonth() + 1}月{dateOf(w, 0).getDate()}日 – {dateOf(w, 6).getMonth() + 1}月{dateOf(w, 6).getDate()}日
        </span>
      </h2>
      <Button variant="ghost" size="icon-sm" aria-label="下一周" disabled={w === 1 || !s.store.isWest} onClick={() => s.setWeek(1)}>
        <ForwardIcon />
      </Button>
      <span className="flex-1" />
      {end}
    </div>
  );
}

/** 一项工作的一行：头像、名字、类别图标、工作名。谁的工作由头像说，不靠颜色。 */
function JobLine({ job, className }: { job: Job; className?: string }) {
  const Icon = CAT_ICON[job.cat];
  const look = useLook(job.idol);
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <MarkedAvatar name={look.full} src={look.avatar} size="sm" />
      <span className="shrink-0 font-medium">{job.idol}</span>
      <Icon aria-label={job.cat} className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{job.name}</span>
    </span>
  );
}

/**
 * 格子里的一项。保存过的铺她的壁纸色（这一格归她了），草稿只有一圈中性虚线、不上色；
 * 正在进行的外面一圈她的记号色（同统计页头像外那一圈）；做完的淡下去。是谁看头像。
 */
function Block({ s, p, isSaved, onClick, isDim }: { s: Schedule; p: Placement; isSaved: boolean; onClick?: () => void; isDim?: boolean }) {
  const job = jobOf(s.week, p.jobId);
  const Icon = CAT_ICON[job.cat];
  const isStarted = !isSaved && s.hasStarted(s.week, p);
  const isDone = isSaved && cellsOf(s.week, p).every((c) => timeOf(s.store.now, s.week, c.day, c.slot) === "past");
  const isNow = isSaved && cellsOf(s.week, p).some((c) => timeOf(s.store.now, s.week, c.day, c.slot) === "now");
  const look = useLook(job.idol);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...look.style, gridColumn: `${p.slot + 2} / span ${job.len}` }}
      aria-label={`${look.full} ${job.name}${isSaved ? "，已保存" : "，草稿"}${isDone ? "，做完了" : ""}`}
      className={cn(
        "flex min-h-16 min-w-0 flex-col justify-center gap-1 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        isSaved ? "bg-her-wall" : "border border-dashed border-foreground/40 bg-background",
        isStarted && "border-destructive",
        isNow && "ring-2 ring-her-mark ring-offset-2 ring-offset-background",
        isDone && "opacity-55",
        isDim && "opacity-40",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <MarkedAvatar name={look.full} src={look.avatar} size="sm" />
        <span className="truncate text-subtitle font-medium">{job.idol}</span>
        {isSaved && <LockedIcon aria-hidden className="ml-auto size-3 shrink-0 text-muted-foreground" />}
      </span>
      <span className="flex min-w-0 items-center gap-1 text-meta text-muted-foreground">
        <Icon aria-hidden className="size-3 shrink-0" />
        <span className="truncate">{job.name}</span>
      </span>
      {(isStarted || isNow) && (
        <span className={cn("text-meta", isStarted ? "text-destructive" : "text-foreground")}>
          {isStarted ? "开始了，存不了" : "进行中"}
        </span>
      )}
    </button>
  );
}

/** 一周的格子：一行一天，三列是上午、下午、晚上。多段的工作横着占几格。 */
function WeekGrid({
  s,
  onEmpty,
  onBlock,
  isLit,
  isDimBlock,
  litStyle,
}: {
  s: Schedule;
  onEmpty: (day: number, slot: Slot) => void;
  onBlock: (p: Placement, isSaved: boolean) => void;
  /** B：选中一项工作时，能放的格子亮起来；返回 null 表示没在选。 */
  isLit?: (day: number, slot: Slot) => boolean | null;
  isDimBlock?: boolean;
  /** 亮起来的格子用选中那位的颜色。 */
  litStyle?: CSSProperties;
}) {
  const w = s.week;
  return (
    <div className="grid grid-cols-[4.5rem_repeat(3,minmax(0,1fr))] gap-1">
      <span />
      {SLOTS.map((x) => (
        <span key={x.name} className="px-1 text-center text-meta text-muted-foreground">
          {x.name} <span className="tabular-nums">{x.hours}</span>
        </span>
      ))}
      {WEEKDAYS.map((_, day) => {
        const isToday = w === 0 && day === s.store.now.day;
        const date = dateOf(w, day);
        const holiday = HOLIDAYS[ymd(date)];
        const bday = BIRTHDAYS[`${pad(date.getMonth() + 1)}-${pad(date.getDate())}`];
        const cells: ReactNode[] = [];
        for (let slot = 0 as Slot; slot < 3; slot = (slot + 1) as Slot) {
          const o = s.occupant(w, day, slot);
          if (o) {
            if (o.slot === slot)
              cells.push(
                <Block key={slot} s={s} p={o} isSaved={o.isSaved} isDim={isDimBlock} onClick={() => onBlock(o, o.isSaved)} />,
              );
            continue;
          }
          const t = timeOf(s.store.now, w, day, slot);
          const lit = isLit?.(day, slot) ?? null;
          if (t !== "future")
            cells.push(
              <span
                key={slot}
                className="flex min-h-16 items-center justify-center rounded-lg bg-muted/40 text-meta text-muted-foreground"
              >
                {t === "now" ? "进行中" : "已过"}
              </span>,
            );
          else
            cells.push(
              <button
                key={slot}
                type="button"
                disabled={lit === false}
                onClick={() => onEmpty(day, slot)}
                aria-label={`${dayLabel(w, day)} ${SLOTS[slot].name}`}
                style={lit === true ? litStyle : undefined}
                className={cn(
                  "flex min-h-16 items-center justify-center rounded-lg border text-muted-foreground outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                  lit === true && "border-her-mark bg-her-wall text-foreground",
                  lit === false && "opacity-30",
                )}
              >
                {lit === true ? <span className="text-meta">放这里</span> : <AddIcon aria-hidden className="size-4" />}
              </button>,
            );
        }
        return (
          <div key={day} className="contents">
            <span className={cn("flex flex-col justify-center text-subtitle", isToday && "font-semibold")}>
              <span>
                {WEEKDAYS[day]}
                {isToday && <span className="ml-1 text-meta">今天</span>}
              </span>
              <span className="text-meta text-muted-foreground">
                {date.getMonth() + 1}/{date.getDate()}
              </span>
              {(holiday || bday) && (
                <span className="flex items-center gap-1 truncate text-meta text-muted-foreground">
                  {holiday ? <HolidayIcon aria-hidden className="size-3" /> : <BirthdayIcon aria-hidden className="size-3" />}
                  <span className="truncate">{holiday ?? bday!.join("、")}</span>
                </span>
              )}
            </span>
            {cells}
          </div>
        );
      })}
    </div>
  );
}

function expiryText(s: Schedule) {
  if (s.week === 0 && s.store.now.day === 6) return "今晚 24 点后作废";
  return "周日 24 点后作废";
}

function PendingHeading({ s }: { s: Schedule }) {
  const n = s.pending(s.week).length;
  const isLast = s.week === 0 && s.store.now.day === 6;
  return (
    <h3 className="flex flex-wrap items-baseline gap-x-2 text-header">
      待排 {n} 项
      <span className={cn("text-subtitle font-normal text-muted-foreground", isLast && "font-semibold text-foreground")}>
        还能排 {s.freeLeft(s.week)} 格 · {expiryText(s)}
      </span>
    </h3>
  );
}

/** 按偶像分组的待排工作。 */
function PendingList({
  s,
  selected,
  onJob,
  action,
}: {
  s: Schedule;
  selected?: string | null;
  onJob?: (job: Job) => void;
  action?: (job: Job) => ReactNode;
}) {
  const jobs = s.pending(s.week);
  const idols = [...new Set(WEEK_JOBS[s.week].map((j) => j.idol))];
  if (jobs.length === 0) return <p className="text-body text-muted-foreground">这周的工作都排进去了。</p>;
  return (
    <ul className="flex flex-col gap-4">
      {idols.map((idol) => {
        const mine = jobs.filter((j) => j.idol === idol);
        if (mine.length === 0) return null;
        return (
          <PendingGroup key={idol} idol={idol}>
            {mine.map((job) => (
              <div
                key={job.id}
                role={onJob ? "button" : undefined}
                tabIndex={onJob ? 0 : undefined}
                onClick={() => onJob?.(job)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-2 text-body",
                  onJob && "cursor-pointer hover:bg-muted/60",
                  selected === job.id && "bg-muted hover:bg-muted",
                )}
              >
                <JobRow job={job} />
                {action?.(job)}
              </div>
            ))}
          </PendingGroup>
        );
      })}
    </ul>
  );
}

function PendingGroup({ idol, children }: { idol: string; children: ReactNode }) {
  const look = useLook(idol);
  return (
    <li className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2 py-1 text-subtitle font-medium">
        <MarkedAvatar name={look.full} src={look.avatar} size="sm" />
        {look.full}
      </span>
      <div className="flex flex-col pl-6">{children}</div>
    </li>
  );
}

function IdolAvatar({ idol, size = "sm" }: { idol: string; size?: "sm" | "bubble" }) {
  const look = useLook(idol);
  return <MarkedAvatar name={look.full} src={look.avatar} size={size} />;
}

function JobRow({ job, reason, withIdol }: { job: Job; reason?: string | null; withIdol?: boolean }) {
  const Icon = CAT_ICON[job.cat];
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-center gap-2">
        {withIdol && <span className="shrink-0 font-medium">{job.idol}</span>}
        <Icon aria-label={job.cat} className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn(!withIdol && "font-medium")}>{job.name}</span>
        <span className="text-meta text-muted-foreground">
          {job.len === 3 ? "全天" : `${job.len} 段`}
          {job.only && ` · 只排${job.only.map((x) => SLOTS[x].name).join("、")}`}
        </span>
      </span>
      <span className="truncate text-subtitle text-muted-foreground">{reason ?? job.note}</span>
    </span>
  );
}

/** 页底的保存条。mode=before：确认前剔掉已经开始的；after：确认后再退回。 */
function SaveBar({ s, mode }: { s: Schedule; mode: "before" | "after" }) {
  const [isOpen, setOpen] = useState(false);
  const w = s.week;
  const drafts = s.store.drafts[w];
  if (drafts.length === 0) return null;
  const started = drafts.filter((p) => s.hasStarted(w, p));
  const listed = mode === "before" ? drafts.filter((p) => !s.hasStarted(w, p)) : drafts;
  const describe = (p: Placement) => {
    const job = jobOf(w, p.jobId);
    return `${dayLabel(w, p.day)} ${slotRange(job, p.slot)} · ${job.idol} ${job.name}`;
  };
  const confirm = () => {
    const { started: back } = s.save(w);
    setOpen(false);
    if (back.length > 0) s.setNotice(`${back.map(describe).join("；")}：已经开始了，退回待排。`);
  };
  return (
    <div className="flex items-center gap-3">
      <p className="flex-1 text-body">
        草稿 {drafts.length} 项<span className="ml-2 text-subtitle text-muted-foreground">保存后她才知道</span>
      </p>
      <Button onClick={() => setOpen(true)}>保存</Button>
      <AlertDialog open={isOpen} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{listed.length > 0 ? `保存这 ${listed.length} 项？` : "没有能保存的"}</AlertDialogTitle>
            <AlertDialogDescription>保存后不能更改，也不能撤掉。</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-1 text-body">
            {listed.map((p) => (
              <ConfirmRow key={p.jobId} job={jobOf(w, p.jobId)} text={describe(p)} isBad={mode === "after" && s.hasStarted(w, p)} />
            ))}
          </ul>
          {mode === "before" && started.length > 0 && (
            <p className="text-subtitle text-muted-foreground">
              {started.map(describe).join("；")}：已经开始了，不保存，退回待排。
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>再看看</AlertDialogCancel>
            <AlertDialogAction disabled={listed.length === 0} onClick={confirm}>
              保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConfirmRow({ job, text, isBad }: { job: Job; text: string; isBad: boolean }) {
  const look = useLook(job.idol);
  return (
    <li style={look.style} className={cn("flex items-center gap-2", isBad && "text-destructive")}>
      <MarkedAvatar name={look.full} src={look.avatar} size="sm" />
      {text}
    </li>
  );
}

/** 点了格子里的一项：看说明；草稿可以移回待排，保存过的只能看。 */
function BlockDrawer({ s, open, onClose }: { s: Schedule; open: { p: Placement; isSaved: boolean } | null; onClose: () => void }) {
  const job = open ? jobOf(s.week, open.p.jobId) : null;
  return (
    <Drawer open={open !== null} onOpenChange={(o) => !o && onClose()} showSwipeHandle>
      <DrawerContent>
        {open && job && (
          <>
            <DrawerHeader className="flex-row items-center gap-3">
              <IdolAvatar idol={job.idol} size="bubble" />
              <span className="flex flex-col gap-0.5 text-left">
                <DrawerTitle>
                  {job.idol} · {job.name}
                </DrawerTitle>
                <DrawerDescription>
                  {dayLabel(s.week, open.p.day)} {slotRange(job, open.p.slot)}
                </DrawerDescription>
              </span>
            </DrawerHeader>
            <div className="flex flex-col gap-3 px-4 pb-6">
              <p className="text-body">{job.note}</p>
              {open.isSaved ? (
                <p className="flex items-center gap-1 text-subtitle text-muted-foreground">
                  <LockedIcon aria-hidden className="size-3.5" />
                  已保存，不能更改
                </p>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    s.unplace(s.week, job.id);
                    onClose();
                  }}
                >
                  移回待排
                </Button>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

/** 点了空格：列出待排的工作，能从这一格开始的排前面，排不了的写原因。 */
function CellDrawer({ s, cell, onClose }: { s: Schedule; cell: { day: number; slot: Slot } | null; onClose: () => void }) {
  const w = s.week;
  const jobs = s.pending(w);
  const rows = cell
    ? jobs
        .map((job) => ({ job, reason: s.whyNot(w, job, cell.day, cell.slot) }))
        .sort((a, b) => Number(a.reason !== null) - Number(b.reason !== null))
    : [];
  return (
    <Drawer open={cell !== null} onOpenChange={(o) => !o && onClose()} showSwipeHandle>
      <DrawerContent>
        {cell && (
          <>
            <DrawerHeader>
              <DrawerTitle>
                {dayLabel(w, cell.day)} {SLOTS[cell.slot].name}
              </DrawerTitle>
              <DrawerDescription>多段的工作从这一格往后占</DrawerDescription>
            </DrawerHeader>
            <ul className="flex flex-col gap-1 overflow-y-auto px-4 pb-6">
              {rows.map(({ job, reason }) => (
                <li key={job.id}>
                  <button
                    type="button"
                    disabled={reason !== null}
                    onClick={() => {
                      s.place(w, job.id, cell.day, cell.slot);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-body hover:bg-muted/60 disabled:opacity-40"
                  >
                    <IdolAvatar idol={job.idol} />
                    <JobRow job={job} reason={reason} withIdol />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// ─── A 点格子 ──────────────────────────────────────────────────────────────

function SchemeA({ s }: { s: Schedule }) {
  return <SchemeAWith s={s} />;
}

function SchemeAWith({ s, onJob }: { s: Schedule; onJob?: (job: Job) => void }) {
  const [cell, setCell] = useState<{ day: number; slot: Slot } | null>(null);
  const [block, setBlock] = useState<{ p: Placement; isSaved: boolean } | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <WeekHeader s={s} />
      <WeekGrid s={s} onEmpty={(day, slot) => setCell({ day, slot })} onBlock={(p, isSaved) => setBlock({ p, isSaved })} />
      <section className="flex flex-col gap-3">
        <PendingHeading s={s} />
        <PendingList s={s} onJob={onJob} />
      </section>
      <CellDrawer s={s} cell={cell} onClose={() => setCell(null)} />
      <BlockDrawer s={s} open={block} onClose={() => setBlock(null)} />
    </div>
  );
}

// ─── B 先挑工作 ────────────────────────────────────────────────────────────

function SchemeB({ s }: { s: Schedule }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [block, setBlock] = useState<{ p: Placement; isSaved: boolean } | null>(null);
  const w = s.week;
  const job = selected ? (s.pending(w).find((j) => j.id === selected) ?? null) : null;
  const isLit = (day: number, slot: Slot) => (job ? s.whyNot(w, job, day, slot) === null : null);
  const tray = s.pending(w);
  const looks = useLooks();
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {/* 手机：一排横滑的工作；电脑：左边一列。 */}
      <section className="flex flex-col gap-2 md:sticky md:top-0 md:w-72 md:shrink-0">
        <PendingHeading s={s} />
        <p className="text-subtitle text-muted-foreground">{job ? `把「${job.idol} ${job.name}」放进亮着的格子` : "先选一项"}</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
          {tray.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setSelected(selected === j.id ? null : j.id)}
              className={cn(
                "flex shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-1.5 text-meta",
                selected === j.id && "bg-muted",
              )}
            >
              <JobLine job={j} />
              <span className="text-muted-foreground">{j.len === 3 ? "全天" : `${j.len} 段`}</span>
            </button>
          ))}
        </div>
        <div className="max-md:hidden">
          <PendingList s={s} selected={selected} onJob={(j) => setSelected(selected === j.id ? null : j.id)} />
        </div>
      </section>
      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <WeekHeader s={s} />
        <WeekGrid
          s={s}
          isLit={isLit}
          litStyle={job ? looks(job.idol).style : undefined}
          isDimBlock={job !== null}
          onEmpty={(day, slot) => {
            if (!job) return;
            s.place(w, job.id, day, slot);
            setSelected(null);
          }}
          onBlock={(p, isSaved) => {
            // 草稿点一下直接拿回待排，并且选中它，好换个地方放。
            if (!isSaved) {
              s.unplace(w, p.jobId);
              setSelected(p.jobId);
            } else setBlock({ p, isSaved });
          }}
        />
        <p className="text-meta text-muted-foreground">点草稿把它拿回来</p>
      </section>
      <BlockDrawer s={s} open={block} onClose={() => setBlock(null)} />
    </div>
  );
}

// ─── D 定稿：电脑 B、手机 A ────────────────────────────────────────────────
// 电脑：B（左边待排一列，选中一项、能放的格子用她的颜色亮起来）。
// 手机：A（点空格弹抽屉挑工作）；待排列表在格子下面，点一项弹「排到…」抽屉，不用横滑。

function SchemeD({ s }: { s: Schedule }) {
  const isWide = useIsWide();
  const [job, setJob] = useState<Job | null>(null);
  if (isWide) return <SchemeB s={s} />;
  return (
    <>
      <SchemeAWith s={s} onJob={setJob} />
      <SlotsDrawer s={s} job={job} onClose={() => setJob(null)} />
    </>
  );
}

// ─── C 月历为主 ────────────────────────────────────────────────────────────

/** 某一天落在本周还是下周的第几天；都不在就是 null。 */
function weekDayOf(date: string): { week: number; day: number } | null {
  const d = new Date(date + "T00:00:00");
  const diff = Math.round((d.getTime() - MONDAY.getTime()) / 86400000);
  if (diff < 0 || diff >= 14) return null;
  return { week: Math.floor(diff / 7), day: diff % 7 };
}

function DaySlots({ s, week, day, onEmpty, onBlock }: {
  s: Schedule;
  week: number;
  day: number;
  onEmpty: (slot: Slot) => void;
  onBlock: (p: Placement, isSaved: boolean) => void;
}) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {SLOTS.map((x, i) => {
        const slot = i as Slot;
        const o = s.occupant(week, day, slot);
        const t = timeOf(s.store.now, week, day, slot);
        const job = o ? jobOf(week, o.jobId) : null;
        return (
          <li key={x.name} className="flex min-h-12 items-center gap-3 px-3 py-2">
            <span className="w-20 shrink-0 text-subtitle text-muted-foreground">
              {x.name} <span className="tabular-nums">{x.hours}</span>
            </span>
            {o && job ? (
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-body" onClick={() => onBlock(o, o.isSaved)}>
                <JobLine job={job} />
                {o.slot !== slot && <span className="text-meta text-muted-foreground">（接上一段）</span>}
                <span className="flex-1" />
                {o.isSaved ? (
                  <LockedIcon aria-label="已保存" className="size-3.5 text-muted-foreground" />
                ) : (
                  <span className={cn("text-meta", s.hasStarted(week, o) ? "text-destructive" : "text-muted-foreground")}>
                    {s.hasStarted(week, o) ? "已开始，保存不了" : "草稿"}
                  </span>
                )}
              </button>
            ) : t !== "future" ? (
              <span className="text-subtitle text-muted-foreground">{t === "now" ? "进行中" : "已过"}</span>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => onEmpty(slot)}>
                <AddIcon data-icon="inline-start" />
                排一项
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SlotsDrawer({ s, job, onClose }: { s: Schedule; job: Job | null; onClose: () => void }) {
  const w = s.week;
  const starts = job ? s.startsFor(w, job) : [];
  return (
    <Drawer open={job !== null} onOpenChange={(o) => !o && onClose()} showSwipeHandle>
      <DrawerContent>
        {job && (
          <>
            <DrawerHeader className="flex-row items-center gap-3">
              <IdolAvatar idol={job.idol} size="bubble" />
              <span className="flex flex-col gap-0.5 text-left">
                <DrawerTitle>
                  {job.idol} · {job.name} 排到…
                </DrawerTitle>
                <DrawerDescription>{job.note}</DrawerDescription>
              </span>
            </DrawerHeader>
            <ul className="flex flex-col gap-1 overflow-y-auto px-4 pb-6">
              {starts.length === 0 && <li className="text-body text-muted-foreground">这周没有能放下它的时间段了。</li>}
              {starts.map((c) => (
                <li key={`${c.day}-${c.slot}`}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-2 text-left text-body hover:bg-muted/60"
                    onClick={() => {
                      s.place(w, job.id, c.day, c.slot);
                      onClose();
                    }}
                  >
                    {dayLabel(w, c.day)} {slotRange(job, c.slot)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function SchemeCMonth({ s, monthView, picked }: { s: Schedule; monthView: ReactNode; picked: string }) {
  const [cell, setCell] = useState<{ day: number; slot: Slot } | null>(null);
  const [block, setBlock] = useState<{ p: Placement; isSaved: boolean } | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const at = weekDayOf(picked);
  const isOpenWeek = at && (at.week === 0 || s.store.isWest);
  const { setWeek } = s;
  useEffect(() => {
    if (at && isOpenWeek) setWeek(at.week);
  }, [at?.week, isOpenWeek, setWeek]); // eslint-disable-line
  return (
    <div className="flex flex-col gap-6">
      {monthView}
      {at && isOpenWeek && (
        <section className="flex flex-col gap-2">
          <h3 className="text-header">{dayLabel(at.week, at.day)}</h3>
          <DaySlots
            s={s}
            week={at.week}
            day={at.day}
            onEmpty={(slot) => setCell({ day: at.day, slot })}
            onBlock={(p, isSaved) => setBlock({ p, isSaved })}
          />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <PendingHeading s={s} />
        <PendingList
          s={s}
          action={(j) => (
            <Button variant="outline" size="sm" onClick={() => setJob(j)}>
              排到…
            </Button>
          )}
        />
      </section>
      <CellDrawer s={s} cell={cell} onClose={() => setCell(null)} />
      <BlockDrawer s={s} open={block} onClose={() => setBlock(null)} />
      <SlotsDrawer s={s} job={job} onClose={() => setJob(null)} />
    </div>
  );
}

/** C 的周视图：一天一节往下排，每节三个时间段，不是格子。 */
function SchemeCWeek({ s }: { s: Schedule }) {
  const [cell, setCell] = useState<{ day: number; slot: Slot } | null>(null);
  const [block, setBlock] = useState<{ p: Placement; isSaved: boolean } | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <WeekHeader s={s} />
      {WEEKDAYS.map((_, day) => (
        <section key={day} className="flex flex-col gap-2">
          <h3 className="text-subtitle font-semibold">
            {dayLabel(s.week, day)}
            {s.week === 0 && day === s.store.now.day && <span className="ml-2 font-normal text-muted-foreground">今天</span>}
          </h3>
          <DaySlots
            s={s}
            week={s.week}
            day={day}
            onEmpty={(slot) => setCell({ day, slot })}
            onBlock={(p, isSaved) => setBlock({ p, isSaved })}
          />
        </section>
      ))}
      <section className="flex flex-col gap-3">
        <PendingHeading s={s} />
        <PendingList
          s={s}
          action={(j) => (
            <Button variant="outline" size="sm" onClick={() => setJob(j)}>
              排到…
            </Button>
          )}
        />
      </section>
      <CellDrawer s={s} cell={cell} onClose={() => setCell(null)} />
      <BlockDrawer s={s} open={block} onClose={() => setBlock(null)} />
      <SlotsDrawer s={s} job={job} onClose={() => setJob(null)} />
    </div>
  );
}

// ─── 月视图（三个方案共用；A 的筛选在菜单里，B、C 是一排） ────────────────

const FILTERS: { key: Filter; name: string }[] = [
  { key: "birthday", name: "角色生日" },
  { key: "producer", name: "我的生日" },
  { key: "holiday", name: "节假日" },
  { key: "schedule", name: "日程" },
];

type DayEvent = { kind: Filter; text: string; job?: Job; isSaved?: boolean; who?: string };

function eventsOn(s: Schedule, date: Date): DayEvent[] {
  const key = ymd(date);
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const out: DayEvent[] = [];
  const f = s.store.filters;
  if (f.has("holiday") && HOLIDAYS[key]) out.push({ kind: "holiday", text: HOLIDAYS[key] });
  if (f.has("producer") && md === PRODUCER_BIRTHDAY) out.push({ kind: "producer", text: "你的生日" });
  if (f.has("birthday")) for (const name of BIRTHDAYS[md] ?? []) out.push({ kind: "birthday", text: `${name}的生日`, who: name });
  const at = weekDayOf(key);
  if (f.has("schedule") && at && (at.week === 0 || s.store.isWest))
    for (const p of s.placements(at.week).filter((p) => p.day === at.day).sort((a, b) => a.slot - b.slot)) {
      const job = jobOf(at.week, p.jobId);
      out.push({ kind: "schedule", text: `${SLOTS[p.slot].name} ${job.idol} ${job.name}`, job, isSaved: p.isSaved, who: job.idol });
    }
  return out;
}

function EventIcon({ e, className }: { e: DayEvent; className?: string }) {
  if (e.kind === "schedule")
    return (
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", e.isSaved ? "bg-her-mark" : "border border-her-mark", className && "size-2.5")}
      />
    );
  const Icon = e.kind === "holiday" ? HolidayIcon : BirthdayIcon;
  return <Icon aria-hidden className={cn("size-3 shrink-0", e.kind === "birthday" && "text-her-mark", className)} />;
}

/** 手机上月历格子里的一个记号：日程是她颜色的圆点，角色生日是她颜色的蛋糕，其余中性。 */
function EventMark({ e }: { e: DayEvent }) {
  if (e.kind === "schedule")
    return (
      <span
        aria-hidden
        className={cn("size-2 rounded-full", e.isSaved ? "bg-her-mark" : "border border-her-mark")}
      />
    );
  return <EventIcon e={e} />;
}

function MonthView({
  s,
  month,
  setMonth,
  picked,
  onPick,
  filterStyle,
}: {
  s: Schedule;
  month: { y: number; m: number };
  setMonth: (m: { y: number; m: number }) => void;
  picked: string;
  onPick: (date: string) => void;
  filterStyle: "menu" | "chips";
}) {
  const first = new Date(month.y, month.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) =>
    i < lead || i >= lead + days ? null : new Date(month.y, month.m, i - lead + 1),
  );
  const today = ymd(dateOf(0, s.store.now.day));
  const toggle = (k: Filter) =>
    s.setStore((st) => {
      const next = new Set(st.filters);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return { ...st, filters: next };
    });
  const go = (step: number) => {
    const d = new Date(month.y, month.m + step, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const pickedEvents = eventsOn(s, new Date(picked + "T00:00:00"));
  const looks = useLooks();
  const filterMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="筛选" />}>
        <FilterIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FILTERS.map((x) => (
          <DropdownMenuCheckboxItem key={x.key} checked={s.store.filters.has(x.key)} onCheckedChange={() => toggle(x.key)}>
            {x.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="上个月" onClick={() => go(-1)}>
          <BackIcon />
        </Button>
        <h2 className="text-header tabular-nums">
          {month.y}年{month.m + 1}月
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label="下个月" onClick={() => go(1)}>
          <ForwardIcon />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setMonth({ y: 2026, m: 9 });
            onPick(today);
          }}
        >
          今天
        </Button>
        <span className="flex-1" />
        {filterStyle === "menu" && filterMenu}
      </div>
      {filterStyle === "chips" && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((x) => (
            <Button
              key={x.key}
              size="sm"
              variant={s.store.filters.has(x.key) ? "secondary" : "outline"}
              aria-pressed={s.store.filters.has(x.key)}
              onClick={() => toggle(x.key)}
            >
              {x.name}
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {WEEKDAYS.map((w) => (
          <span key={w} className="bg-background py-1 text-center text-meta text-muted-foreground">
            {w.slice(1)}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} className="bg-background" />;
          const key = ymd(d);
          const evs = eventsOn(s, d);
          const isHoliday = evs.some((e) => e.kind === "holiday");
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(key)}
              className={cn(
                "flex min-h-14 flex-col items-stretch gap-0.5 bg-background p-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-24",
                key === picked && "bg-muted hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center self-start rounded-full text-subtitle tabular-nums",
                  key === today && "bg-foreground text-background",
                  isHoliday && key !== today && "font-semibold text-destructive",
                )}
              >
                {d.getDate()}
              </span>
              {/* 手机：只有一排小图标；电脑：最多三行字。 */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {evs.slice(0, 5).map((e, k) => (
                  <span key={k} style={e.who ? looks(e.who).style : undefined} className="flex items-center">
                    <EventMark e={e} />
                  </span>
                ))}
              </span>
              <span className="flex flex-col gap-0.5 max-sm:hidden">
                {evs.slice(0, 3).map((e, k) => (
                  <span
                    key={k}
                    style={e.who ? looks(e.who).style : undefined}
                    className={cn(
                      "flex items-center gap-1 truncate rounded px-1 text-meta",
                      e.kind === "schedule"
                        ? e.isSaved
                          ? "bg-her-wall"
                          : "border border-dashed border-foreground/40"
                        : "text-muted-foreground",
                    )}
                  >
                    <EventIcon e={e} />
                    <span className="truncate">{e.text}</span>
                  </span>
                ))}
                {evs.length > 3 && <span className="px-1 text-meta text-muted-foreground">还有 {evs.length - 3} 项</span>}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="flex flex-col gap-1">
        {pickedEvents.map((e, k) => (
          <li key={k} style={e.who ? looks(e.who).style : undefined} className="flex items-center gap-2 text-body">
            <EventIcon e={e} className="size-4" />
            {e.text}
            {e.kind === "schedule" && !e.isSaved && <span className="text-meta text-muted-foreground">草稿</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── 对话页上看她的日程（两个候选，静态） ───────────────────────────────────

function ChatPreview({ s }: { s: Schedule }) {
  const idol = "甜花";
  const mine = s.store.saved[0].filter((p) => jobOf(0, p.jobId).idol === idol);
  const lines = mine.map((p) => {
    const job = jobOf(0, p.jobId);
    const done = cellsOf(0, p).every((c) => timeOf(s.store.now, 0, c.day, c.slot) === "past");
    return `${WEEKDAYS[p.day]} ${slotRange(job, p.slot)} ${job.name}${done ? "（做完了）" : ""}`;
  });
  return (
    <section className="mt-6 flex flex-col gap-3 rounded-lg border-2 border-dashed border-yellow-400 p-3">
      <p className="text-meta font-semibold">原型 · 从她的对话页能不能看到她本周的日程（拿甜花举例，只算保存过的）</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-lg border p-3 text-body">
          <span className="text-meta text-muted-foreground">① 好感度 Popover 里多一节</span>
          <span className="text-subtitle text-muted-foreground">信任 · 今天还能涨 12</span>
          <span className="border-t pt-2 text-subtitle font-semibold">本周</span>
          {lines.length > 0 ? (
            lines.map((l) => (
              <span key={l} className="text-subtitle">
                {l}
              </span>
            ))
          ) : (
            <span className="text-subtitle text-muted-foreground">没有排工作</span>
          )}
          <span className="text-subtitle underline">去日历排 ›</span>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-3 text-body">
          <span className="text-meta text-muted-foreground">② 更多菜单里一项「她的日程」</span>
          <span className="text-subtitle">新对话</span>
          <span className="text-subtitle">历史对话</span>
          <span className="text-subtitle font-semibold">她的日程 ›</span>
          <span className="text-meta text-muted-foreground">点了进日历周视图，只看她</span>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-3 text-body">
          <span className="text-meta text-muted-foreground">③ 对话页不放，只在日历里看</span>
          <span className="text-subtitle text-muted-foreground">她在对话里自己会说起</span>
        </div>
      </div>
    </section>
  );
}
