import { afterEach, describe, expect, it, vi } from "vitest";

import { CHARACTERS } from "@/lib/api";
import {
  LEAD_IN,
  LETTERS,
  SIGNATURE_DELAY,
  SIGNATURE_SECONDS,
  finishesAt,
  markLetterRead,
  partsOf,
  readLetters,
  signsAt,
  written,
  type Letter,
} from "@/lib/letter";

describe("信", () => {
  it("名单上的每一位都有一封，音频的段数和信上的块数对得上", () => {
    for (const c of CHARACTERS) {
      const letter = LETTERS[c.id];
      expect(letter, c.id).toBeDefined();
      expect(letter.audio?.segments.length, c.id).toBe(letter.paragraphs.length + 1);
    }
  });
});

const letter: Letter = {
  salutation: "プロデューサーさんへ",
  signature: "真乃より",
  signature_image: null,
  paragraphs: [
    { ja: "えっと、こんにちは。", zh: "那个，你好。" },
    { ja: "またね", zh: "再见" },
  ],
  audio: null,
};

describe("时间轴", () => {
  it("有音频时照音频里每段的起止；署名不念，念完以后签名", () => {
    const parts = partsOf({ ...letter, audio: { url: "x.mp3", segments: [[1.2, 2], [2.6, 5], [5.9, 7]] } });
    expect(parts.map((p) => [p.kind, p.start, p.end])).toEqual([
      ["salutation", 1.2, 2],
      ["paragraph", 2.6, 5],
      ["paragraph", 5.9, 7],
    ]);
    expect(parts[1].zh).toBe("那个，你好。");
    expect(signsAt(parts)).toBe(7 + SIGNATURE_DELAY);
    expect(finishesAt(parts)).toBe(7 + SIGNATURE_DELAY + SIGNATURE_SECONDS);
  });

  it("没有音频时按字数估，从拆开后的静音之后开始，一块接一块", () => {
    const parts = partsOf(letter);
    expect(parts[0].start).toBe(LEAD_IN);
    for (let i = 1; i < parts.length; i++) expect(parts[i].start).toBeGreaterThan(parts[i - 1].end);
  });

  it("每个字在这一块的起止之间写出，第一个在开头，标点后面多停一下", () => {
    const [, paragraph] = partsOf({ ...letter, audio: { url: "x.mp3", segments: [[0, 1], [10, 20], [21, 22]] } });
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

describe("读过谁", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("记在这台设备上，按读的先后，同一位只记一次", () => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    });
    expect(readLetters()).toEqual([]);
    markLetterRead("mano");
    markLetterRead("hiori");
    markLetterRead("mano");
    expect(readLetters()).toEqual(["mano", "hiori"]);
  });

  it("存的不是名单、名单里混着别的东西时，只认名单里的角色标识", () => {
    const stored = (value: string) => vi.stubGlobal("localStorage", { getItem: () => value, setItem: () => {} });
    stored('{"mano":true}');
    expect(readLetters()).toEqual([]);
    stored('["mano",3,null,"hiori"]');
    expect(readLetters()).toEqual(["mano", "hiori"]);
    stored("{oops");
    expect(readLetters()).toEqual([]);
  });

  it("存不了时当作谁都没读过，记的时候也不出错", () => {
    const unreachable = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: unreachable, setItem: unreachable });
    expect(readLetters()).toEqual([]);
    expect(() => markLetterRead("mano")).not.toThrow();
  });
});
