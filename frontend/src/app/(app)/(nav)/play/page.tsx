import { PlayPage } from "@/components/play/PlayPage";

/** 玩法页第一级（`/play`）：导航外壳里一栏，一张张入口卡，没有第二栏（DESIGN.md「玩法页」）。 */
// PROTOTYPE（cycles 票 06）：`?card=A|B|C` 切「周期」卡的状态写法。
export default async function Play({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const { card } = await searchParams;
  return <PlayPage card={card ?? "A"} />;
}
