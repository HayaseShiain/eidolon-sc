import type { CSSProperties } from "react";

import { imageColorScale } from "@/lib/imageColor";

/**
 * 信（/letters）上她的颜色：信纸、信封固定浅色，只有一份。封蜡用分享图色带的那一对（原色和上面的字），
 * 信封上她的名字和署名用 letter.ink（在信封和信纸上都 ≥ 4.5）。
 * 改自应用里的 letterVars（last-letter 分支的 frontend/src/theme/herVars.ts）：那边名字和署名用的 accent.light 是按白纸
 * 校验的，落到比白纸暗的信封上只有 3.7 左右。
 */
export function letterVars(color: string): CSSProperties {
  const { share, letter } = imageColorScale(color);
  return {
    "--her-seal": share.banner,
    "--her-seal-fg": share.onBanner,
    "--her-letter-ink": letter.ink,
  } as CSSProperties;
}
