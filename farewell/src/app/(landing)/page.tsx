import { CHARACTERS, LANDING_ASSETS } from "@/lib/api";

import { Landing } from "./Landing";

/** `/`：落地页。角色和素材读停机前导出的快照，没有后端。 */
export default function Home() {
  return <Landing characters={CHARACTERS} assets={LANDING_ASSETS} />;
}
