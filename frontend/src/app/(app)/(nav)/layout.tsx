"use client";

// PROTOTYPE（票 12「原型：应用导航外壳」）：对话、礼物、设置三页共用的导航外壳，变体见 NavPrototype。

import type { ReactNode } from "react";

import { DirectoryProvider } from "@/components/conversations/ConversationDirectory";
import { NavShell } from "@/components/prototype-nav/NavPrototype";

export default function NavLayout({ children }: { children: ReactNode }) {
  return (
    <DirectoryProvider>
      <NavShell>{children}</NavShell>
    </DirectoryProvider>
  );
}
