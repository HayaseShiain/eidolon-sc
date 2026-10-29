import type { CSSProperties } from "react";

import { contrast, imageColorScale, mix } from "@/lib/imageColor";

/** 信封和信上的墨色，和 globals.css 的 --letter-envelope、--letter-ink 一样（letterContrast.test.ts 核对）。 */
export const LETTER_ENVELOPE = "#f0e6d4";
export const LETTER_INK = "#2b2620";

/**
 * 信（/letters）上她的颜色：信纸、信封固定浅色，只有一份。封蜡用分享图色带的那一对（原色和上面的字），
 * 照抄应用里的 letterVars（last-letter 分支的 frontend/src/theme/herVars.ts）。
 * 信封上她的名字和署名用浅色模式的 accent；它是按白纸校验的，落到比白纸暗的信封上不到 4.5 时，往墨色里压到够为止。
 * 信封比信纸暗，在信封上够了，在信纸上也够。
 */
export function letterVars(color: string): CSSProperties {
  const { share, accent } = imageColorScale(color);
  return {
    "--her-seal": share.banner,
    "--her-seal-fg": share.onBanner,
    "--her-letter-ink": letterInk(accent.light),
  } as CSSProperties;
}

function letterInk(accent: string): string {
  for (let weight = 1; weight > 0; weight -= 0.05) {
    const ink = mix(accent, LETTER_INK, weight);
    if (contrast(ink, LETTER_ENVELOPE) >= 4.5) return ink;
  }
  return LETTER_INK;
}
