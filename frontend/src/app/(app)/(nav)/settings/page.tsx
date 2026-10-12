"use client";

// PROTOTYPE（票 12「原型：应用导航外壳」）：设置进了导航外壳后的粗样子。一级列表有哪些、怎么分组、网址怎么记，
// 留给票 13「原型：像手机设置那样的一级、二级设置页面」。这里只看外壳：电脑上第二栏是一级列表、右边是二级内容；
// 手机上先是一级列表，点进去才是二级页面，页首有返回键。

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AdminEntry } from "@/components/AdminEntry";
import { AppLink } from "@/components/app/AppLink";
import { PageShell } from "@/components/app/PageShell";
import { SettingsSection } from "@/components/app/SettingsSection";
import { CallSettings } from "@/components/CallSettings";
import { useDirectory, useWide } from "@/components/conversations/ConversationDirectory";
import { DeleteAccount } from "@/components/DeleteAccount";
import { OwnKeysSettings } from "@/components/OwnKeysSettings";
import { ProducerProfileSettings } from "@/components/ProducerProfileSettings";
import { useReportSubpage } from "@/components/prototype-nav/NavPrototype";
import { SignInSettings } from "@/components/SignInSettings";
import { SignOutSettings } from "@/components/SignOutSettings";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { copy } from "@/i18n";
import { REPOSITORY_URL } from "@/lib/repository";
import { cn } from "@/lib/utils";
import {
  AboutIcon,
  BackIcon,
  ForwardIcon,
  MemoriesIcon,
  OwnKeysIcon,
  PhoneIcon,
  ProfileIcon,
  SignInIcon,
} from "@/theme/icons";

const t = copy.settings;

type Category = "profile" | "call" | "own-keys" | "sign-in" | "about";

const GROUPS: { key: Category | "memories"; label: string; Icon: typeof AboutIcon }[][] = [
  [
    { key: "profile", label: t.tabs.profile, Icon: ProfileIcon },
    { key: "call", label: t.tabs.call, Icon: PhoneIcon },
    { key: "own-keys", label: t.tabs["own-keys"], Icon: OwnKeysIcon },
  ],
  [{ key: "memories", label: "记忆", Icon: MemoriesIcon }],
  [
    { key: "sign-in", label: t.tabs["sign-in"], Icon: SignInIcon },
    { key: "about", label: "关于", Icon: AboutIcon },
  ],
];
const labelOf = (c: Category) => GROUPS.flat().find((x) => x.key === c)!.label;

const PANELS: Record<Category, ReactNode> = {
  profile: (
    <>
      <ProducerProfileSettings />
      <SettingsSection title={t.memories.title} description={t.memories.hint}>
        <AppLink href="/memories" isStandalone className="self-start">
          {t.memories.manage}
        </AppLink>
      </SettingsSection>
    </>
  ),
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
  about: (
    <div className="flex flex-col gap-4 py-2">
      <AppLink href="/about" isStandalone>
        {t.about}
      </AppLink>
      <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="text-body underline underline-offset-4">
        GitHub 仓库
      </a>
      <AppLink href="/privacy" isStandalone>
        隐私政策
      </AppLink>
      <AppLink href="/terms" isStandalone>
        使用条款
      </AppLink>
    </div>
  ),
};

export default function SettingsPage() {
  const wide = useWide();
  const router = useRouter();
  const { leave } = useDirectory();
  const reportSubpage = useReportSubpage();
  const [selected, setSelected] = useState<Category | null>(null);
  // 电脑上没选时右边默认显示档案；手机上没选就是一级列表。
  const shown = selected ?? (wide ? "profile" : null);

  useEffect(() => {
    reportSubpage(selected !== null);
    return () => reportSubpage(false);
  }, [selected, reportSubpage]);

  return (
    <div className="flex h-dvh min-h-0">
      <nav aria-label={t.title} className={cn("flex w-80 shrink-0 flex-col border-r max-md:w-full max-md:border-r-0", selected && "max-md:hidden")}>
        <header className="flex min-h-14 shrink-0 items-center pt-3 pr-2 pb-2 pl-4">
          <h1 className="text-list-title">{t.title}</h1>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {GROUPS.map((group, i) => (
            <div key={i}>
              {i > 0 && <Separator className="my-1" />}
              <ul>
                {group.map(({ key, label, Icon }) => (
                  <li key={key}>
                    <button
                      type="button"
                      aria-current={key === shown ? "page" : undefined}
                      onClick={() =>
                        key === "memories" ? leave(() => router.push("/memories")) : setSelected(key)
                      }
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left text-body outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                        key === shown && "md:bg-muted",
                      )}
                    >
                      <Icon className="size-5 text-muted-foreground" />
                      <span className="flex-1">{label}</span>
                      <ForwardIcon className="size-4 text-muted-foreground md:hidden" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className={cn("min-w-0 flex-1 [&>div]:h-full", !selected && "max-md:hidden")}>
        <PageShell
          header={
            <div className="flex w-full items-center gap-2">
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={copy.common.back}
                className="-ml-2 md:hidden"
                onClick={() => setSelected(null)}
              >
                <BackIcon />
              </Button>
              <h2 className="min-w-0 flex-1 truncate text-header">{shown && labelOf(shown)}</h2>
            </div>
          }
        >
          {shown && PANELS[shown]}
        </PageShell>
      </div>
    </div>
  );
}
