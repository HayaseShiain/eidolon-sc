import "./thanks.css";

import type { CSSProperties } from "react";

import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/i18n";
import { REPOSITORY_URL } from "@/lib/repository";
import { formatCount, formatDate, GIFT_NAMES, ranking, STATS } from "@/lib/stats";

import { idolColors } from "../model/color";

const t = copy.thanks;

export const metadata = { title: `${t.title} · ${copy.app.name}` };

/**
 * `/thanks`：演示站从开站到停机的几组数，最后是感谢。和落地页同一个视觉世界（黑底、落地页的字体和印象色），
 * 排行的横条用落地页光晕的颜色（model/color.ts 的 halo）：官方色太暗的在黑底上抬亮，看得见。不带脚本：整页是静态的 HTML 和 CSS，柱子的数在指针移上去或聚焦时由 CSS 显出来。
 */
export default function Thanks() {
  const s = STATS;
  const ranked = ranking(s.characters);
  const top = ranked[0]?.count || 1;
  const peakHour = Math.max(...s.hours, 1);
  const topGift = s.gifts.top ? (GIFT_NAMES[s.gifts.top.id] ?? null) : null;
  return (
    <div className="lp-root th-root">
      <header className="lp-top">
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost" })}>
          {copy.app.repositoryLabel}
        </a>
        <a href="/letters" className={buttonVariants({ variant: "outline" })}>
          {copy.landing.letters}
        </a>
        <a href="/" className={buttonVariants({ variant: "outline" })}>
          {t.home}
        </a>
      </header>

      <main className="th-main">
        <header className="th-head">
          <h1 className="th-title">{t.title}</h1>
          <p className="th-range">{t.range(formatDate(s.opened), formatDate(s.closed))}</p>
        </header>

        <section className="th-block">
          <Figure value={s.days} unit={t.days} />
          <p className="th-line">{t.producers(formatCount(s.producers))}</p>
        </section>

        <section className="th-block">
          <Figure value={s.messages.producers + s.messages.idols} unit={t.messages} />
          <p className="th-line">{t.messagesSplit(formatCount(s.messages.producers), formatCount(s.messages.idols))}</p>
        </section>

        <section className="th-block">
          <Figure value={s.calls.count} unit={t.calls} />
          <p className="th-line">{t.callTime((s.calls.seconds / 3600).toFixed(1))}</p>
          <p className="th-line">{t.longest(String(Math.round(s.calls.longest_seconds / 60)))}</p>
          <p className="th-line">{t.hungUp(formatCount(s.calls.hung_up))}</p>
        </section>

        <section className="th-block" aria-labelledby="th-ranking">
          <h2 id="th-ranking" className="th-heading">
            {t.ranking}
          </h2>
          <ol className="th-ranking">
            {ranked.map((c) => (
              <li key={c.id} className="th-rank">
                <span className="th-rank-name" lang="ja">
                  {c.name}
                </span>
                <span className="th-rank-track">
                  <span
                    className="th-rank-bar"
                    style={{ "--th-color": idolColors(c.color).halo, "--th-share": c.count / top } as CSSProperties}
                  />
                </span>
                <span className="th-rank-count">{formatCount(c.count)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="th-block" aria-labelledby="th-hours">
          <h2 id="th-hours" className="th-heading">
            {t.hours}
            <span className="th-note">{t.hoursNote}</span>
          </h2>
          <ol className="th-hours">
            {s.hours.map((n, hour) => (
              <li
                key={hour}
                className="th-hour"
                tabIndex={0}
                aria-label={`${hour}:00 ${formatCount(n)}`}
                data-tip={formatCount(n)}
                data-peak={n === peakHour || undefined}
                style={{ "--th-share": n / peakHour } as CSSProperties}
              >
                <span className="th-hour-bar" />
                {hour % 6 === 0 && <span className="th-hour-tick">{hour}</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="th-block th-pair">
          <div>
            <Figure value={s.gifts.count} unit={t.gifts} />
            {topGift && s.gifts.top && (
              <p className="th-line th-gift">
                <img src={`/gifts/${s.gifts.top.id}.webp`} alt="" width={48} height={48} />
                {t.topGift(topGift)}
              </p>
            )}
          </div>
          <div>
            <Figure value={s.memories} unit={t.memories} />
          </div>
        </section>

        <section className="th-block">
          <Figure value={s.bar.visits} unit={t.bar} />
          <p className="th-line">{t.drunk(formatCount(s.bar.drunk))}</p>
        </section>

        <section className="th-closing" aria-label={t.signature}>
          {t.closing.map((line) => (
            <p key={line} className="th-closing-line">
              {line}
            </p>
          ))}
          <p className="th-signature">— {t.signature}</p>
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="th-repo">
            {REPOSITORY_URL.replace("https://", "")}
          </a>
        </section>
      </main>

      <footer className="lp-footer">
        <p>{copy.legal.disclaimer}</p>
      </footer>
    </div>
  );
}

/** 一个大数和它的单位。 */
function Figure({ value, unit }: { value: number; unit: string }) {
  return (
    <p className="th-figure">
      <span className="th-number">{formatCount(value)}</span>
      <span className="th-unit">{unit}</span>
    </p>
  );
}
