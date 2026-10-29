import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CHARACTERS } from "@/lib/api";
import { contrast } from "@/lib/imageColor";

import { LETTER_ENVELOPE, LETTER_INK, letterVars } from "./herVars";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf-8");

/** globals.css 里 `--letter-<name>` 的色值。 */
function letterColor(name: string): string {
  const m = new RegExp(String.raw`--letter-${name}:\s*(#[0-9a-f]{6});`, "i").exec(css);
  if (!m) throw new Error(`globals.css 里没有 --letter-${name}`);
  return m[1];
}

// 信纸、信封固定浅色。横线和信封边线上不放字，不另测。
describe("信上的颜色", () => {
  const paper = letterColor("paper");
  const envelope = letterColor("envelope");

  it("herVars 里的信封色、墨色和 globals.css 一样", () => {
    expect(LETTER_ENVELOPE).toBe(envelope);
    expect(LETTER_INK).toBe(letterColor("ink"));
  });

  it("字和字幕在信纸上、抬头在信封上都 ≥ 4.5", () => {
    expect(contrast(letterColor("ink"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(letterColor("muted"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(letterColor("ink"), envelope)).toBeGreaterThanOrEqual(4.5);
  });

  it("每一位的名字在信封上、署名在信纸上都 ≥ 4.5，封蜡上的星 ≥ 4.5", () => {
    for (const c of CHARACTERS) {
      const vars = letterVars(c.color) as Record<string, string>;
      expect(contrast(vars["--her-letter-ink"], envelope), c.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--her-letter-ink"], paper), c.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--her-seal-fg"], vars["--her-seal"]), c.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});
