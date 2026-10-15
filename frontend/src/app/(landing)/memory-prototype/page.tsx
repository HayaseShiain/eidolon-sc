// PROTOTYPE：落地页第 5 幕「记忆」重做成 3D 纪念碑谷式场景。只在 prototype/landing-memory-3d 分支，不进 main。
// 三个变体（?variant=voxel|pixel|paper）只换角色的做法，场景、镜头和叙事三个变体共用。

import { Suspense } from "react";

import { copy } from "@/i18n";

import { MemoryPrototype } from "./MemoryPrototype";

export const metadata = { title: "PROTOTYPE · 记忆 3D" };

export default function Page() {
  return (
    <Suspense>
      <MemoryPrototype title={copy.landing.act5.title} body={copy.landing.act5.body} />
    </Suspense>
  );
}
