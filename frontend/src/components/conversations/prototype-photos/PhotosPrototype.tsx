"use client";

// PROTOTYPE（photos 票 12「原型：照片怎么呈现」）：只在 prototype/photos-presentation 分支，不进 main。
// 三种照片在对话记录里的样子挂在真的对话页上，用 ?pv=A|B|C 切换：
//   A 图在前：照片单独一块，在她的话前面（标签写在回复最前面），生成中占一个同样大小的位置；
//   B 附在话里：照片在她那个气泡里、话的后面，生成中只是气泡底部一行「正在拍照…」，到了再撑开；
//   C 话后小图：话后面单独一块小图，生成中是一颗胶囊，点开看大图。
// 右上角的原型面板造假回合（假数据，不经后端）：要一张照片（选结果和用时）、次数用完她推掉；
// 次数用完的提示放哪、通话层上怎么显示、对话列表最后一句怎么写，都在面板里切。
// 假通话用真的通话层组件画，能收起、她挂断（结束卡）、我挂断。

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import NextLink from "next/link";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { Segment } from "@/lib/api";
import type { Entry } from "@/lib/conversationLog";
import type { ShownCall } from "@/lib/liveConversation";
import { settingsHref } from "@/lib/settingsCategory";
import { cn } from "@/lib/utils";
import { CloseIcon } from "@/theme/icons";
import { Camera as CameraIcon, CameraOff as CameraOffIcon, ImageOff as ImageOffIcon } from "lucide-react";

import { prototypeEnabled } from "@/components/app/PrototypeSwitcher";

export type Variant = "A" | "B" | "C";
export const VARIANTS: { key: Variant; name: string }[] = [
  { key: "A", name: "图在前、单独一块" },
  { key: "B", name: "附在话里" },
  { key: "C", name: "话后小图" },
];

export type Reason = "timeout" | "service" | "bad_image" | "own_key" | "quota";
type Outcome = "ok" | Reason;
export type PhotoState =
  | { status: "pending" }
  | { status: "done"; src: string }
  | { status: "failed"; reason: Reason };

type QuotaPlace = "cue" | "composer" | "toast";
type ListStyle = "none" | "bracket" | "icon" | "only";
type CallStyle = "card" | "corner" | "pill";

type FakeTurn = {
  id: number;
  characterId: string;
  at: string;
  user: string;
  reply: Segment[];
  pending: boolean;
  photo: PhotoState | null;
  inCall: boolean;
  /** 次数用完、她推掉的回合：多少时刻以后可以再要。 */
  retryAt: string | null;
};

export type FakeCall = {
  characterId: string;
  collapsed: boolean;
  since: number;
  /** 她挂断了：结束卡。 */
  ended: { seconds: number } | null;
  /** 收起时到了一张照片，还没展开看过。 */
  unseen: boolean;
};

type State = {
  variant: Variant;
  outcome: Outcome;
  seconds: number;
  quota: QuotaPlace;
  list: ListStyle;
  callStyle: CallStyle;
  endShowsLate: boolean;
  turns: FakeTurn[];
  call: FakeCall | null;
  /** 浮动提示（quota=toast）还在显示的那一条。 */
  toast: { characterId: string; retryAt: string } | null;
  /** 输入栏上方的那一条（quota=composer），点 ✕ 或下一个回合收起。 */
  strip: { characterId: string; retryAt: string } | null;
  lightbox: string | null;
};

const PHOTOS = [
  "/photos-proto/mano__selfie__rella.webp",
  "/photos-proto/mano__outdoor__rella.webp",
  "/photos-proto/mano__office__rella.webp",
  "/photos-proto/haruki__selfie__rella.webp",
];

const ASKS = ["拍张照片给我看看？", "现在在哪儿呀，发张照片嘛", "想看看你今天穿什么"];
const REPLIES: Segment[][] = [
  [
    { ja: "えへへ…今、事務所の近くのカフェにいるんです。", zh: "嘿嘿……我现在在事务所附近的咖啡店。" },
    { ja: "撮ってみましたっ。ほわっとしてますか？", zh: "拍了一张哦。看起来软乎乎的吗？" },
  ],
  [
    { ja: "お散歩の途中です。空がすごくきれいで…", zh: "正在散步呢。天空特别漂亮……" },
    { ja: "プロデューサーさんにも見てほしくて。", zh: "也想让制作人看看。" },
  ],
  [{ ja: "今日はこんな感じです…ちょっと恥ずかしいですね。", zh: "今天是这样的……有点不好意思呢。" }],
];
const DECLINE: Segment[] = [
  { ja: "ごめんなさい、今日はもうたくさん撮っちゃって…", zh: "对不起，今天已经拍了好多了……" },
  { ja: "また少ししたら、撮りますね。", zh: "过一会儿再拍给你哦。" },
];

let state: State = {
  variant: "A",
  outcome: "ok",
  seconds: 8,
  quota: "cue",
  list: "bracket",
  callStyle: "card",
  endShowsLate: true,
  turns: [],
  call: null,
  toast: null,
  strip: null,
  lightbox: null,
};
const listeners = new Set<() => void>();
let nextId = 1;

function set(update: (s: State) => Partial<State>) {
  state = { ...state, ...update(state) };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => state;

export function usePhotos(): State {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  // 变体从地址读一次。
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("pv");
    if (v === "A" || v === "B" || v === "C") set(() => ({ variant: v }));
  }, []);
  return s;
}

export function setVariant(v: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("pv", v);
  window.history.replaceState(window.history.state, "", url);
  set(() => ({ variant: v as Variant }));
}

export function openPhoto(src: string) {
  set(() => ({ lightbox: src }));
}

function patchTurn(id: number, patch: (t: FakeTurn) => Partial<FakeTurn>) {
  set((s) => ({ turns: s.turns.map((t) => (t.id === id ? { ...t, ...patch(t) } : t)) }));
}

/** 造一个要照片的回合：她的话随到随显示，照片从标签写完起生成，`seconds` 秒后出结果。 */
function ask(characterId: string) {
  const id = nextId++;
  const s = state;
  const inCall = s.call !== null && s.call.characterId === characterId && s.call.ended === null;
  const reply = REPLIES[(id - 1) % REPLIES.length];
  set((s) => ({
    strip: null,
    turns: [
      ...s.turns,
      {
        id,
        characterId,
        at: new Date().toISOString(),
        user: ASKS[(id - 1) % ASKS.length],
        reply: [],
        pending: true,
        photo: null,
        inCall,
        retryAt: null,
      },
    ],
  }));
  // 标签在回复最前面：先写完标签，照片开始生成，然后她的话一段一段到。
  setTimeout(() => patchTurn(id, () => ({ photo: { status: "pending" } })), 500);
  reply.forEach((segment, i) =>
    setTimeout(() => patchTurn(id, (t) => ({ reply: [...t.reply, segment] })), 900 + i * 1100),
  );
  setTimeout(() => patchTurn(id, () => ({ pending: false })), 900 + reply.length * 1100);
  const outcome = s.outcome;
  setTimeout(
    () => {
      patchTurn(id, () => ({
        photo:
          outcome === "ok"
            ? { status: "done", src: PHOTOS[(id - 1) % PHOTOS.length] }
            : { status: "failed", reason: outcome },
      }));
      // 通话层收着时到了：通话条上提示。
      set((s) => (s.call?.collapsed && outcome === "ok" ? { call: { ...s.call, unseen: true } } : {}));
    },
    500 + s.seconds * 1000,
  );
}

/** 次数用完：判断模型认出在要照片，但这一小时用完了，她用自己的话推掉，不写标签。 */
function askOverQuota(characterId: string) {
  const id = nextId++;
  const retryAt = new Date(Date.now() + 37 * 60_000).toISOString();
  set((s) => ({
    strip: null,
    turns: [
      ...s.turns,
      {
        id,
        characterId,
        at: new Date().toISOString(),
        user: "再发一张嘛",
        reply: [],
        pending: true,
        photo: null,
        inCall: s.call !== null && s.call.ended === null,
        retryAt: null,
      },
    ],
  }));
  DECLINE.forEach((segment, i) =>
    setTimeout(() => patchTurn(id, (t) => ({ reply: [...t.reply, segment] })), 600 + i * 1000),
  );
  // 用完时服务器推 retry_at：回合一开始就知道，提示和她的话一起出来。
  setTimeout(() => {
    patchTurn(id, () => ({ pending: false, retryAt }));
    set((s) => ({
      toast: s.quota === "toast" ? { characterId, retryAt } : s.toast,
      strip: s.quota === "composer" ? { characterId, retryAt } : s.strip,
    }));
    setTimeout(() => set((s) => (s.toast?.retryAt === retryAt ? { toast: null } : {})), 8000);
  }, 600 + DECLINE.length * 1000);
}

/** 假回合按 Entry 的样子排在真记录后面。 */
export function withFakeTurns(entries: Entry[], characterId: string, turns: FakeTurn[]): Entry[] {
  const fake = turns
    .filter((t) => t.characterId === characterId)
    .flatMap<Entry>((t) => [
      { kind: "user", key: `proto-u-${t.id}`, text: t.user, at: t.at },
      { kind: "character", key: `proto-c-${t.id}`, segments: t.reply, pending: t.pending, at: t.at, affinity: null },
    ]);
  return [...entries, ...fake];
}

export function turnOf(key: string, turns: FakeTurn[]): FakeTurn | undefined {
  if (!key.startsWith("proto-c-")) return undefined;
  const id = Number(key.slice("proto-c-".length));
  return turns.find((t) => t.id === id);
}

const REASONS: Record<Reason, string> = {
  timeout: "等太久了",
  service: "生图服务出错了",
  bad_image: "生成的图不对",
  own_key: "你的生图密钥没能用",
  quota: "这一小时的照片用完了",
};

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const quotaText = (retryAt: string) => `这一小时的照片用完了，${hhmm(retryAt)} 以后可以再要`;

function OwnKeysLink() {
  return (
    <NextLink href={settingsHref("own-keys")} className="font-medium text-foreground underline-offset-2 hover:underline">
      去设置自带密钥
    </NextLink>
  );
}

/** A：照片单独一块，在她的话前面。生成中占一个同样大小的位置（不跳）；失败时是一块矮的说明。 */
export function PhotoBefore({ photo }: { photo: PhotoState }) {
  if (photo.status === "pending")
    return (
      <div
        role="status"
        aria-label="照片正在生成"
        className="flex aspect-[832/1216] w-48 flex-col items-center justify-center gap-2 rounded-bubble bg-foreground/8 text-muted-foreground"
      >
        <CameraIcon aria-hidden className="size-6 motion-safe:animate-pulse" />
        <Spinner className="size-4" />
      </div>
    );
  if (photo.status === "done")
    return (
      <button type="button" onClick={() => openPhoto(photo.src)} className="w-48 overflow-hidden rounded-bubble">
        <img src={photo.src} alt="她发来的照片" width={832} height={1216} className="aspect-[832/1216] w-full object-cover" />
      </button>
    );
  return (
    <div role="note" className="flex w-48 gap-2 rounded-bubble bg-foreground/5 px-4 py-3 text-muted-foreground">
      <ImageOffIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-0.5 text-sm">
        <p>照片没发出来</p>
        <p className="text-meta">{REASONS[photo.reason]}</p>
        {photo.reason === "own_key" && (
          <p className="text-meta">
            <OwnKeysLink />
          </p>
        )}
      </div>
    </div>
  );
}

/** B：照片在气泡里、话的后面。生成中只是底部一行，到了再撑开（会跳）。 */
export function PhotoInside({ photo }: { photo: PhotoState }) {
  if (photo.status === "done")
    return (
      <button type="button" onClick={() => openPhoto(photo.src)} className="-mx-2 mt-1 mb-1 block overflow-hidden rounded-bubble-inner">
        <img src={photo.src} alt="她发来的照片" width={832} height={1216} className="aspect-[832/1216] w-56 object-cover" />
      </button>
    );
  return (
    <div
      role={photo.status === "pending" ? "status" : "note"}
      className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-foreground/10 pt-2 text-subtitle text-muted-foreground"
    >
      {photo.status === "pending" ? (
        <>
          <Spinner className="size-3.5" />
          正在拍照…
        </>
      ) : (
        <>
          <ImageOffIcon aria-hidden className="size-3.5" />
          照片没发出来 · {REASONS[photo.reason]}
          {photo.reason === "own_key" && <OwnKeysLink />}
        </>
      )}
    </div>
  );
}

/** C：话后面单独一块小图；生成中、失败都是一颗胶囊。 */
export function PhotoAfter({ photo }: { photo: PhotoState }) {
  if (photo.status === "done")
    return (
      <button type="button" onClick={() => openPhoto(photo.src)} className="w-28 overflow-hidden rounded-xl">
        <img src={photo.src} alt="她发来的照片" width={832} height={1216} className="aspect-[832/1216] w-full object-cover" />
      </button>
    );
  return (
    <span
      role={photo.status === "pending" ? "status" : "note"}
      className="flex w-fit flex-wrap items-center gap-x-1 rounded-full bg-foreground/10 px-3 py-1 text-meta text-muted-foreground"
    >
      {photo.status === "pending" ? (
        <>
          <CameraIcon aria-hidden className="size-3 motion-safe:animate-pulse" />
          正在拍照…
        </>
      ) : (
        <>
          <ImageOffIcon aria-hidden className="size-3" />
          照片没发出来 · {REASONS[photo.reason]}
          {photo.reason === "own_key" && (
            <>
              {" · "}
              <OwnKeysLink />
            </>
          )}
        </>
      )}
    </span>
  );
}

/** 次数用完（quota=cue）：她那条回复后面一行居中的胶囊，样子同变化胶囊。 */
export function QuotaCue({ retryAt }: { retryAt: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-meta text-muted-foreground">
      <CameraOffIcon aria-hidden className="size-3" />
      {quotaText(retryAt)}
    </span>
  );
}

/** 次数用完（quota=composer）：输入栏上方一行，点 ✕ 或发下一句时收起。 */
export function QuotaStrip({ characterId }: { characterId: string }) {
  const s = usePhotos();
  if (s.quota !== "composer" || !s.strip || s.strip.characterId !== characterId) return null;
  return (
    <div role="status" className="flex shrink-0 items-center gap-2 border-t bg-background px-4 py-2 text-sm text-muted-foreground">
      <CameraOffIcon aria-hidden className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">{quotaText(s.strip.retryAt)}</p>
      <button type="button" aria-label="知道了" onClick={() => set(() => ({ strip: null }))} className="rounded-full p-1 hover:bg-muted">
        <CloseIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/** 次数用完（quota=toast）：对话栏底部居中的反色胶囊，8 秒后消失（同礼物页送出后的提示）。 */
export function QuotaToast({ characterId }: { characterId: string }) {
  const s = usePhotos();
  if (s.quota !== "toast" || !s.toast || s.toast.characterId !== characterId) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      <p className="flex max-w-md items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">
        <CameraOffIcon aria-hidden className="size-4 shrink-0" />
        {quotaText(s.toast.retryAt)}
      </p>
    </div>
  );
}

/** 点开放大：整屏压暗，照片按比例放到最大；点外面、Esc、✕ 关。 */
export function Lightbox() {
  const s = usePhotos();
  return (
    <DialogPrimitive.Root open={s.lightbox !== null} onOpenChange={(open) => !open && set(() => ({ lightbox: null }))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/85 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          aria-label="照片"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none duration-150 data-open:animate-in data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 md:p-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) set(() => ({ lightbox: null }));
          }}
        >
          {s.lightbox && (
            <img src={s.lightbox} alt="她发来的照片" className="max-h-full max-w-full rounded-lg object-contain" />
          )}
          <DialogPrimitive.Close
            aria-label="关闭"
            className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-white hover:bg-white/15"
          >
            <CloseIcon aria-hidden className="size-6" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** 对话列表的最后一句：最后一个假回合带照片时，按面板选的写法。没有就交回真的。 */
export function useListPreview(characterId: string): ReactNode | null {
  const s = usePhotos();
  const last = [...s.turns].reverse().find((t) => t.characterId === characterId && !t.pending);
  if (!last) return null;
  const text = last.reply.at(-1)?.zh ?? "";
  if (!last.photo || s.list === "none" || last.photo.status !== "done") return text;
  if (s.list === "bracket") return `[照片] ${text}`;
  if (s.list === "icon")
    return (
      <>
        <CameraIcon aria-hidden className="mr-1 inline size-3.5 align-middle" />
        {text}
      </>
    );
  return (
    <>
      <CameraIcon aria-hidden className="mr-1 inline size-3.5 align-middle" />
      照片
    </>
  );
}

// ——— 通话 ———

export function fakeShownCall(call: FakeCall): ShownCall {
  return call.ended
    ? { phase: "ended", dial: 1, end: { reason: "she_hung_up", detail: null, counts: true }, seconds: call.ended.seconds }
    : { phase: "connected", dial: 1, since: call.since, maxSeconds: null };
}

/** 通话里最新的那张（这通电话里要的、最后一个）。 */
function callPhoto(s: State): { turn: FakeTurn; photo: PhotoState } | null {
  const t = [...s.turns].reverse().find((t) => t.inCall && t.characterId === s.call?.characterId && t.photo);
  return t?.photo ? { turn: t, photo: t.photo } : null;
}

export function callLine(s: State): Segment {
  const t = [...s.turns].reverse().find((t) => t.inCall && t.characterId === s.call?.characterId && t.reply.length);
  return t?.reply.at(-1) ?? { ja: "もしもし、プロデューサーさん？", zh: "喂，制作人？" };
}

/** 通话层上的照片，按面板的方式。`where` 是插槽：台词卡上方，还是右上角。 */
export function CallPhoto({ where }: { where: "above" | "corner" }) {
  const s = usePhotos();
  const shown = callPhoto(s);
  if (!shown || !s.call) return null;
  const { photo } = shown;
  // 挂断以后才到：结束卡上要不要带它。
  if (s.call.ended && (!s.endShowsLate || where !== "above")) return null;
  const style = s.call.ended ? "card" : s.callStyle;
  if (style === "corner" && where === "corner") {
    return (
      <div className="absolute top-28 right-4 z-10 w-20">
        {photo.status === "done" ? (
          <button type="button" onClick={() => openPhoto(photo.src)} className="block overflow-hidden rounded-xl ring-1 ring-white/30">
            <img src={photo.src} alt="她发来的照片" className="aspect-[832/1216] w-full object-cover" />
          </button>
        ) : (
          <div className="flex aspect-[832/1216] w-full flex-col items-center justify-center gap-1 rounded-xl bg-white/12 text-white/80 backdrop-blur-md">
            {photo.status === "pending" ? <Spinner className="size-4" /> : <ImageOffIcon aria-hidden className="size-4" />}
            <span className="text-meta">{photo.status === "pending" ? "拍照中" : "没发出来"}</span>
          </div>
        )}
      </div>
    );
  }
  if (where !== "above") return null;
  if (style === "card") {
    return (
      <div className="rounded-2xl bg-white/12 p-1.5 backdrop-blur-md">
        {photo.status === "done" ? (
          <button type="button" onClick={() => openPhoto(photo.src)} className="block overflow-hidden rounded-xl">
            <img src={photo.src} alt="她发来的照片" className="aspect-[832/1216] w-32 object-cover" />
          </button>
        ) : (
          <div className="flex aspect-[832/1216] w-32 flex-col items-center justify-center gap-2 rounded-xl bg-white/8 text-white/80">
            {photo.status === "pending" ? <Spinner className="size-5" /> : <ImageOffIcon aria-hidden className="size-5" />}
            <span className="px-2 text-center text-meta">
              {photo.status === "pending" ? "正在拍照…" : `照片没发出来 · ${REASONS[photo.reason]}`}
            </span>
          </div>
        )}
      </div>
    );
  }
  if (style === "pill") {
    const content =
      photo.status === "pending" ? (
        <>
          <Spinner className="size-4" />
          正在拍照…
        </>
      ) : photo.status === "done" ? (
        <>
          <CameraIcon aria-hidden className="size-4" />
          发来一张照片 · 点开看
        </>
      ) : (
        <>
          <ImageOffIcon aria-hidden className="size-4" />
          照片没发出来 · {REASONS[photo.reason]}
        </>
      );
    return (
      <button
        type="button"
        disabled={photo.status !== "done"}
        onClick={() => photo.status === "done" && openPhoto(photo.src)}
        className="flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm text-white backdrop-blur-md enabled:hover:bg-white/20"
      >
        {content}
      </button>
    );
  }
  return null;
}

/** 通话条：收着时到了一张照片，状态后面多一句。 */
export function CallBarHint() {
  const s = usePhotos();
  if (!s.call?.unseen) return null;
  return (
    <span className="flex shrink-0 items-center gap-1 text-white">
      <CameraIcon aria-hidden className="size-3.5" />
      新照片
    </span>
  );
}

export const callActions = {
  collapse: () => set((s) => (s.call ? { call: { ...s.call, collapsed: true } } : {})),
  expand: () => set((s) => (s.call ? { call: { ...s.call, collapsed: false, unseen: false } } : {})),
  hangUp: () => set(() => ({ call: null })),
  dismiss: () => set(() => ({ call: null })),
};

// ——— 原型面板 ———

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-white/60">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, name]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn("rounded px-1.5 py-0.5", v === value ? "bg-yellow-400 text-black" : "bg-white/10 hover:bg-white/20")}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Act({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded bg-white px-2 py-1 text-black enabled:hover:bg-yellow-300 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function PhotosPanel({ characterId }: { characterId: string }) {
  const s = usePhotos();
  if (!prototypeEnabled) return null;
  const inCall = s.call?.characterId === characterId && s.call.ended === null;
  const shown = callPhoto(s);
  return (
    <details className="fixed top-16 right-2 z-[90] w-72 rounded-lg bg-black/90 text-xs text-white shadow-lg ring-2 ring-yellow-400">
      <summary className="cursor-pointer px-3 py-2 font-medium">原型：照片怎么呈现</summary>
      <div className="flex max-h-[80dvh] flex-col gap-3 overflow-y-auto px-3 pb-3">
        <div className="flex flex-wrap gap-1.5">
          <Act onClick={() => ask(characterId)}>要一张照片</Act>
          <Act onClick={() => askOverQuota(characterId)}>次数用完、她推掉</Act>
          <Act onClick={() => set((s) => ({ turns: s.turns.filter((t) => t.characterId !== characterId) }))}>清空假回合</Act>
        </div>
        <Seg
          label="这张的结果"
          value={s.outcome}
          options={[
            ["ok", "成功"],
            ["timeout", "超时"],
            ["service", "服务报错"],
            ["bad_image", "图不对"],
            ["own_key", "自带 key 失败"],
            ["quota", "次数用完（扣时撞上）"],
          ]}
          onChange={(outcome) => set(() => ({ outcome }))}
        />
        <Seg
          label="生成用时"
          value={String(s.seconds)}
          options={[
            ["3", "3 秒"],
            ["8", "8 秒"],
            ["15", "15 秒"],
          ]}
          onChange={(v) => set(() => ({ seconds: Number(v) }))}
        />
        <Seg
          label="次数用完的提示"
          value={s.quota}
          options={[
            ["cue", "对话里的胶囊"],
            ["composer", "输入栏上方"],
            ["toast", "浮动提示 8 秒"],
          ]}
          onChange={(quota) => set(() => ({ quota, toast: null, strip: null }))}
        />
        <Seg
          label="对话列表的最后一句"
          value={s.list}
          options={[
            ["none", "只写她的话"],
            ["bracket", "[照片] + 话"],
            ["icon", "相机图标 + 话"],
            ["only", "相机图标 + 照片"],
          ]}
          onChange={(list) => set(() => ({ list }))}
        />
        <div className="flex flex-col gap-1.5 border-t border-white/20 pt-2">
          <span className="text-white/60">假通话（在通话里点「要一张照片」就是通话里要的）</span>
          <div className="flex flex-wrap gap-1.5">
            <Act
              disabled={s.call !== null}
              onClick={() =>
                set(() => ({ call: { characterId, collapsed: false, since: Date.now(), ended: null, unseen: false } }))
              }
            >
              打电话
            </Act>
            <Act disabled={!inCall} onClick={() => (s.call?.collapsed ? callActions.expand() : callActions.collapse())}>
              {s.call?.collapsed ? "展开" : "收起"}
            </Act>
            <Act
              disabled={!inCall}
              onClick={() =>
                set((s) =>
                  s.call
                    ? {
                        call: {
                          ...s.call,
                          collapsed: false,
                          ended: { seconds: Math.floor((Date.now() - s.call.since) / 1000) },
                        },
                      }
                    : {},
                )
              }
            >
              她挂断（结束卡）
            </Act>
            <Act disabled={!inCall} onClick={callActions.hangUp}>
              我挂断
            </Act>
          </div>
          <Seg
            label="通话层上的照片"
            value={s.callStyle}
            options={[
              ["card", "台词卡上方的小卡"],
              ["corner", "右上角小图"],
              ["pill", "只出一颗胶囊"],
            ]}
            onChange={(callStyle) => set(() => ({ callStyle }))}
          />
          <Seg
            label="她挂断后才到的照片，结束卡上"
            value={s.endShowsLate ? "on" : "off"}
            options={[
              ["on", "带上"],
              ["off", "不带"],
            ]}
            onChange={(v) => set(() => ({ endShowsLate: v === "on" }))}
          />
          {shown && <span className="text-white/60">通话里最新一张：{shown.photo.status}</span>}
        </div>
      </div>
    </details>
  );
}
