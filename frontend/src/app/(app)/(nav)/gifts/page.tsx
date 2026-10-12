"use client";

// PROTOTYPE（票 12）：礼物页的占位，里面放什么留给票 14「原型：礼物页」。

import { PageShell } from "@/components/app/PageShell";
import { SubpageHeader } from "@/components/app/SubpageHeader";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { GiftIcon } from "@/theme/icons";

export default function GiftsPage() {
  return (
    <PageShell width="full" header={<SubpageHeader title="礼物" />}>
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GiftIcon />
          </EmptyMedia>
          <EmptyTitle>礼物页</EmptyTitle>
          <EmptyDescription>持有的礼物、抽奖、送礼放在这里，样子留给票 14「原型：礼物页」。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
