"use client";

// PROTOTYPE（票 14「原型：礼物页」）：只在 prototype/gifts-page 分支，不进 main。
// 导航外壳固定用票 12 定稿的 D。礼物页三个变体用 ?gv=A|B|C 切换（记在这个标签页里）：
// - A「背包两栏」：电脑上第二栏是抽奖加背包列表，右边是选中那件的详情和「送给谁」的角色列表；手机上列表、详情各一屏。
//   抽到的东西直接在右边打开，标「刚抽到」，没有动画。送出后右边就地显示结果和「去她的对话」。
// - B「一页网格」：没有第二栏。上面一块抽奖台（7 个小点、抽一次、全部抽完），下面按类别筛选的礼物网格；
//   点一件，电脑从右边、手机从底部拉出「送给谁」的头像网格。抽到时弹窗开盒，稀有和重置卡样子不同。送出后底部一条提示，可以去她的对话。
// - C「三栏流程」：电脑上一屏摆开 ① 礼物 ② 送给谁 ③ 确认，抽奖收在页首的按钮里，抽到时翻开一张卡；
//   手机上三步各一屏，顶上一条步骤。送出后第三栏变成结果，可以再送一件或去她的对话。
// 地址带 ?to=<角色 ID> 时，表示从对话页的「送她一件礼物」跳过来，已经选好她（原型面板也能切）。

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { PageShell } from "@/components/app/PageShell";
import { PrototypeSwitcher } from "@/components/app/PrototypeSwitcher";
import { useWide } from "@/components/conversations/ConversationDirectory";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Character } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BackIcon, CheckIcon, CloseIcon, DrawIcon, ForwardIcon, GiftIcon, ResetCardIcon } from "@/theme/icons";

import {
  Avatar,
  CATEGORIES,
  clockText,
  DrawPips,
  drawNote,
  FakeCallBar,
  GiftArt,
  giftOf,
  PrototypePanel,
  ResetArt,
  TierLabel,
  useGifts,
  type Category,
  type DrawOutcome,
  type Gift,
  type Gifts,
  type SendResult,
} from "./model";

type GiftsVariant = "A" | "B" | "C";
const VARIANTS: { key: GiftsVariant; name: string }[] = [
  { key: "A", name: "背包两栏" },
  { key: "B", name: "一页网格" },
  { key: "C", name: "三栏流程" },
];

const KEY = "prototype-gifts-variant";
const listeners = new Set<() => void>();
function readVariant(): GiftsVariant {
  const raw = new URLSearchParams(location.search).get("gv") ?? sessionStorage.getItem(KEY) ?? "A";
  return VARIANTS.some((v) => v.key === raw) ? (raw as GiftsVariant) : "A";
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function chooseVariant(v: string) {
  sessionStorage.setItem(KEY, v);
  const url = new URL(location.href);
  url.searchParams.set("gv", v);
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((l) => l());
}

export function GiftsPrototype() {
  const variant = useSyncExternalStore(subscribe, readVariant, () => "A" as GiftsVariant);
  const g = useGifts();
  useEffect(() => sessionStorage.setItem(KEY, variant), [variant]);

  let body: ReactNode;
  if (g.judgeOff) body = <JudgeOff />;
  else if (!g.characters)
    body = (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  else if (variant === "A") body = <VariantA g={g} />;
  else if (variant === "B") body = <VariantB g={g} />;
  else body = <VariantC g={g} />;

  const caller = g.inCall ? g.characters?.[0] : undefined;
  return (
    <div className="flex h-full min-h-0 flex-col">
      {caller && <FakeCallBar c={caller} />}
      <div className="flex min-h-0 flex-1 flex-col [&>div]:h-full">{body}</div>
      <PrototypePanel g={g} />
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={chooseVariant} />
    </div>
  );
}

function JudgeOff() {
  return (
    <PageShell header={<h1 className="text-list-title">礼物</h1>}>
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GiftIcon />
          </EmptyMedia>
          <EmptyTitle>礼物暂时没有开放</EmptyTitle>
          <EmptyDescription>这里还没有开放好感度和礼物。已经有的礼物会留着，开放后照常能送。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}

// ---- 几个变体共用的小块 ----

/** 送出后的一句话：有变化时就是对话里那个胶囊的话；冷却中没解除时说新的解除时刻；到顶了只说送出了。 */
function resultLine(r: SendResult): string {
  if (r.cue) return r.cue;
  if (r.stillCoolingUntil) return `${r.character.name}还没消气，${clockText(r.stillCoolingUntil)} 就会愿意说话了`;
  return `已经送给${r.character.name}`;
}

function useGoToHer() {
  const router = useRouter();
  return (c: Character) => router.push(`/conversation/${c.id}`);
}

function CategoryFilter({ value, onChange, className }: { value: Category | "全部"; onChange: (c: Category | "全部") => void; className?: string }) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(v: string[]) => v[0] && onChange(v[0] as Category | "全部")}
      variant="outline"
      size="sm"
      spacing={1}
      className={cn("flex-wrap", className)}
    >
      {(["全部", ...CATEGORIES] as const).map((c) => (
        <ToggleGroupItem key={c} value={c} className="data-[pressed]:bg-muted">
          {c}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** 用重置卡之前的确认：列出会被拉回信任的角色。 */
function ResetConfirm({ g, open, onOpenChange }: { g: Gifts; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>使用一张重置卡？</AlertDialogTitle>
          <AlertDialogDescription>下面几位会回到信任，冷却中的马上可以说话。她们不会知道发生过什么。</AlertDialogDescription>
        </AlertDialogHeader>
        <ResetTargetList g={g} />
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={() => g.applyReset()}>使用</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ResetTargetList({ g }: { g: Gifts }) {
  return (
    <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
      {g.resetTargets.map((c) => (
        <li key={c.id} className="flex items-center gap-3">
          <Avatar c={c} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
          <TierLabel a={g.affinity(c.id)} compact />
          <ForwardIcon aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="text-subtitle text-muted-foreground">信任</span>
        </li>
      ))}
    </ul>
  );
}

const RESET_NONE = "现在没有低于信任的角色，留着以后用。";
const RESET_ABOUT = "不是礼物，自己用：把所有低于信任的角色拉回信任，冷却中的马上可以说话。能攒，不过期。";

/** 把预选的她排到最前面，冷却中的照常列出、可以送。 */
function orderedCharacters(g: Gifts): Character[] {
  const cs = g.characters ?? [];
  const her = cs.find((c) => c.id === g.to);
  return her ? [her, ...cs.filter((c) => c !== her)] : cs;
}

// ======================================================================
// A：背包两栏
// ======================================================================

type PickA = { kind: "gift"; id: string } | { kind: "reset" } | null;

function VariantA({ g }: { g: Gifts }) {
  const [pick, setPick] = useState<PickA>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [cat, setCat] = useState<Category | "全部">("全部");
  const [open, setOpen] = useState(false); // 手机上是不是在详情那一屏
  const wide = useWide();

  // 电脑上总要选着一件；送完了就换到下一件。
  const current: PickA =
    pick?.kind === "gift" && !g.owned.some((x) => x.id === pick.id) && fresh !== pick.id ? null : pick;
  useEffect(() => {
    if (wide && !current && g.owned[0]) setPick({ kind: "gift", id: g.owned[0].id });
  }, [wide, current, g.owned]);

  const choose = (p: PickA) => {
    setPick(p);
    setFresh(null);
    setOpen(true);
  };
  const draw = () => {
    const o = g.draw();
    if (!o) return;
    setPick(o.kind === "gift" ? { kind: "gift", id: o.gift.id } : { kind: "reset" });
    setFresh(o.kind === "gift" ? o.gift.id : "reset");
    setOpen(true);
  };
  const shown = g.owned.filter((x) => cat === "全部" || x.category === cat);
  const her = g.characters?.find((c) => c.id === g.to);

  const list = (
    <>
      <header className="flex min-h-14 shrink-0 items-center pt-3 pr-2 pb-2 pl-4">
        <h1 className="text-list-title">礼物</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <section aria-label="抽奖" className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-muted px-3 py-3">
          <DrawIcon aria-hidden className="size-5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center gap-2 text-sm font-medium">
              抽奖 <span className="tabular-nums">{g.draws} 次</span>
            </span>
            <span className="text-subtitle text-muted-foreground">{drawNote(g.draws)}</span>
          </div>
          <Button size="sm" disabled={g.draws === 0} onClick={draw}>
            抽一次
          </Button>
        </section>
        {her && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <Avatar c={her} size="sm" />
            <span className="min-w-0 flex-1 truncate">给{her.name}挑一件礼物</span>
            <Button variant="ghost" size="icon-sm" aria-label="不预选她" onClick={() => g.set({ to: null })}>
              <CloseIcon />
            </Button>
          </div>
        )}
        {g.resetCards > 0 && (
          <RowA
            art={<ResetArt className="size-10" />}
            label="重置卡"
            sub="自己用，不送人"
            count={g.resetCards}
            isCurrent={current?.kind === "reset"}
            onClick={() => choose({ kind: "reset" })}
          />
        )}
        {g.owned.length > 0 && <CategoryFilter value={cat} onChange={setCat} className="px-4 pt-2 pb-1" />}
        {g.owned.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {g.draws > 0 ? "还没有礼物。抽一次试试。" : "还没有礼物。明天 0:00 会发一次抽奖。"}
          </p>
        ) : (
          <ul className="[&>li]:list-none">
            {shown.map((x) => (
              <li key={x.id}>
                <RowA
                  art={<GiftArt gift={x} look={g.look} className="size-10" />}
                  label={x.name}
                  sub={`${x.rarity} · ${x.category}`}
                  count={g.inventory[x.id]}
                  isCurrent={current?.kind === "gift" && current.id === x.id}
                  isFresh={fresh === x.id}
                  onClick={() => choose({ kind: "gift", id: x.id })}
                />
              </li>
            ))}
            {shown.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">这一类还没有。</p>}
          </ul>
        )}
      </div>
    </>
  );

  let pane: ReactNode = null;
  if (current?.kind === "gift") pane = <GiftPaneA key={current.id} g={g} gift={giftOf(current.id)} fresh={fresh === current.id} back={() => setOpen(false)} />;
  else if (current?.kind === "reset") pane = <ResetPaneA g={g} fresh={fresh === "reset"} back={() => setOpen(false)} />;
  else
    pane = (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>选一件礼物</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );

  return (
    <div className="flex h-full min-h-0">
      <nav aria-label="礼物" className={cn("flex w-80 shrink-0 flex-col border-r max-md:w-full max-md:border-r-0", open && "max-md:hidden")}>
        {list}
      </nav>
      <div className={cn("min-w-0 flex-1 [&>div]:h-full", !open && "max-md:hidden")}>{pane}</div>
    </div>
  );
}

function RowA({
  art,
  label,
  sub,
  count,
  isCurrent,
  isFresh,
  onClick,
}: {
  art: ReactNode;
  label: string;
  sub: string;
  count: number;
  isCurrent: boolean;
  isFresh?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isCurrent ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        isCurrent && "md:bg-muted",
      )}
    >
      {art}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-body">
          {label}
          {isFresh && <Badge variant="secondary">刚抽到</Badge>}
        </span>
        <span className="truncate text-subtitle text-muted-foreground">{sub}</span>
      </span>
      <span className="text-meta text-muted-foreground tabular-nums">×{count}</span>
      <ForwardIcon className="size-4 shrink-0 text-muted-foreground md:hidden" />
    </button>
  );
}

function PaneHeaderA({ title, back }: { title: string; back: () => void }) {
  return (
    <div className="flex w-full items-center gap-2">
      <Button variant="ghost" size="icon-lg" aria-label="返回" onClick={back} className="-ml-2 md:hidden">
        <BackIcon />
      </Button>
      <h2 className="min-w-0 flex-1 truncate text-header">{title}</h2>
    </div>
  );
}

function GiftPaneA({ g, gift, fresh, back }: { g: Gifts; gift: Gift; fresh: boolean; back: () => void }) {
  const [to, setTo] = useState<string | null>(g.to);
  const [result, setResult] = useState<SendResult | null>(null);
  const goToHer = useGoToHer();
  const count = g.inventory[gift.id] ?? 0;
  const chosen = g.characters?.find((c) => c.id === to);
  const send = () => {
    if (!to) return;
    setResult(g.send(gift.id, to));
  };
  return (
    <PageShell
      header={<PaneHeaderA title={gift.name} back={back} />}
      footer={
        count > 0 ? (
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {chosen ? `把一份${gift.name}送给${chosen.name}` : "先选一位"}
            </span>
            <Button disabled={!chosen} onClick={send}>
              送出
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className={cn("flex items-center gap-4", fresh && "animate-in fade-in zoom-in-95 duration-500")}>
        <GiftArt gift={gift} look={g.look} className="size-32" />
        <div className="flex flex-col gap-1">
          {fresh && <Badge variant="secondary">刚抽到</Badge>}
          <p className="text-header">{gift.name}</p>
          <p className="text-sm text-muted-foreground">
            {gift.rarity} · {gift.category} · 还有 {count} 件
          </p>
        </div>
      </div>

      {result && (
        <div role="status" className="mt-6 flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
          <Avatar c={result.character} size="sm" />
          <span className="min-w-0 flex-1 text-sm">送出了。{resultLine(result)}</span>
          <Button variant="outline" size="sm" onClick={() => goToHer(result.character)}>
            去她的对话
          </Button>
        </div>
      )}

      {count > 0 ? (
        <>
          <h3 className="mt-6 mb-2 text-sm font-medium">送给谁</h3>
          <ul className="-mx-4 [&>li]:list-none">
            {orderedCharacters(g).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={to === c.id}
                  onClick={() => setTo(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                    to === c.id && "bg-muted hover:bg-muted",
                  )}
                >
                  <Avatar c={c} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-row-name">{c.name}</span>
                    <TierLabel a={g.affinity(c.id)} />
                  </span>
                  {to === c.id && <CheckIcon className="size-5 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        !result && <p className="mt-6 text-sm text-muted-foreground">这件已经送完了。</p>
      )}
    </PageShell>
  );
}

function ResetPaneA({ g, fresh, back }: { g: Gifts; fresh: boolean; back: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const none = g.resetTargets.length === 0;
  return (
    <PageShell
      header={<PaneHeaderA title="重置卡" back={back} />}
      footer={
        g.resetCards > 0 ? (
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">{none ? RESET_NONE : `会拉回 ${g.resetTargets.length} 位`}</span>
            <Button disabled={none} onClick={() => setConfirming(true)}>
              使用重置卡
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className={cn("flex items-center gap-4", fresh && "animate-in fade-in zoom-in-95 duration-500")}>
        <ResetArt className="size-32" />
        <div className="flex flex-col gap-1">
          {fresh && <Badge variant="secondary">刚抽到</Badge>}
          <p className="text-header">重置卡</p>
          <p className="text-sm text-muted-foreground">持有 {g.resetCards} 张</p>
        </div>
      </div>
      <p className="mt-6 text-sm">{RESET_ABOUT}</p>
      {!none && (
        <>
          <h3 className="mt-6 mb-3 text-sm font-medium">现在用会拉回</h3>
          <ResetTargetList g={g} />
        </>
      )}
      <ResetConfirm g={g} open={confirming} onOpenChange={setConfirming} />
    </PageShell>
  );
}

// ======================================================================
// B：一页网格
// ======================================================================

function VariantB({ g }: { g: Gifts }) {
  const [cat, setCat] = useState<Category | "全部">("全部");
  const [giving, setGiving] = useState<Gift | null>(null);
  const [reveal, setReveal] = useState<DrawOutcome[] | null>(null);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<SendResult | null>(null);
  const goToHer = useGoToHer();
  const her = g.characters?.find((c) => c.id === g.to);
  const shown = g.owned.filter((x) => cat === "全部" || x.category === cat);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <PageShell width="full" header={<h1 className="text-list-title">礼物</h1>}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        {her && (
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <Avatar c={her} size="sm" />
            <span className="min-w-0 flex-1 truncate">给{her.name}挑一件礼物</span>
            <Button variant="ghost" size="icon-sm" aria-label="不预选她" onClick={() => g.set({ to: null })}>
              <CloseIcon />
            </Button>
          </div>
        )}

        <section aria-label="抽奖" className="flex flex-wrap items-center gap-4 rounded-2xl bg-muted p-5">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="flex items-baseline gap-2">
              <span className="text-header">抽奖</span>
              <span className="text-sm text-muted-foreground tabular-nums">还有 {g.draws} 次</span>
            </p>
            <DrawPips draws={g.draws} />
            <p className="text-subtitle text-muted-foreground">{drawNote(g.draws)}</p>
          </div>
          <div className="flex gap-2">
            {g.draws >= 2 && (
              <Button variant="outline" onClick={() => setReveal(g.drawAll())}>
                全部抽完
              </Button>
            )}
            <Button
              disabled={g.draws === 0}
              onClick={() => {
                const o = g.draw();
                if (o) setReveal([o]);
              }}
            >
              <DrawIcon data-icon="inline-start" />
              抽一次
            </Button>
          </div>
        </section>

        {g.resetCards > 0 && (
          <section aria-label="重置卡" className="flex items-center gap-3 rounded-2xl border px-4 py-3">
            <ResetCardIcon aria-hidden className="size-5 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">
                重置卡 <span className="tabular-nums">×{g.resetCards}</span>
              </span>
              <span className="text-subtitle text-muted-foreground">
                {g.resetTargets.length ? `现在用会把 ${g.resetTargets.length} 位拉回信任` : RESET_NONE}
              </span>
            </div>
            <Button variant="outline" size="sm" disabled={g.resetTargets.length === 0} onClick={() => setResetting(true)}>
              使用
            </Button>
          </section>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <h2 className="text-sm font-medium">我的礼物</h2>
          {g.owned.length > 0 && <CategoryFilter value={cat} onChange={setCat} />}
        </div>
        {g.owned.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GiftIcon />
              </EmptyMedia>
              <EmptyTitle>还没有礼物</EmptyTitle>
              <EmptyDescription>{g.draws > 0 ? "抽一次，抽到的礼物会放在这里。" : "明天 0:00 会发一次抽奖，抽到的礼物会放在这里。"}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 [&>li]:list-none">
            {shown.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setGiving(x)}
                  className="group flex w-full flex-col items-center gap-1.5 rounded-xl p-1.5 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="relative w-full">
                    <GiftArt gift={x} look={g.look} className="w-full" />
                    {g.inventory[x.id] > 1 && (
                      <span className="absolute right-1.5 bottom-1.5 rounded-full bg-background px-1.5 text-meta tabular-nums">
                        ×{g.inventory[x.id]}
                      </span>
                    )}
                  </span>
                  <span className="text-sm">{x.name}</span>
                  <span className="-mt-1 text-meta text-muted-foreground">{x.rarity}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <GivePanelB g={g} gift={giving} onClose={() => setGiving(null)} onSent={setToast} />
      <RevealB g={g} outcomes={reveal} onClose={() => setReveal(null)} onAgain={(o) => setReveal([o])} onGive={(x) => { setReveal(null); setGiving(x); }} />
      <ResetConfirm g={g} open={resetting} onOpenChange={setResetting} />

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8 md:pl-18">
          <div className="flex max-w-md items-center gap-3 rounded-full bg-foreground py-1.5 pr-1.5 pl-2 text-sm text-background shadow-lg">
            <Avatar c={toast.character} size="sm" />
            <span className="min-w-0 flex-1 truncate">{resultLine(toast)}</span>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => goToHer(toast.character)}>
              去对话
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}

/** 「送给谁」：电脑从右边拉出 Sheet，手机从底部拉出 Drawer；头像网格。 */
function GivePanelB({ g, gift, onClose, onSent }: { g: Gifts; gift: Gift | null; onClose: () => void; onSent: (r: SendResult) => void }) {
  const wide = useWide();
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => setTo(g.to), [gift, g.to]);
  const chosen = g.characters?.find((c) => c.id === to);
  const open = gift !== null;
  const send = () => {
    if (!gift || !to) return;
    const r = g.send(gift.id, to);
    onClose();
    if (r) onSent(r);
  };

  const head = gift && (
    <div className="flex items-center gap-3">
      <GiftArt gift={gift} look={g.look} className="size-16" />
      <div className="flex flex-col text-left">
        <span className="text-header">{gift.name}</span>
        <span className="text-sm text-muted-foreground">
          {gift.rarity} · 还有 {g.inventory[gift.id] ?? 0} 件
        </span>
      </div>
    </div>
  );
  const grid = (
    <div className="min-h-0 flex-1 overflow-y-auto px-4">
      <p className="mb-2 text-sm font-medium">送给谁</p>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-3 [&>li]:list-none">
        {orderedCharacters(g).map((c) => {
          const a = g.affinity(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={to === c.id}
                onClick={() => setTo(c.id)}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                  to === c.id && "bg-muted hover:bg-muted",
                )}
              >
                <span className={cn("relative", a.cooling && "opacity-60")}>
                  <Avatar c={c} />
                </span>
                <span className="w-full truncate text-center text-subtitle">{c.name}</span>
                <TierLabel a={a} compact />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
  const foot = (
    <Button className="w-full" disabled={!chosen} onClick={send}>
      {chosen ? `送给${chosen.name}` : "选一位"}
    </Button>
  );

  if (wide)
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-96 gap-3">
          <SheetHeader>
            <SheetTitle className="sr-only">送礼</SheetTitle>
            {head}
          </SheetHeader>
          {grid}
          <SheetFooter>{foot}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader>
          <DrawerTitle className="sr-only">送礼</DrawerTitle>
          {head}
        </DrawerHeader>
        {grid}
        <DrawerFooter>{foot}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** 抽到时弹窗开盒：先晃一下礼物盒，再放出抽到的东西；稀有多一行「稀有」和闪光，重置卡写清楚它不是礼物。 */
function RevealB({
  g,
  outcomes,
  onClose,
  onAgain,
  onGive,
}: {
  g: Gifts;
  outcomes: DrawOutcome[] | null;
  onClose: () => void;
  onAgain: (o: DrawOutcome) => void;
  onGive: (x: Gift) => void;
}) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    setOpened(false);
    if (!outcomes) return;
    const t = setTimeout(() => setOpened(true), 900);
    return () => clearTimeout(t);
  }, [outcomes]);
  const single = outcomes?.length === 1 ? outcomes[0] : null;

  return (
    <Dialog open={outcomes !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">{!opened ? "抽奖中" : outcomes && outcomes.length > 1 ? `抽了 ${outcomes.length} 次` : "抽到了"}</DialogTitle>
        </DialogHeader>
        {!opened ? (
          <div className="flex h-56 items-center justify-center">
            <GiftIcon className="size-16 motion-safe:animate-bounce" />
          </div>
        ) : single ? (
          <div className="flex flex-col items-center gap-2 py-2 animate-in fade-in zoom-in-50 duration-500">
            {single.kind === "gift" ? (
              <>
                <div className="relative">
                  <GiftArt gift={single.gift} look={g.look} className="size-40" />
                  {single.gift.rarity === "稀有" && (
                    <DrawIcon aria-hidden className="absolute -top-2 -right-2 size-7 motion-safe:animate-pulse" />
                  )}
                </div>
                <p className="text-header">{single.gift.name}</p>
                {single.gift.rarity === "稀有" ? (
                  <Badge>稀有</Badge>
                ) : (
                  <p className="text-sm text-muted-foreground">{single.gift.rarity}</p>
                )}
              </>
            ) : (
              <>
                <ResetArt className="size-40" />
                <p className="text-header">重置卡</p>
                <Badge>很少见</Badge>
                <p className="text-center text-sm text-muted-foreground">{RESET_ABOUT}</p>
              </>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-2 py-2 [&>li]:list-none">
            {outcomes?.map((o, i) => (
              <li
                key={i}
                style={{ animationDelay: `${i * 120}ms` }}
                className="flex flex-col items-center gap-1 animate-in fade-in zoom-in-50 fill-mode-both duration-500"
              >
                {o.kind === "gift" ? <GiftArt gift={o.gift} look={g.look} className="w-full" /> : <ResetArt className="w-full" />}
                <span className="text-sm">{o.kind === "gift" ? o.gift.name : "重置卡"}</span>
                <span className="text-meta text-muted-foreground">{o.kind === "gift" ? o.gift.rarity : "很少见"}</span>
              </li>
            ))}
          </ul>
        )}
        {opened && (
          <DialogFooter className="sm:flex-col sm:gap-2">
            {single?.kind === "gift" && <Button onClick={() => onGive(single.gift)}>送给谁…</Button>}
            {g.draws > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  const o = g.draw();
                  if (o) onAgain(o);
                }}
              >
                再抽一次（还有 {g.draws} 次）
              </Button>
            )}
            <Button variant={single?.kind === "gift" || g.draws > 0 ? "ghost" : "default"} onClick={onClose}>
              收下
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ======================================================================
// C：三栏流程
// ======================================================================

type ItemC = { kind: "gift"; id: string } | { kind: "reset" } | null;

function VariantC({ g }: { g: Gifts }) {
  const [item, setItem] = useState<ItemC>(null);
  const [to, setTo] = useState<string | null>(g.to);
  const [step, setStep] = useState<1 | 2 | 3>(1); // 手机上看哪一步
  const [result, setResult] = useState<SendResult | "reset" | null>(null);
  const goToHer = useGoToHer();
  useEffect(() => setTo(g.to), [g.to]);

  const gift = item?.kind === "gift" ? giftOf(item.id) : null;
  const chosen = g.characters?.find((c) => c.id === to) ?? null;
  const pickItem = (i: ItemC) => {
    setItem(i);
    setResult(null);
    setStep(i?.kind === "reset" ? 3 : chosen ? 3 : 2);
  };
  const pickHer = (id: string) => {
    setTo(id);
    setResult(null);
    setStep(3);
  };
  const again = () => {
    setResult(null);
    setItem(null);
    setStep(1);
  };

  const col1 = (
    <ColumnC n={1} title="选一件" hiddenOnNarrow={step !== 1}>
      {g.owned.length === 0 && g.resetCards === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          还没有礼物。{g.draws > 0 ? "点右上角「抽奖」抽一次。" : "明天 0:00 会发一次抽奖。"}
        </p>
      ) : (
        <>
          {g.resetCards > 0 && (
            <GroupC caption="重置卡">
              <ItemRowC
                art={<ResetArt className="size-10" />}
                label="重置卡"
                count={g.resetCards}
                isCurrent={item?.kind === "reset"}
                onClick={() => pickItem({ kind: "reset" })}
              />
            </GroupC>
          )}
          {CATEGORIES.map((cat) => {
            const xs = g.owned.filter((x) => x.category === cat);
            if (xs.length === 0) return null;
            return (
              <GroupC key={cat} caption={cat}>
                {xs.map((x) => (
                  <ItemRowC
                    key={x.id}
                    art={<GiftArt gift={x} look={g.look} className="size-10" />}
                    label={x.name}
                    sub={x.rarity}
                    count={g.inventory[x.id]}
                    isCurrent={item?.kind === "gift" && item.id === x.id}
                    onClick={() => pickItem({ kind: "gift", id: x.id })}
                  />
                ))}
              </GroupC>
            );
          })}
        </>
      )}
    </ColumnC>
  );

  const col2 = (
    <ColumnC n={2} title={item?.kind === "reset" ? "会拉回谁" : "送给谁"} hiddenOnNarrow={step !== 2}>
      {item?.kind === "reset" ? (
        <div className="px-4 py-2">{g.resetTargets.length ? <ResetTargetList g={g} /> : <p className="text-sm text-muted-foreground">{RESET_NONE}</p>}</div>
      ) : (
        <ul className="[&>li]:list-none">
          {orderedCharacters(g).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={to === c.id}
                onClick={() => pickHer(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  to === c.id && "bg-muted hover:bg-muted",
                )}
              >
                <Avatar c={c} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-row-name">{c.name}</span>
                  <TierLabel a={g.affinity(c.id)} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ColumnC>
  );

  let confirm: ReactNode;
  if (result === "reset")
    confirm = (
      <CenterC>
        <ResetArt className="size-28" />
        <p className="text-header">用掉了一张重置卡</p>
        <p className="text-sm text-muted-foreground">她们都回到了信任。</p>
        <Button variant="outline" onClick={again}>
          好
        </Button>
      </CenterC>
    );
  else if (result)
    confirm = (
      <CenterC>
        <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-500">
          <GiftArt gift={result.gift} look={g.look} className="size-24" />
          <ForwardIcon aria-hidden className="size-5 text-muted-foreground" />
          <Avatar c={result.character} size="list" />
        </div>
        <p className="text-header">送出了</p>
        <p className="text-sm text-muted-foreground">{resultLine(result)}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={again}>
            再送一件
          </Button>
          <Button onClick={() => goToHer(result.character)}>去她的对话</Button>
        </div>
      </CenterC>
    );
  else if (item?.kind === "reset")
    confirm = (
      <CenterC>
        <ResetArt className="size-28" />
        <p className="text-header">重置卡 · 持有 {g.resetCards} 张</p>
        <p className="max-w-xs text-center text-sm text-muted-foreground">{RESET_ABOUT}</p>
        <Button
          disabled={g.resetTargets.length === 0}
          onClick={() => {
            g.applyReset();
            setResult("reset");
          }}
        >
          使用重置卡
        </Button>
        {g.resetTargets.length === 0 && <p className="text-subtitle text-muted-foreground">{RESET_NONE}</p>}
      </CenterC>
    );
  else if (gift || chosen)
    confirm = (
      <CenterC>
        <div className="flex items-center gap-3">
          {gift ? <GiftArt gift={gift} look={g.look} className="size-24" /> : <div className="size-24 rounded-xl border border-dashed" />}
          <ForwardIcon aria-hidden className="size-5 text-muted-foreground" />
          {chosen ? <Avatar c={chosen} size="list" /> : <div className="size-list-avatar rounded-full border border-dashed" />}
        </div>
        <p className="text-header">{gift && chosen ? `把一份${gift.name}送给${chosen.name}` : gift ? `把一份${gift.name}送给……` : `送给${chosen!.name}……`}</p>
        {chosen && <TierLabel a={g.affinity(chosen.id)} />}
        <Button
          disabled={!gift || !chosen}
          onClick={() => {
            if (gift && chosen) setResult(g.send(gift.id, chosen.id));
          }}
        >
          送出
        </Button>
      </CenterC>
    );
  else
    confirm = (
      <CenterC>
        <p className="text-sm text-muted-foreground">先在左边选一件礼物，再选一位。</p>
      </CenterC>
    );

  const col3 = (
    <ColumnC n={3} title="确认" hiddenOnNarrow={step !== 3} grow>
      {confirm}
    </ColumnC>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b px-4">
        <h1 className="min-w-0 flex-1 text-list-title">礼物</h1>
        <DrawC g={g} />
      </header>
      <Steps step={step} setStep={setStep} />
      <div className="flex min-h-0 flex-1">
        {col1}
        {col2}
        {col3}
      </div>
    </div>
  );
}

function Steps({ step, setStep }: { step: 1 | 2 | 3; setStep: (s: 1 | 2 | 3) => void }) {
  return (
    <ol className="flex shrink-0 items-center gap-1 border-b px-4 py-2 text-sm md:hidden">
      {(["礼物", "送给谁", "确认"] as const).map((t, i) => (
        <li key={t} className="flex items-center gap-1">
          {i > 0 && <ForwardIcon aria-hidden className="size-3.5 text-muted-foreground" />}
          <button
            type="button"
            onClick={() => setStep((i + 1) as 1 | 2 | 3)}
            className={cn("rounded-full px-2 py-0.5", step === i + 1 ? "bg-muted font-medium" : "text-muted-foreground")}
          >
            {i + 1} {t}
          </button>
        </li>
      ))}
    </ol>
  );
}

function ColumnC({
  n,
  title,
  hiddenOnNarrow,
  grow,
  children,
}: {
  n: number;
  title: string;
  hiddenOnNarrow: boolean;
  grow?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-h-0 flex-col max-md:w-full",
        grow ? "min-w-0 flex-1" : "w-72 shrink-0 border-r max-md:border-r-0",
        hiddenOnNarrow && "max-md:hidden",
      )}
    >
      <h2 className="flex h-10 shrink-0 items-center gap-2 px-4 text-subtitle font-medium text-muted-foreground max-md:hidden">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-meta tabular-nums">{n}</span>
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">{children}</div>
    </section>
  );
}

function GroupC({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="px-4 pt-3 pb-1 text-subtitle font-medium text-muted-foreground">{caption}</h3>
      <ul className="[&>li]:list-none">{children}</ul>
    </div>
  );
}

function ItemRowC({ art, label, sub, count, isCurrent, onClick }: { art: ReactNode; label: string; sub?: string; count: number; isCurrent: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={isCurrent}
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-1.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          isCurrent && "bg-muted hover:bg-muted",
        )}
      >
        {art}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body">{label}</span>
          {sub && <span className="text-subtitle text-muted-foreground">{sub}</span>}
        </span>
        <span className="text-meta text-muted-foreground tabular-nums">×{count}</span>
      </button>
    </li>
  );
}

function CenterC({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-80 flex-col items-center justify-center gap-3 px-6 py-8 text-center">{children}</div>;
}

/** 页首的「抽奖 n」：电脑上挂一个 Popover，手机上是底部的 Drawer；里面是一张背面朝上的卡，点了翻开。 */
function DrawC({ g }: { g: Gifts }) {
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<DrawOutcome | null>(null);
  const [flipped, setFlipped] = useState(false);
  const flip = () => {
    if (flipped) return;
    const o = g.draw();
    if (!o) return;
    setCard(o);
    setFlipped(true);
  };
  const next = () => {
    setFlipped(false);
    setTimeout(() => setCard(null), 300);
  };

  const body = (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm">
        还有 <span className="tabular-nums">{g.draws}</span> 次
      </p>
      <DrawPips draws={g.draws} />
      <button
        type="button"
        onClick={flip}
        disabled={!flipped && g.draws === 0}
        aria-label={flipped ? "抽到的东西" : "翻开一张"}
        className="perspective-[800px] h-52 w-40 outline-none disabled:opacity-40"
      >
        <span className={cn("relative block size-full transition-transform duration-700 transform-3d", flipped && "rotate-y-180")}>
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-foreground text-background backface-hidden">
            <GiftIcon className="size-10" />
            <span className="text-sm">{g.draws > 0 ? "点一下翻开" : "明天再来"}</span>
          </span>
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border bg-background p-3 rotate-y-180 backface-hidden">
            {card?.kind === "gift" && (
              <>
                <GiftArt gift={card.gift} look={g.look} className="w-full" />
                <span className="text-sm font-medium">{card.gift.name}</span>
                {card.gift.rarity === "稀有" ? <Badge>稀有</Badge> : <span className="text-meta text-muted-foreground">{card.gift.rarity}</span>}
              </>
            )}
            {card?.kind === "reset" && (
              <>
                <ResetArt className="w-full" />
                <span className="text-sm font-medium">重置卡</span>
                <Badge>很少见</Badge>
              </>
            )}
          </span>
        </span>
      </button>
      {card?.kind === "reset" && flipped && <p className="max-w-56 text-center text-subtitle text-muted-foreground">{RESET_ABOUT}</p>}
      <p className="text-center text-subtitle text-muted-foreground">{drawNote(g.draws)}</p>
      {flipped && g.draws > 0 && (
        <Button variant="outline" size="sm" onClick={next}>
          再翻一张
        </Button>
      )}
    </div>
  );

  const trigger = (
    <>
      <DrawIcon data-icon="inline-start" />
      抽奖
      <span className="tabular-nums">{g.draws}</span>
    </>
  );
  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) next();
  };
  if (wide)
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger render={<Button variant="outline" />}>{trigger}</PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          {body}
        </PopoverContent>
      </Popover>
    );
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>抽奖</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">{body}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

