import "./letters.css";

import { LetterWall, type WallUnit } from "@/components/letter/LetterWall";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/i18n";
import { CHARACTERS, type Character } from "@/lib/api";
import { LETTERS } from "@/lib/letter";
import { REPOSITORY_URL } from "@/lib/repository";

import { prepareSpectrum } from "../model/spectrum";

const t = copy.letters;

export const metadata = { title: `${t.title} · ${copy.app.name}` };

/**
 * `/letters`：她们的信。演示站停服前最后一版里，登录后她写给制作人的那封信（last-letter 分支），29 位各一封；
 * 告别站没有登录，由访客自己挑一位读、听。和落地页同一个视觉世界（黑底、落地页的字体），信封和信纸是固定的浅色。
 * 页面本身服务端渲染，信封墙和打开以后的信要脚本（LetterWall）。
 */
export default function Letters() {
  return (
    <div className="lp-root lt-root">
      <header className="lp-top">
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost" })}>
          {copy.app.repositoryLabel}
        </a>
        <a href="/" className={buttonVariants({ variant: "outline" })}>
          {t.home}
        </a>
      </header>

      <main className="lt-main">
        <h1 className="lt-title">{t.title}</h1>
        <LetterWall units={unitsOf(CHARACTERS)} />
      </main>

      <footer className="lp-footer">
        <p>{copy.legal.disclaimer}</p>
      </footer>
    </div>
  );
}

/** 和落地页的光谱一样按组合分段（prepareSpectrum）：没有组合的（はづき）排在最后的「283プロ」。没有信的人不上墙。 */
function unitsOf(characters: Character[]): WallUnit[] {
  return prepareSpectrum(characters).units.flatMap((unit) => {
    const writers = unit.idols
      .filter((idol) => idol.id in LETTERS)
      .map((idol) => ({ id: idol.id, name: idol.name, color: idol.colors.official }));
    return writers.length > 0 ? [{ name: unit.name ?? copy.landing.act2.others, writers }] : [];
  });
}
