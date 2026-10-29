import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { act0Text, japaneseText, landingText, letterSubtitleText } from "./fontText";

/** 子集脚本写的清单：要了哪些字（text、act0、letters），每种字体的完整子集和字幕那一份里实际有哪些字（glyphs）。 */
const subset: { text: string; act0: string; letters: string; glyphs: Record<string, string> } = JSON.parse(
  readFileSync(new URL("subset.json", import.meta.url), "utf-8"),
);

function missing(text: string, from: string) {
  const covered = new Set(from);
  return [...text].filter((ch) => !covered.has(ch));
}

const regenerate =
  "在 farewell 目录运行 `node scripts/landing-fonts.mts` 重新生成子集，连同 src/app/(landing)/fonts/ 一起提交。";

describe("落地页的字体子集", () => {
  it("覆盖落地页、统计页的文案、所有角色名、组合名和招呼里的每一个字", () => {
    const lacking = missing(landingText(), subset.text);
    expect(lacking, `字体子集缺这些字：${lacking.join("")}。${regenerate}`).toEqual([]);
  });

  it("首屏预载的那一份覆盖第 0 幕上的每一个字", () => {
    const lacking = missing(act0Text(), subset.act0);
    expect(lacking, `第 0 幕的字体子集缺这些字：${lacking.join("")}。${regenerate}`).toEqual([]);
  });

  it("名字、组合名、招呼的日语原文和幕名，Shippori Mincho B1 里每个字都有", () => {
    const lacking = missing(japaneseText(), subset.glyphs["shippori-mincho-b1-600"]);
    expect(
      lacking,
      `Shippori Mincho B1 没有这些字：${lacking.join("")}，它们会退回别的字体。先确认子集是新的（${regenerate}），仍然缺就是这套字体本身没有这些字。`,
    ).toEqual([]);
  });

  it("每一个字，正文用的 Noto Sans SC 里都有", () => {
    const lacking = missing(landingText(), subset.glyphs["noto-sans-sc-400"]);
    expect(lacking, `Noto Sans SC 的子集没有这些字：${lacking.join("")}，会退回系统字体。${regenerate}`).toEqual([]);
  });

  it("她们的信的字幕里每一个字，字幕那一份 Noto Sans SC 里都有", () => {
    const wanted = letterSubtitleText();
    expect(missing(wanted, subset.letters), `字幕那一份没要这些字。${regenerate}`).toEqual([]);
    const lacking = missing(wanted, subset.glyphs["noto-sans-sc-400-letters"] ?? "");
    expect(lacking, `字幕那一份 Noto Sans SC 没有这些字：${lacking.join("")}，会退回系统字体。${regenerate}`).toEqual([]);
  });
});
