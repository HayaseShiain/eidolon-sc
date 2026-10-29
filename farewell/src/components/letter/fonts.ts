import localFont from "next/font/local";

// 信上的两种字，只在 /letters 载入。
//
// 她的字：Klee One（SIL OFL 1.1）按 29 封信用到的字和全部角色名做的子集（last-letter 分支的 scripts/last_letter.py 生成）。
// 信封墙上的名字也用它，所以这一页一打开就预载；没到之前字先不显示，免得名字和信写到一半换字体。
export const klee = localFont({
  src: "./fonts/KleeOne-SemiBold.woff2",
  weight: "600",
  variable: "--font-klee",
  display: "block",
  adjustFontFallback: false,
});

// 中文字幕：Noto Sans SC（SIL OFL 1.1）按 29 封信的字幕做的子集（scripts/landing-fonts.mts 生成）。落地页那份子集里没有这些字。
// 不预载：拆开信以后第一段写完才出字幕，信封出来时开始取就来得及。
export const letterZh = localFont({
  src: "./fonts/noto-sans-sc-400-letters.woff2",
  weight: "400",
  variable: "--font-letter-sc",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
