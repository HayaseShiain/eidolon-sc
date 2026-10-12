"use client";

// PROTOTYPE（票 12「原型：应用导航外壳」）：只在 prototype/app-navigation 分支，不进 main。
// 三个变体包住真实的对话、礼物（占位）、设置三页，用 ?variant=A|B|C 切换；切过一次就记在这个标签页里，点导航换页也不丢。
// - A「图标窄栏」：电脑最左一条 64px 只有图标的窄栏，对话、礼物在上，设置在底；手机 dock 三项，进了对话页就藏起来。
//   公告铃铛留在对话列表页首；GitHub 搬进设置的「关于」；「…」菜单拿掉（记忆在设置里）。
// - B「带字窄栏」：72px 窄栏，图标下面带字，对话、礼物、公告、设置一列，GitHub 在底；手机 dock 四项，进了对话页也在，
//   只有输入框拿到焦点（键盘弹起）时藏起来。对话列表页首只剩标题。
// - C「可收起侧栏」：shadcn Sidebar，展开 16rem 带字、收起成 3rem 图标（底部的键或 Ctrl/⌘+B），上面对话、礼物、设置，
//   下面「更多」一组：记忆、公告、GitHub。手机 dock 三项，进了对话页和设置的二级页面都藏起来；手机上铃铛留在列表页首。
// - D「定稿」（2026-10-12 看原型后定）：B 的窄栏和 dock，但公告不进导航栏和 dock，铃铛照 A 留在列表页首；
//   列表底部的免责声明拿掉，搬进设置的「关于」。

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { Announcements } from "@/components/conversations/Announcements";
import { useDirectory } from "@/components/conversations/ConversationDirectory";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copy } from "@/i18n";
import { REPOSITORY_URL } from "@/lib/repository";
import { cn } from "@/lib/utils";
import {
  AnnouncementsBellIcon,
  ConversationsIcon,
  GiftIcon,
  GitHubIcon,
  MemoriesIcon,
  SettingsIcon,
} from "@/theme/icons";

export type NavVariant = "A" | "B" | "C" | "D";

const VARIANTS: { key: NavVariant; name: string }[] = [
  { key: "A", name: "图标窄栏" },
  { key: "B", name: "带字窄栏" },
  { key: "C", name: "可收起侧栏" },
  { key: "D", name: "定稿：B，公告照 A" },
];

// ---- 变体记在地址和 sessionStorage 里 ----

const KEY = "prototype-nav-variant";
const listeners = new Set<() => void>();

function readVariant(): NavVariant {
  const raw = new URLSearchParams(location.search).get("variant") ?? sessionStorage.getItem(KEY) ?? "D";
  return VARIANTS.some((v) => v.key === raw) ? (raw as NavVariant) : "D";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNavVariant(): NavVariant {
  return useSyncExternalStore(subscribe, readVariant, () => "D");
}

export function chooseVariant(v: string) {
  sessionStorage.setItem(KEY, v);
  const url = new URL(location.href);
  url.searchParams.set("variant", v);
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((l) => l());
}

// ---- 三个去处 ----

type Tab = "conversations" | "gifts" | "settings";

const TABS: { tab: Tab; label: string; href: string; Icon: typeof GiftIcon }[] = [
  { tab: "conversations", label: "对话", href: "/conversations", Icon: ConversationsIcon },
  { tab: "gifts", label: "礼物", href: "/gifts", Icon: GiftIcon },
  { tab: "settings", label: "设置", href: "/settings", Icon: SettingsIcon },
];
const tabOf = (t: Tab) => TABS.find((x) => x.tab === t)!;

function currentTab(pathname: string): Tab {
  if (pathname.startsWith("/gifts")) return "gifts";
  if (pathname.startsWith("/settings")) return "settings";
  return "conversations";
}

/** 设置页报上来自己是不是在二级页面（手机上 C 这时藏 dock）。 */
const SubpageContext = createContext<(isSubpage: boolean) => void>(() => {});
export const useReportSubpage = () => useContext(SubpageContext);

/** 手机上输入框拿到焦点，大致就是键盘弹起来了。 */
function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = document.activeElement as HTMLElement | null;
      setTyping(!!el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.getAttribute("type") !== "checkbox") || el.isContentEditable));
    };
    const later = () => setTimeout(check, 0);
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", later);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", later);
    };
  }, []);
  return typing;
}

// ---- 外壳 ----

export function NavShell({ children }: { children: ReactNode }) {
  const variant = useNavVariant();
  const pathname = usePathname();
  const router = useRouter();
  const tab = currentTab(pathname);
  const { leave, account } = useDirectory();
  const [isSubpage, setSubpage] = useState(false);
  const typing = useTyping();
  const inConversation = pathname.startsWith("/conversation/");

  useEffect(() => {
    sessionStorage.setItem(KEY, variant);
  }, [variant]);

  const go = (to: Tab) => {
    if (to === tab && !(to === "conversations" && inConversation)) return;
    leave(() => router.push(tabOf(to).href));
  };

  const dockHidden =
    variant === "B" || variant === "D" ? typing : inConversation || (variant === "C" && tab === "settings" && isSubpage);
  const userId = account?.id ?? null;

  // 每页最外层是 PageShell 那样占满视口（h-dvh）的 div；在外壳里压成占满给它的那一块。
  const content = <div className="relative min-h-0 min-w-0 flex-1 [&>div]:h-full">{children}</div>;
  const dock = !dockHidden && <Dock variant={variant} tab={tab} go={go} userId={userId} />;
  // 票 13：导航固定用定稿的 D，切换条让给设置的变体。
  const switcher = null;

  if (variant === "C") {
    return (
      <SubpageContext.Provider value={setSubpage}>
        <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
          <SideNav tab={tab} go={go} userId={userId} onMemories={() => leave(() => router.push("/memories"))} />
          <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
            {content}
            {dock}
          </SidebarInset>
        </SidebarProvider>
        {switcher}
      </SubpageContext.Provider>
    );
  }

  return (
    <SubpageContext.Provider value={setSubpage}>
      <div className="flex h-dvh overflow-hidden bg-background text-foreground max-md:flex-col">
        {variant === "A" ? (
          <IconRail tab={tab} go={go} />
        ) : (
          <LabelRail tab={tab} go={go} userId={userId} withAnnouncements={variant === "B"} />
        )}
        {content}
        {dock}
      </div>
      {switcher}
    </SubpageContext.Provider>
  );
}

// ---- A：只有图标的窄栏 ----

function IconRail({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  return (
    <nav aria-label="应用" className="flex w-16 shrink-0 flex-col items-center gap-2 border-r py-3 max-md:hidden">
      <RailIcon item={tabOf("conversations")} isActive={tab === "conversations"} onClick={() => go("conversations")} />
      <RailIcon item={tabOf("gifts")} isActive={tab === "gifts"} onClick={() => go("gifts")} />
      <div className="flex-1" />
      <RailIcon item={tabOf("settings")} isActive={tab === "settings"} onClick={() => go("settings")} />
    </nav>
  );
}

function RailIcon({ item, isActive, onClick }: { item: (typeof TABS)[number]; isActive: boolean; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            onClick={onClick}
            className={cn("size-11 [&_svg:not([class*='size-'])]:size-5.5", isActive ? "bg-muted" : "text-muted-foreground")}
          />
        }
      >
        <item.Icon />
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

// ---- B：带字的窄栏 ----

const labelItem =
  "flex w-16 flex-col items-center gap-1 rounded-lg py-1 text-meta outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function LabelInner({ Icon, label, isActive, dot }: { Icon: typeof GiftIcon; label: string; isActive: boolean; dot?: boolean }) {
  return (
    <>
      <span
        className={cn(
          "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors",
          isActive ? "bg-muted text-foreground" : "text-muted-foreground group-hover:bg-muted/60",
        )}
      >
        <Icon className="size-5" />
        {dot && <span aria-hidden className="absolute top-1 right-3 size-1.5 rounded-full bg-foreground" />}
      </span>
      <span className={isActive ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
    </>
  );
}

function LabelRail({
  tab,
  go,
  userId,
  withAnnouncements,
}: {
  tab: Tab;
  go: (t: Tab) => void;
  userId: string | null;
  withAnnouncements: boolean;
}) {
  const item = (t: Tab) => {
    const x = tabOf(t);
    return (
      <button
        key={t}
        type="button"
        aria-current={tab === t ? "page" : undefined}
        onClick={() => go(t)}
        className={cn("group", labelItem)}
      >
        <LabelInner Icon={x.Icon} label={x.label} isActive={tab === t} />
      </button>
    );
  };
  return (
    <nav aria-label="应用" className="flex w-18 shrink-0 flex-col items-center gap-2 border-r py-3 max-md:hidden">
      {item("conversations")}
      {item("gifts")}
      {withAnnouncements && (
        <Announcements
          userId={userId}
          renderTrigger={(unread, label) => ({
            render: <button type="button" aria-label={label} className={cn("group", labelItem)} />,
            children: <LabelInner Icon={AnnouncementsBellIcon} label="公告" isActive={false} dot={unread} />,
          })}
        />
      )}
      {item("settings")}
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={copy.app.repositoryLabel}
        nativeButton={false}
        className="text-muted-foreground"
        render={<a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" />}
      >
        <GitHubIcon />
      </Button>
    </nav>
  );
}

// ---- C：shadcn Sidebar ----

function SideNav({
  tab,
  go,
  userId,
  onMemories,
}: {
  tab: Tab;
  go: (t: Tab) => void;
  userId: string | null;
  onMemories: () => void;
}) {
  return (
    <Sidebar collapsible="icon" aria-label="应用">
      <SidebarHeader className="h-14 justify-center px-4 group-data-[collapsible=icon]:px-2">
        <p className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">{copy.app.name}</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {TABS.map((x) => (
                <SidebarMenuItem key={x.tab}>
                  <SidebarMenuButton
                    isActive={tab === x.tab}
                    tooltip={x.label}
                    aria-current={tab === x.tab ? "page" : undefined}
                    onClick={() => go(x.tab)}
                  >
                    <x.Icon />
                    <span>{x.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>更多</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="记忆" onClick={onMemories}>
                  <MemoriesIcon />
                  <span>记忆</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Announcements
                  userId={userId}
                  renderTrigger={(unread, label) => ({
                    render: <SidebarMenuButton aria-label={label} className="relative" />,
                    children: (
                      <>
                        <AnnouncementsBellIcon />
                        <span>公告</span>
                        {unread && (
                          <span aria-hidden className="absolute top-1.5 left-5 size-1.5 rounded-full bg-foreground" />
                        )}
                      </>
                    ),
                  })}
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="GitHub"
                  render={<a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" />}
                >
                  <GitHubIcon />
                  <span>GitHub</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarTrigger aria-label="收起或展开导航栏" />
      </SidebarFooter>
    </Sidebar>
  );
}

// ---- 手机底部的 dock ----

function Dock({ variant, tab, go, userId }: { variant: NavVariant; tab: Tab; go: (t: Tab) => void; userId: string | null }) {
  const item = (t: Tab) => {
    const x = tabOf(t);
    const isActive = tab === t;
    return (
      <button
        key={t}
        type="button"
        aria-current={isActive ? "page" : undefined}
        onClick={() => go(t)}
        className="flex h-14 flex-col items-center justify-center gap-0.5 text-meta outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <x.Icon className={cn("size-6", isActive ? "text-foreground" : "text-muted-foreground")} />
        <span className={isActive ? "font-medium text-foreground" : "text-muted-foreground"}>{x.label}</span>
      </button>
    );
  };
  return (
    <nav
      aria-label="应用"
      className="grid shrink-0 auto-cols-fr grid-flow-col border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {item("conversations")}
      {item("gifts")}
      {variant === "B" && (
        <Announcements
          userId={userId}
          renderTrigger={(unread, label) => ({
            render: (
              <button
                type="button"
                aria-label={label}
                className="flex h-14 flex-col items-center justify-center gap-0.5 text-meta outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              />
            ),
            children: (
              <>
                <span className="relative">
                  <AnnouncementsBellIcon className="size-6 text-muted-foreground" />
                  {unread && <span aria-hidden className="absolute top-0 -right-0.5 size-1.5 rounded-full bg-foreground" />}
                </span>
                <span className="text-muted-foreground">公告</span>
              </>
            ),
          })}
        />
      )}
      {item("settings")}
    </nav>
  );
}
