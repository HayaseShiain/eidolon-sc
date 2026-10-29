// 统计页的数：停机时从线上库导出的全站聚合（data/stats.json，scripts/export.py 的 stats），口径见那个脚本。

import gifts from "../../data/gifts.json";
import stats from "../../data/stats.json";

import { CHARACTERS } from "./api";

export type SiteStats = {
  /** 开站日、截止日（北京时间，YYYY-MM-DD）和两头都算的天数。 */
  opened: string;
  closed: string;
  days: number;
  producers: number;
  messages: { producers: number; idols: number };
  calls: { count: number; seconds: number; longest_seconds: number; hung_up: number };
  /** 每位角色的对话里的话（两边都算），按角色标识；一句都没有的不在里面。 */
  characters: Record<string, number>;
  /** 制作人发出的话落在一天里的哪个小时（北京时间），24 个数。 */
  hours: number[];
  gifts: { count: number; top: { id: string; count: number } | null };
  memories: number;
  bar: { visits: number; drunk: number };
};

export const STATS: SiteStats = stats;

/** 礼物标识到名字（快照 data/gifts.json）。 */
export const GIFT_NAMES: Record<string, string> = gifts;

export type RankedCharacter = { id: string; name: string; color: string; count: number };

/** 热度排行：名单上的每一位，按话的多少排，一样多的按名单顺序（偶像编号）。 */
export function ranking(counts: Record<string, number>): RankedCharacter[] {
  return CHARACTERS.map((c) => ({ id: c.id, name: c.name, color: c.color, count: counts[c.id] ?? 0 }))
    .map((c, order) => ({ ...c, order }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map(({ order: _, ...c }) => c);
}

/** 数字的写法：千分位。 */
export const formatCount = (n: number) => n.toLocaleString("zh-CN");

/** 日期的写法：2026.09.25。 */
export const formatDate = (iso: string) => iso.replaceAll("-", ".");
