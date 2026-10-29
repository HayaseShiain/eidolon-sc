import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CHARACTERS } from "@/lib/api";
import { contrast, letterEnvelope } from "@/lib/imageColor";

import { letterVars } from "./herVars";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf-8");

/** globals.css 里 `--letter-<name>` 的色值。 */
function letterColor(name: string): string {
  const m = new RegExp(String.raw`--letter-${name}:\s*(#[0-9a-f]{6});`, "i").exec(css);
  if (!m) throw new Error(`globals.css 里没有 --letter-${name}`);
  return m[1];
}

/** 名单上的 29 位，加上 216 色网格（每个通道 00、33、…、ff），和应用里 imageColor.test.ts 的契约一样宽。 */
const steps = ["00", "33", "66", "99", "cc", "ff"];
const colors = [
  ...CHARACTERS.map((c) => ({ what: c.id, color: c.color })),
  ...steps.flatMap((r) => steps.flatMap((g) => steps.map((b) => ({ what: `#${r}${g}${b}`, color: `#${r}${g}${b}` })))),
];

// 信纸、信封固定浅色。横线和信封边线上不放字，不另测。
describe("信上的颜色", () => {
  const paper = letterColor("paper");
  const envelope = letterColor("envelope");

  it("imageColor.ts 里的信封色和 globals.css 一样", () => {
    expect(letterEnvelope).toBe(envelope);
  });

  it("字和字幕在信纸上、抬头在信封上都 ≥ 4.5", () => {
    expect(contrast(letterColor("ink"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(letterColor("muted"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(letterColor("ink"), envelope)).toBeGreaterThanOrEqual(4.5);
  });

  it("她的名字在信封上、署名在信纸上都 ≥ 4.5，封蜡上的星 ≥ 4.5", () => {
    for (const { what, color } of colors) {
      const vars = letterVars(color) as Record<string, string>;
      expect(contrast(vars["--her-letter-ink"], envelope), what).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--her-letter-ink"], paper), what).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--her-seal-fg"], vars["--her-seal"]), what).toBeGreaterThanOrEqual(4.5);
    }
  });
});
