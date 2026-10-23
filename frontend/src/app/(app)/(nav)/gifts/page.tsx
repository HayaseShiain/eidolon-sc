import { PlayPrototype } from "@/components/prototype-play/PlayPrototype";
import { giftsFor } from "@/lib/gifts";

/** 礼物页（`/gifts`）：导航外壳里一栏，没有第二栏（DESIGN.md「礼物页」）。从对话页跳来时地址里带着预选的她。
 * PROTOTYPE（play-and-schedule 票 02）：换成玩法页的变体切换。 */
export default async function Gifts({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <PlayPrototype pick={giftsFor(await searchParams)} />;
}
