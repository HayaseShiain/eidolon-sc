import { afterEach, describe, expect, it, vi } from "vitest";

import type { Character } from "@/lib/api";
import {
  FALLBACK_WRITER,
  LEAD_IN,
  finishesAt,
  hasSeenLetter,
  markLetterSeen,
  partsOf,
  writerOf,
  written,
  type Letter,
} from "@/lib/letter";
import type { Stats, TierGroup } from "@/lib/stats";

/** 偶像顺序：真乃、灯織、めぐる，最后是はづき。 */
const characters = ["mano", "hiori", "meguru", "hazuki"].map((id) => ({ id }) as Character);

function stats(turns: Record<string, number>, affinity: TierGroup[] | null = null): Stats {
  return {
    days_known: 40,
    visits: { current: 1, longest: 1 },
    all_hours: Array(24).fill(0),
    heatmap: { from: "2025-09-22", counts: [] },
    affinity,
    achievements: null,
    range: {
      span: "all",
      turns: 0,
      by_hour: Array(24).fill(0),
      characters: Object.entries(turns).map(([character_id, n]) => ({
        character_id,
        turns: n,
        days_known: 1,
        call_seconds: 0,
      })),
      calls: { count: 0, seconds: 0 },
      gifts: null,
    },
  };
}

const everyone = () => true;

describe("谁来写", () => {
  it("好感度档位最高的那位，哪怕回合数少", () => {
    const affinity: TierGroup[] = [
      { tier: "trust", characters: ["mano"] },
      { tier: "close", characters: ["meguru"] },
    ];
    expect(writerOf(stats({ mano: 50, meguru: 3 }, affinity), characters, everyone)).toBe("meguru");
  });

  it("同档的比回合数，再一样按偶像顺序", () => {
    const affinity: TierGroup[] = [{ tier: "close", characters: ["mano", "hiori", "meguru"] }];
    expect(writerOf(stats({ mano: 3, hiori: 9, meguru: 9 }, affinity), characters, everyone)).toBe("hiori");
  });

  it("好感度关着时只比回合数", () => {
    expect(writerOf(stats({ mano: 3, meguru: 4 }), characters, everyone)).toBe("meguru");
  });

  it("没有回合的人不算，哪怕她在高档位", () => {
    const affinity: TierGroup[] = [
      { tier: "trust", characters: ["mano"] },
      { tier: "intimate", characters: ["hiori"] },
    ];
    expect(writerOf(stats({ mano: 1, hiori: 0 }, affinity), characters, everyone)).toBe("mano");
  });

  it("谁都没有回合时是はづき", () => {
    expect(writerOf(stats({}), characters, everyone)).toBe(FALLBACK_WRITER);
  });

  it("没有信的人不算；连はづき的信也没有时没人写", () => {
    expect(writerOf(stats({ mano: 9, hiori: 1 }), characters, (id) => id !== "mano")).toBe("hiori");
    expect(writerOf(stats({}), characters, () => false)).toBeNull();
  });
});

const letter: Letter = {
  salutation: "プロデューサーさんへ",
  signature: "真乃より",
  paragraphs: [
    { ja: "えっと、こんにちは。", zh: "那个，你好。" },
    { ja: "またね", zh: "再见" },
  ],
  audio: null,
};

describe("时间轴", () => {
  it("有音频时照音频里每段的起止", () => {
    const parts = partsOf({ ...letter, audio: { url: "x.mp3", segments: [[1.2, 2], [2.6, 5], [5.9, 7], [8, 9]] } });
    expect(parts.map((p) => [p.kind, p.start, p.end])).toEqual([
      ["salutation", 1.2, 2],
      ["paragraph", 2.6, 5],
      ["paragraph", 5.9, 7],
      ["signature", 8, 9],
    ]);
    expect(parts[1].zh).toBe("那个，你好。");
    expect(finishesAt(parts)).toBe(9);
  });

  it("没有音频时按字数估，从拆开后的静音之后开始，一块接一块", () => {
    const parts = partsOf(letter);
    expect(parts[0].start).toBe(LEAD_IN);
    for (let i = 1; i < parts.length; i++) expect(parts[i].start).toBeGreaterThan(parts[i - 1].end);
  });

  it("每个字在这一块的起止之间写出，第一个在开头，标点后面多停一下", () => {
    const [, paragraph] = partsOf({ ...letter, audio: { url: "x.mp3", segments: [[0, 1], [10, 20], [21, 22], [23, 24]] } });
    expect(paragraph.at[0]).toBe(10);
    expect(paragraph.at.every((t) => t >= 10 && t < 20)).toBe(true);
    // 「えっと、こ」：「、」后面的「こ」比前面几个字之间隔得久。
    const gap = (i: number) => paragraph.at[i] - paragraph.at[i - 1];
    expect(gap(4)).toBeGreaterThan(gap(3) * 2);
  });

  it("到第几秒写出了几个字", () => {
    const [salutation] = partsOf(letter);
    expect(written(salutation, 0)).toBe(0);
    expect(written(salutation, salutation.start)).toBe(1);
    expect(written(salutation, salutation.end)).toBe(salutation.chars.length);
  });
});

describe("看过没有", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("按用户分开记在这台设备上", () => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    });
    expect(hasSeenLetter("u1")).toBe(false);
    markLetterSeen("u1");
    expect(hasSeenLetter("u1")).toBe(true);
    expect(hasSeenLetter("u2")).toBe(false);
  });

  it("存不了时当作没看过，记的时候也不出错", () => {
    const unreachable = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: unreachable, setItem: unreachable });
    expect(hasSeenLetter("u1")).toBe(false);
    expect(() => markLetterSeen("u1")).not.toThrow();
  });
});
