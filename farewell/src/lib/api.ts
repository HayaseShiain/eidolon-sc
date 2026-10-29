// 落地页用到的角色和素材的类型，照抄应用 frontend/src/lib/api.ts 里的同名类型（只留落地页读的字段）。
// 告别站没有后端：数据是停机前导出的快照（data/characters.json、data/landing.json，scripts/export.py 生成）。

import characters from "../../data/characters.json";
import landing from "../../data/landing.json";

export type Character = {
  id: string;
  name: string;
  /** Her image colour, `#rrggbb`. */
  color: string;
  /** Her Spine stand; null when the deployment did not serve one. */
  stand: Stand | null;
  /** Her idol number in the original; the list comes in their order, those without one last. */
  idol_id: number | null;
  /** Her name in simplified Chinese as the community writes it; null when not configured. */
  name_zh: string | null;
  /** The name of her unit, from the world setting; null when there is none. */
  unit: string | null;
  /** Where her unit is in the units' official order, from 0; null along with `unit`. */
  unit_order: number | null;
  /** What she says to a visitor on the landing page; null when she has no greeting. */
  greeting: Greeting | null;
  /** What she says first once a visitor answers her call in the landing page's demo. */
  call_opener: CallOpener | null;
  /** Her card on the incoming call in the landing page's demo; null when there is none. */
  call_poster_url: string | null;
  /** Her voxel figure in the landing page's act about memory; null when there is none. */
  voxels_url: string | null;
};

/** A character's greeting (GLOSSARY.md「招呼」). */
export type Greeting = { ja: string; subtitle: string; audio_url: string | null };

/** A character's call opener (GLOSSARY.md「开场白」). */
export type CallOpener = Greeting;

/** Where a character's stand comes from. */
export type Stand = { default_outfit: Outfit; outfits_url: string };

/** One outfit of her stand: `url` is the directory (ending in `/`) holding its Spine files. */
export type Outfit = { id: string; url: string };

/** What the landing page shows that belongs to no one character. */
export type LandingAssets = { memory_still_url: string | null };

/** The characters as the backend listed them when the demo site closed. */
export const CHARACTERS: Character[] = characters;

/** The landing page's pictures as the backend listed them when the demo site closed. */
export const LANDING_ASSETS: LandingAssets = landing;
