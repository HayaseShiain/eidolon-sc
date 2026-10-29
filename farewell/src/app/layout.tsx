import "./globals.css";
import "./(landing)/landing.css";

import type { Metadata } from "next";
import localFont from "next/font/local";

import { copy } from "@/i18n";
import { SITE_URL } from "@/lib/repository";

import { TIER_SCRIPT } from "./(landing)/tierScript";

/**
 * 标题、描述和分享卡片（Open Graph、Twitter 卡片）。卡片的图是 (landing) 下的 opengraph-image.jpg，
 * Next 按文件约定给 `/` 和 `/thanks` 都加上；X 没有 twitter:image 时用 og:image，不另放一份。
 * 卡片要绝对地址：告别站是静态导出的，没有请求可拼，域名写死。
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: copy.app.name,
  description: copy.app.description,
  openGraph: {
    type: "website",
    url: "/",
    siteName: copy.app.name,
    locale: "zh_CN",
    title: copy.share.title,
    description: copy.share.description,
  },
  twitter: {
    card: "summary_large_image",
    title: copy.share.title,
    description: copy.share.description,
  },
};

// 落地页的字体：按落地页实际用字做的静态子集，自托管（scripts/landing-fonts.mts 生成，改了文案或角色
// 要重新生成）。每种两份：`-act0` 只有第 0 幕上的字，很小，首屏预载它；完整子集不预载，等页面要用到
// 第 0 幕以外的字时再取，免得和首屏的 CSS 抢带宽。样式表里两份排在同一个字体栈里，前一份没有的字
// 落到后一份（landing.css 的 --lp-ja 等）。
// 回退字体的度量由 landing.css 里的字体栈负责：子集的度量不代表整套字体，不让 next/font 去推算。
const jaAct0 = localFont({
  src: "./(landing)/fonts/shippori-mincho-b1-600-act0.woff2",
  weight: "600",
  variable: "--lp-font-ja-act0",
  adjustFontFallback: false,
});
const ja = localFont({
  src: "./(landing)/fonts/shippori-mincho-b1-600.woff2",
  weight: "600",
  variable: "--lp-font-ja",
  adjustFontFallback: false,
  preload: false,
});
const zhTitleAct0 = localFont({
  src: "./(landing)/fonts/noto-serif-sc-600-act0.woff2",
  weight: "600",
  variable: "--lp-font-zh-title-act0",
  adjustFontFallback: false,
});
const zhTitle = localFont({
  src: "./(landing)/fonts/noto-serif-sc-600.woff2",
  weight: "600",
  variable: "--lp-font-zh-title",
  adjustFontFallback: false,
  preload: false,
});
const zhAct0 = localFont({
  src: "./(landing)/fonts/noto-sans-sc-400-act0.woff2",
  weight: "400",
  variable: "--lp-font-zh-act0",
  adjustFontFallback: false,
});
const zh = localFont({
  src: "./(landing)/fonts/noto-sans-sc-400.woff2",
  weight: "400",
  variable: "--lp-font-zh",
  adjustFontFallback: false,
  preload: false,
});

const fontVariables = [jaAct0, ja, zhTitleAct0, zhTitle, zhAct0, zh].map((f) => f.variable).join(" ");

/**
 * 告别站的根 layout，照抄应用里落地页的根 layout（ADR-0016 修订）：只用落地页的字体子集；全局样式表
 * 只为按钮（shadcn）引入。永远深色，不跟随系统。
 *
 * <head> 里的内联脚本在页面画出来之前定档，写到 <html> 的 data-lp-* 上（tierScript.ts）；
 * 这几个属性不是 React 渲染的，所以 <html> 不比对它们（suppressHydrationWarning）。
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`dark ${fontVariables}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TIER_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
