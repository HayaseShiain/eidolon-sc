"use client";

// PROTOTYPE（票 13「原型：像手机设置那样的一级、二级设置页面」）：只在 prototype/settings-hierarchy 分支，不进 main。
// 导航外壳固定用票 12 定稿的 D。三个设置变体用 ?sv=A|B|C 切换（记在这个标签页里，换页不丢），都在 /settings 下按路径分页：
// - A「一类一页」：一级六项（档案、记忆 / 通话、自带密钥 / 登录与数据 / 关于），二级就是现在每个标签的整页内容，没有三级。
// - B「iOS 式逐项」：一级每行带当前值的摘要；二级一行一项、值在右边；点进去是只改这一项的三级页，改了就存，没有「保存档案」键。
//   电脑上三级页占右栏，页首有返回键回到二级。
// - C「节即一级」：现在的四个标签变成一级列表的分组小标题，每节单独一页（LLM、语音合成、语音识别各一页，退出登录、
//   删除数据各一页）；「关于」的几项直接在一级列表里，点了就走，只有两级。
// 三个变体都：记忆是设置的二级页、留在外壳里（去记忆不挂断通话）；旧的 /settings?tab=… 跳到对应的路径。

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";

import { AdminEntry } from "@/components/AdminEntry";
import { PageShell } from "@/components/app/PageShell";
import { PrototypeSwitcher } from "@/components/app/PrototypeSwitcher";
import { CallSettings } from "@/components/CallSettings";
import { Announcements } from "@/components/conversations/Announcements";
import { useDirectory } from "@/components/conversations/ConversationDirectory";
import { DeleteAccount } from "@/components/DeleteAccount";
import { MemoriesView } from "@/components/MemoriesView";
import { OwnKeysSettings } from "@/components/OwnKeysSettings";
import { ProducerProfileSettings } from "@/components/ProducerProfileSettings";
import { SignInSettings } from "@/components/SignInSettings";
import { SignOutSettings } from "@/components/SignOutSettings";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { copy } from "@/i18n";
import { getProfile, listMemories, saveProfile, type ProducerProfile } from "@/lib/api";
import { loadCallPreferences, saveCallPreferences, type CallPreferences, type Quality } from "@/lib/callPreferences";
import { last4, localOwnKeys, type LocalOwnKeys, type OwnService } from "@/lib/localOwnKeys";
import { listMicrophones } from "@/lib/microphone";
import { daysInMonth, MAX_FORM_OF_ADDRESS } from "@/lib/producerProfile";
import { REPOSITORY_URL } from "@/lib/repository";
import { PROVIDER_LABELS } from "@/lib/signIn";
import { detectTimezone, listTimezones } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import {
  AboutIcon,
  AnnouncementsBellIcon,
  BackIcon,
  CheckIcon,
  DashboardIcon,
  ExternalLinkIcon,
  ForwardIcon,
  GitHubIcon,
  LlmIcon,
  MemoriesIcon,
  MicIcon,
  OwnKeysIcon,
  PhoneIcon,
  PrivacyIcon,
  ProfileIcon,
  SignInIcon,
  SignOutIcon,
  TermsIcon,
  TrashIcon,
  TtsIcon,
} from "@/theme/icons";

const t = copy.settings;
type IconType = ComponentType<{ className?: string }>;

// ---- 变体记在地址和 sessionStorage 里 ----

type SettingsVariant = "A" | "B" | "C";
const VARIANTS: { key: SettingsVariant; name: string }[] = [
  { key: "A", name: "一类一页" },
  { key: "B", name: "iOS 式逐项" },
  { key: "C", name: "节即一级" },
];
const KEY = "prototype-settings-variant";
const listeners = new Set<() => void>();

function readVariant(): SettingsVariant {
  const raw = new URLSearchParams(location.search).get("sv") ?? sessionStorage.getItem(KEY) ?? "A";
  return VARIANTS.some((v) => v.key === raw) ? (raw as SettingsVariant) : "A";
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function chooseVariant(v: string) {
  sessionStorage.setItem(KEY, v);
  window.history.replaceState(window.history.state, "", "/settings?sv=" + v);
  listeners.forEach((l) => l());
}

// ---- 入口 ----

export function SettingsPrototype() {
  const variant = useSyncExternalStore(subscribe, readVariant, () => "A" as SettingsVariant);
  const pathname = usePathname();
  const router = useRouter();
  const path = pathname.split("/").slice(2).filter(Boolean);

  useEffect(() => {
    sessionStorage.setItem(KEY, variant);
  }, [variant]);

  // 旧链接 /settings?tab=own-keys 之类：换成路径，替换当前历史记录。
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (path.length > 0 || !tab) return;
    const to = variant === "C" ? ({ "own-keys": "llm" } as Record<string, string>)[tab] ?? tab : tab;
    router.replace(`/settings/${to}`);
  }, [path.length, variant, router]);

  return (
    // 外壳把直接子元素压成 h-full，切换条不能是直接子元素。
    <div>
      {variant === "A" && <VariantA path={path} />}
      {variant === "B" && <VariantB path={path} />}
      {variant === "C" && <VariantC path={path} />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={chooseVariant} />
    </div>
  );
}

// ---- 共用的骨架：电脑上第二栏一级列表、右栏内容；手机上一级列表和下一级各占一屏 ----

function TwoPane({ list, pane, depth }: { list: ReactNode; pane: ReactNode; depth: number }) {
  return (
    <div className="flex h-full min-h-0">
      <nav
        aria-label={t.title}
        className={cn("flex w-80 shrink-0 flex-col border-r max-md:w-full max-md:border-r-0", depth > 0 && "max-md:hidden")}
      >
        <header className="flex min-h-14 shrink-0 items-center pt-3 pr-2 pb-2 pl-4">
          <h1 className="text-list-title">{t.title}</h1>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">{list}</div>
      </nav>
      <div className={cn("min-w-0 flex-1 [&>div]:h-full", depth === 0 && "max-md:hidden")}>{pane}</div>
    </div>
  );
}

/** 右栏的页首：手机上有返回键；三级页在电脑上也有（回到二级）。 */
function PaneHeader({
  title,
  backHref,
  backOnWide = false,
  end,
}: {
  title: string;
  backHref: string;
  backOnWide?: boolean;
  end?: ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={copy.common.back}
        nativeButton={false}
        render={<NextLink href={backHref} />}
        className={cn("-ml-2", !backOnWide && "md:hidden")}
      >
        <BackIcon />
      </Button>
      <h2 className="min-w-0 flex-1 truncate text-header">{title}</h2>
      {end}
    </div>
  );
}

function Pane({ title, backHref, backOnWide, children }: { title: string; backHref: string; backOnWide?: boolean; children: ReactNode }) {
  return <PageShell header={<PaneHeader title={title} backHref={backHref} backOnWide={backOnWide} />}>{children}</PageShell>;
}

function MemoriesPane() {
  return <MemoriesView renderHeader={(end) => <PaneHeader title="记忆" backHref="/settings" end={end} />} />;
}

/** 列表的一行。`href` 以 http 开头的在新标签页打开；`trigger` 时整行交给外面渲染（公告弹窗）。 */
function Row({
  href,
  onClick,
  Icon,
  label,
  subtitle,
  value,
  isCurrent = false,
  chevron = "narrow",
  tone,
  end,
}: {
  href?: string;
  onClick?: () => void;
  Icon?: IconType;
  label: string;
  subtitle?: string;
  value?: string;
  isCurrent?: boolean;
  /** narrow：只在手机上显示 ›（电脑上靠选中底色）；always：两种屏宽都显示；none：不显示。 */
  chevron?: "narrow" | "always" | "none";
  tone?: "destructive";
  end?: ReactNode;
}) {
  const external = href?.startsWith("http");
  const inner = (
    <>
      {Icon && <Icon className={cn("size-5 shrink-0 text-muted-foreground", tone && "text-destructive")} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn(tone && "text-destructive")}>{label}</span>
        {subtitle && <span className="truncate text-subtitle text-muted-foreground">{subtitle}</span>}
      </span>
      {value && <span className="max-w-[55%] truncate text-muted-foreground">{value}</span>}
      {end}
      {external ? (
        <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        chevron !== "none" && (
          <ForwardIcon className={cn("size-4 shrink-0 text-muted-foreground", chevron === "narrow" && "md:hidden")} />
        )
      )}
    </>
  );
  const className = cn(
    "flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-body outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
    isCurrent && "md:bg-muted",
  );
  if (href)
    return (
      <NextLink
        href={href}
        aria-current={isCurrent ? "page" : undefined}
        className={className}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {inner}
      </NextLink>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  return <div className={cn(className, "hover:bg-transparent")}>{inner}</div>;
}

function Group({ caption, children, separated }: { caption?: string; children: ReactNode; separated?: boolean }) {
  return (
    <div>
      {separated && <Separator className="my-1" />}
      {caption && <h3 className="px-4 pt-4 pb-1 text-subtitle font-medium text-muted-foreground">{caption}</h3>}
      <ul className="[&>li]:list-none">{children}</ul>
    </div>
  );
}

function Disclaimer() {
  return <p className="px-4 py-4 text-meta text-muted-foreground">{copy.conversationList.disclaimer}</p>;
}

/** 公告弹窗的触发器换成设置里的一行。 */
function AnnouncementsRow() {
  const { account } = useDirectory();
  return (
    <Announcements
      userId={account?.id ?? null}
      renderTrigger={(hasUnread, label) => ({
        render: (
          <button
            type="button"
            aria-label={label || undefined}
            className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-body outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
          />
        ),
        children: (
          <>
            <AnnouncementsBellIcon className="size-5 shrink-0 text-muted-foreground" />
            <span className="flex-1">公告</span>
            {hasUnread && <span className="size-1.5 rounded-full bg-foreground" />}
          </>
        ),
      })}
    />
  );
}

// ---- 变体 A：一类一页 ----

type CategoryA = "profile" | "memories" | "call" | "own-keys" | "sign-in" | "about";
const GROUPS_A: { key: CategoryA; label: string; Icon: IconType }[][] = [
  [
    { key: "profile", label: t.tabs.profile, Icon: ProfileIcon },
    { key: "memories", label: "记忆", Icon: MemoriesIcon },
  ],
  [
    { key: "call", label: t.tabs.call, Icon: PhoneIcon },
    { key: "own-keys", label: t.tabs["own-keys"], Icon: OwnKeysIcon },
  ],
  [{ key: "sign-in", label: t.tabs["sign-in"], Icon: SignInIcon }],
  [{ key: "about", label: "关于", Icon: AboutIcon }],
];
const labelA = (c: CategoryA) => GROUPS_A.flat().find((x) => x.key === c)?.label ?? "";

function AboutRows({ withAnnouncements }: { withAnnouncements?: boolean }) {
  return (
    <>
      <ul className="-mx-4">
        <li>
          <Row href="/about" label={t.about} chevron="always" />
        </li>
        {withAnnouncements && (
          <li>
            <AnnouncementsRow />
          </li>
        )}
        <li>
          <Row href={REPOSITORY_URL} label="GitHub 仓库" />
        </li>
        <li>
          <Row href="/privacy" label="隐私政策" chevron="always" />
        </li>
        <li>
          <Row href="/terms" label="使用条款" chevron="always" />
        </li>
      </ul>
      <p className="py-4 text-meta text-muted-foreground">{copy.conversationList.disclaimer}</p>
    </>
  );
}

const PANELS_A: Record<Exclude<CategoryA, "memories">, ReactNode> = {
  profile: <ProducerProfileSettings />,
  call: <CallSettings />,
  "own-keys": <OwnKeysSettings />,
  "sign-in": (
    <>
      <SignInSettings />
      <AdminEntry />
      <SignOutSettings />
      <DeleteAccount />
    </>
  ),
  about: <AboutRows />,
};

function VariantA({ path }: { path: string[] }) {
  const selected = (GROUPS_A.flat().some((x) => x.key === path[0]) ? path[0] : null) as CategoryA | null;
  const shown = selected ?? "profile"; // 电脑上没选时右边是档案；手机上没选就只有一级列表
  return (
    <TwoPane
      depth={selected ? 1 : 0}
      list={GROUPS_A.map((group, i) => (
        <Group key={i} separated={i > 0}>
          {group.map(({ key, label, Icon }) => (
            <li key={key}>
              <Row href={`/settings/${key}`} Icon={Icon} label={label} isCurrent={key === shown} />
            </li>
          ))}
        </Group>
      ))}
      pane={
        shown === "memories" ? (
          <MemoriesPane />
        ) : (
          <Pane title={labelA(shown)} backHref="/settings">
            {PANELS_A[shown]}
          </Pane>
        )
      }
    />
  );
}

// ---- 变体 B：iOS 式逐项 ----

const g = t.profile;
const genderLabel = (p: ProducerProfile | null) =>
  p?.gender === "male" ? g.male : p?.gender === "female" ? g.female : g.genderDefault;
const timezoneLabel = (p: ProducerProfile | null) => p?.timezone ?? g.timezoneAuto(detectTimezone());
const birthdayLabel = (p: ProducerProfile | null) =>
  p?.birthday ? `${p.birthday.month} 月 ${p.birthday.day} 日` : g.birthdayUnset;
const addressLabel = (p: ProducerProfile | null) => p?.form_of_address || "按各自的习惯";

const SERVICE_TITLES: Record<OwnService, string> = { llm: "LLM", tts: "语音合成", stt: "语音识别" };
function serviceValue(keys: LocalOwnKeys, s: OwnService): string {
  if (s === "llm") return keys.llm ? keys.llm.model : "未填写";
  const k = keys[s];
  return k ? `末 4 位 ${last4(k.api_key)}` : "未填写";
}

/** B 和 C 都要的当前值：档案从服务器读，通话偏好和自带密钥从这个浏览器读。 */
function useCurrentValues() {
  const { account } = useDirectory();
  const [profile, setProfile] = useState<ProducerProfile | null>(null);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [call, setCall] = useState<CallPreferences | null>(null);
  const [keys, setKeys] = useState<LocalOwnKeys>({});
  const [micName, setMicName] = useState<string>(t.call.micDefault);
  const pathname = usePathname();

  useEffect(() => {
    getProfile().then(setProfile, () => {});
    listMemories().then((m) => setMemoryCount(m.length), () => {});
    const prefs = loadCallPreferences();
    setCall(prefs);
    if (prefs.micId && navigator.mediaDevices)
      listMicrophones().then(
        (mics) => setMicName(mics.find((m) => m.deviceId === prefs.micId)?.label || "已选的麦克风"),
        () => {},
      );
  }, [pathname]); // 每换一页重读一次，三级页改过的值回到二级就看得到
  useEffect(() => {
    if (account) setKeys(localOwnKeys(account.id));
  }, [account, pathname]);

  return { account, profile, setProfile, memoryCount, call, setCall, keys, micName };
}

type CategoryB = CategoryA;

function VariantB({ path }: { path: string[] }) {
  const v = useCurrentValues();
  const { account, profile, memoryCount, call, keys } = v;
  const selected = (GROUPS_A.flat().some((x) => x.key === path[0]) ? path[0] : null) as CategoryB | null;
  const shown = selected ?? "profile";
  const item = path[1] ?? null;

  const owned = (["llm", "tts", "stt"] as OwnService[]).filter((s) => keys[s]);
  const subtitles: Record<CategoryB, string | undefined> = {
    profile: profile ? `${addressLabel(profile)} · ${timezoneLabel(profile)}` : undefined,
    memories: memoryCount === null ? undefined : memoryCount === 0 ? "还没有记忆" : `${memoryCount} 条`,
    call: call ? `${t.call.qualities[call.quality]} · 电话质感${call.phoneTexture ? "开" : "关"}` : undefined,
    "own-keys": owned.length === 0 ? "全部用部署者的服务" : `已填 ${owned.map((s) => SERVICE_TITLES[s]).join("、")}`,
    "sign-in": account ? account.sign_in_methods.map((m) => PROVIDER_LABELS[m.provider]).join("、") : undefined,
    about: undefined,
  };

  const list = GROUPS_A.map((group, i) => (
    <Group key={i} separated={i > 0}>
      {group.map(({ key, label, Icon }) => (
        <li key={key}>
          <Row href={`/settings/${key}`} Icon={Icon} label={label} subtitle={subtitles[key]} isCurrent={key === shown} />
        </li>
      ))}
    </Group>
  ));

  let pane: ReactNode;
  if (shown === "memories") pane = <MemoriesPane />;
  else if (item) pane = <ThirdLevelB category={shown} item={item} values={v} />;
  else pane = <SecondLevelB category={shown} values={v} />;

  return <TwoPane depth={selected ? (item ? 2 : 1) : 0} list={list} pane={pane} />;
}

type Values = ReturnType<typeof useCurrentValues>;

function SecondLevelB({ category, values }: { category: CategoryB; values: Values }) {
  const { profile, call, setCall, keys, account, micName } = values;
  const base = `/settings/${category}`;
  const rows = (items: { slug: string; label: string; value?: string }[]) => (
    <ul className="-mx-4 divide-y">
      {items.map((x) => (
        <li key={x.slug}>
          <Row href={`${base}/${x.slug}`} label={x.label} value={x.value} chevron="always" />
        </li>
      ))}
    </ul>
  );
  let body: ReactNode = null;
  if (category === "profile")
    body = (
      <>
        {rows([
          { slug: "form-of-address", label: g.formOfAddress, value: addressLabel(profile) },
          { slug: "gender", label: g.gender, value: genderLabel(profile) },
          { slug: "timezone", label: g.timezone, value: timezoneLabel(profile) },
          { slug: "birthday", label: g.birthday, value: birthdayLabel(profile) },
        ])}
        <p className="py-3 text-subtitle text-muted-foreground">角色怎么称呼你、怎么对待你。改了就保存，所有设备共用这份档案。</p>
      </>
    );
  if (category === "call" && call)
    body = (
      <>
        {rows([
          { slug: "mic", label: t.call.mic, value: micName },
          { slug: "quality", label: t.call.quality, value: t.call.qualities[call.quality] },
        ])}
        <div className="-mx-4 border-t">
          <Row
            label={t.call.phoneTexture}
            chevron="none"
            end={
              <Switch
                aria-label={t.call.phoneTexture}
                checked={call.phoneTexture}
                onCheckedChange={(on) => setCall(saveCallPreferences({ phoneTexture: on }))}
              />
            }
          />
        </div>
        <p className="py-3 text-subtitle text-muted-foreground">{t.call.phoneTextureHint}</p>
      </>
    );
  if (category === "own-keys")
    body = (
      <>
        <p className="pb-4 text-body text-muted-foreground">{t.ownKeys.summary}</p>
        {rows((["llm", "tts", "stt"] as OwnService[]).map((s) => ({ slug: s, label: SERVICE_TITLES[s], value: serviceValue(keys, s) })))}
        <p className="py-3 text-subtitle text-muted-foreground">{t.ownKeys.perCallLimits}</p>
      </>
    );
  if (category === "sign-in")
    body = (
      <>
        <ul className="-mx-4 divide-y">
          <li>
            <Row
              href={`${base}/methods`}
              label={t.signIn.title}
              value={account?.sign_in_methods.map((m) => PROVIDER_LABELS[m.provider]).join("、")}
              chevron="always"
            />
          </li>
          {account?.is_admin && (
            <li>
              <Row href="/admin" label="后台" chevron="always" />
            </li>
          )}
        </ul>
        <SignOutSettings />
        <DeleteAccount />
      </>
    );
  if (category === "about") body = <AboutRows withAnnouncements />;
  return (
    <Pane title={labelA(category)} backHref="/settings">
      {body}
    </Pane>
  );
}

function ThirdLevelB({ category, item, values }: { category: CategoryB; item: string; values: Values }) {
  const back = `/settings/${category}`;
  const router = useRouter();
  const { profile, setProfile, call, setCall } = values;
  const save = async (change: Partial<ProducerProfile>) => {
    if (!profile) return;
    setProfile(await saveProfile({ ...profile, ...change }));
  };
  let title = "";
  let body: ReactNode = null;

  if (category === "profile" && profile) {
    if (item === "form-of-address") {
      title = g.formOfAddress;
      body = <FormOfAddress initial={profile.form_of_address ?? ""} onSave={(v) => save({ form_of_address: v || null })} />;
    } else if (item === "gender") {
      title = g.gender;
      body = (
        <Choices
          value={profile.gender ?? ""}
          options={[
            { value: "", label: g.genderDefault },
            { value: "male", label: g.male },
            { value: "female", label: g.female },
          ]}
          onChoose={(v) => save({ gender: (v || null) as ProducerProfile["gender"] })}
          hint={g.genderHint}
        />
      );
    } else if (item === "timezone") {
      title = g.timezone;
      body = (
        <TimezonePicker
          value={profile.timezone ?? ""}
          onChoose={async (v) => {
            await save({ timezone: v || null });
            router.push(back);
          }}
        />
      );
    } else if (item === "birthday") {
      title = g.birthday;
      body = <BirthdayPicker initial={profile.birthday} onSave={(b) => save({ birthday: b })} />;
    }
  }
  if (category === "call" && call) {
    if (item === "mic") {
      title = t.call.mic;
      body = <MicPicker value={call.micId} onChoose={(id) => setCall(saveCallPreferences({ micId: id }))} />;
    } else if (item === "quality") {
      title = t.call.quality;
      body = (
        <Choices
          value={call.quality}
          options={(["low", "standard", "high"] as Quality[]).map((q) => ({ value: q, label: t.call.qualities[q] }))}
          onChoose={(q) => setCall(saveCallPreferences({ quality: q as Quality }))}
          hint={t.call.qualityHint}
        />
      );
    }
  }
  if (category === "own-keys" && (item === "llm" || item === "tts" || item === "stt")) {
    title = SERVICE_TITLES[item];
    body = <OwnKeysSettings only={item} />;
  }
  if (category === "sign-in" && item === "methods") {
    title = t.signIn.title;
    body = <SignInSettings />;
  }
  return (
    <Pane title={title} backHref={back} backOnWide>
      {body}
    </Pane>
  );
}

/** 一组单选：一行一个，选中的打勾，点了立即生效。 */
function Choices({
  value,
  options,
  onChoose,
  hint,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChoose: (v: string) => void;
  hint?: string;
}) {
  return (
    <>
      <ul role="radiogroup" className="-mx-4 divide-y">
        {options.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              role="radio"
              aria-checked={o.value === value}
              onClick={() => onChoose(o.value)}
              className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-body outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <span className="flex-1">{o.label}</span>
              {o.value === value && <CheckIcon className="size-4" />}
            </button>
          </li>
        ))}
      </ul>
      {hint && <p className="py-3 text-subtitle text-muted-foreground">{hint}</p>}
    </>
  );
}

function FormOfAddress({ initial, onSave }: { initial: string; onSave: (v: string) => Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(true);
  const id = useId();
  const commit = async () => {
    if (saved) return;
    await onSave(value.trim());
    setSaved(true);
  };
  return (
    <Field className="pt-2">
      <FieldLabel htmlFor={id} className="sr-only">
        {g.formOfAddress}
      </FieldLabel>
      <Input
        id={id}
        value={value}
        maxLength={MAX_FORM_OF_ADDRESS}
        placeholder={g.formOfAddressPlaceholder}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <FieldDescription>{g.formOfAddressHint}</FieldDescription>
      <p role="status" className="text-subtitle text-muted-foreground">
        {saved ? "已保存" : "离开输入框或按回车时保存"}
      </p>
    </Field>
  );
}

function TimezonePicker({ value, onChoose }: { value: string; onChoose: (v: string) => void }) {
  const [query, setQuery] = useState("");
  const zones = listTimezones();
  const auto = g.timezoneAuto(detectTimezone());
  const shown = [
    { value: "", label: auto },
    ...zones.filter((z) => z.toLowerCase().includes(query.toLowerCase())).map((z) => ({ value: z, label: z })),
  ];
  return (
    <>
      <Input
        className="mt-2 mb-2"
        placeholder={g.timezoneSearch}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={g.timezoneSearch}
      />
      <Choices value={value} options={shown.slice(0, 80)} onChoose={onChoose} hint={g.timezoneHint} />
    </>
  );
}

function BirthdayPicker({
  initial,
  onSave,
}: {
  initial: ProducerProfile["birthday"];
  onSave: (b: ProducerProfile["birthday"]) => Promise<void>;
}) {
  const [month, setMonth] = useState<number | null>(initial?.month ?? null);
  const [day, setDay] = useState<number | null>(initial?.day ?? null);
  const months = [{ value: "none", label: g.birthdayUnset }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 月` }))];
  const days = [
    { value: "none", label: g.birthdayUnset },
    ...Array.from({ length: month ? daysInMonth(month) : 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 日` })),
  ];
  const commit = (m: number | null, d: number | null) => {
    if (m === null) onSave(null);
    else if (d !== null) onSave({ month: m, day: d });
  };
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <Select
          items={months}
          value={month === null ? "none" : String(month)}
          onValueChange={(v) => {
            const m = v === "none" || !v ? null : Number(v);
            const d = m === null || (day !== null && day > daysInMonth(m)) ? null : day;
            setMonth(m);
            setDay(d);
            commit(m, d);
          }}
        >
          <SelectTrigger aria-label={g.birthMonth} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={days}
          value={day === null ? "none" : String(day)}
          disabled={month === null}
          onValueChange={(v) => {
            const d = v === "none" || !v ? null : Number(v);
            setDay(d);
            commit(month, d);
          }}
        >
          <SelectTrigger aria-label={g.birthDay} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {days.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-subtitle text-muted-foreground">
        {g.birthdayHint}
        {month !== null && day === null ? " 选好日期才保存。" : " 已保存。"}
      </p>
    </div>
  );
}

function MicPicker({ value, onChoose }: { value: string; onChoose: (id: string) => void }) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    listMicrophones().then(setMics, () => {});
  }, []);
  const unnamed = mics.length > 0 && mics.every((m) => !m.label);
  return (
    <>
      <Choices
        value={value}
        options={[
          { value: "", label: t.call.micDefault },
          ...mics.map((m, i) => ({ value: m.deviceId, label: m.label || t.call.micNumbered(i + 1) })),
        ]}
        onChoose={onChoose}
        hint={t.call.micHint}
      />
      {unnamed && (
        <Button
          variant="outline"
          onClick={async () => {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
            s.getTracks().forEach((tr) => tr.stop());
            setMics(await listMicrophones());
          }}
        >
          {t.call.micAllow}
        </Button>
      )}
    </>
  );
}

// ---- 变体 C：节即一级 ----

type PageC = "profile" | "memories" | "call" | OwnService | "sign-in" | "admin" | "sign-out" | "delete";
const TITLES_C: Record<PageC, string> = {
  profile: "制作人档案",
  memories: "记忆",
  call: "麦克风和声音",
  llm: "LLM",
  tts: "语音合成",
  stt: "语音识别",
  "sign-in": "登录方式",
  admin: "后台",
  "sign-out": "退出登录",
  delete: "删除我的全部数据",
};

function VariantC({ path }: { path: string[] }) {
  const { account, keys, call, profile, memoryCount } = useCurrentValues();
  const selected = (path[0] && path[0] in TITLES_C ? path[0] : null) as PageC | null;
  const shown = selected ?? "profile";
  const row = (key: PageC, Icon: IconType, subtitle?: string, tone?: "destructive") => (
    <li key={key}>
      <Row
        href={`/settings/${key}`}
        Icon={Icon}
        label={TITLES_C[key]}
        subtitle={subtitle}
        isCurrent={key === shown}
        tone={tone}
      />
    </li>
  );

  const list = (
    <>
      <Group caption="档案">
        {row("profile", ProfileIcon, profile ? `${addressLabel(profile)} · ${timezoneLabel(profile)}` : undefined)}
        {row("memories", MemoriesIcon, memoryCount === null ? undefined : `${memoryCount} 条`)}
      </Group>
      <Group caption="通话">
        {row("call", PhoneIcon, call ? `${t.call.qualities[call.quality]} · 电话质感${call.phoneTexture ? "开" : "关"}` : undefined)}
      </Group>
      <Group caption="自带密钥">
        {row("llm", LlmIcon, serviceValue(keys, "llm"))}
        {row("tts", TtsIcon, serviceValue(keys, "tts"))}
        {row("stt", MicIcon, serviceValue(keys, "stt"))}
      </Group>
      <Group caption="登录与数据">
        {row("sign-in", SignInIcon, account?.sign_in_methods.map((m) => PROVIDER_LABELS[m.provider]).join("、"))}
        {account?.is_admin && row("admin", DashboardIcon)}
        {row("sign-out", SignOutIcon)}
        {row("delete", TrashIcon, undefined, "destructive")}
      </Group>
      <Group caption="关于">
        <li>
          <Row href="/about" Icon={AboutIcon} label={t.about} chevron="always" />
        </li>
        <li>
          <AnnouncementsRow />
        </li>
        <li>
          <Row href={REPOSITORY_URL} Icon={GitHubIcon} label="GitHub 仓库" />
        </li>
        <li>
          <Row href="/privacy" Icon={PrivacyIcon} label="隐私政策" chevron="always" />
        </li>
        <li>
          <Row href="/terms" Icon={TermsIcon} label="使用条款" chevron="always" />
        </li>
      </Group>
      <Disclaimer />
    </>
  );

  const PANELS: Record<Exclude<PageC, "memories">, ReactNode> = {
    profile: <ProducerProfileSettings />,
    call: <CallSettings />,
    llm: <OwnKeysSettings only="llm" />,
    tts: <OwnKeysSettings only="tts" />,
    stt: <OwnKeysSettings only="stt" />,
    "sign-in": <SignInSettings />,
    admin: <AdminEntry />,
    "sign-out": <SignOutSettings />,
    delete: <DeleteAccount />,
  };

  return (
    <TwoPane
      depth={selected ? 1 : 0}
      list={list}
      pane={
        shown === "memories" ? (
          <MemoriesPane />
        ) : (
          <Pane title={TITLES_C[shown]} backHref="/settings">
            {PANELS[shown]}
          </Pane>
        )
      }
    />
  );
}
