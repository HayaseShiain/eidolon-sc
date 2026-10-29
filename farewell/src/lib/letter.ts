// 她们的信（/letters）：演示站停服前最后一版里登录后出现的那封信（last-letter 分支），29 位各一封，搬到告别站上由访客
// 自己挑一位读、听。信是事先写好、合成好的（last-letter 分支的 scripts/last_letter.py 生成 data/letters.json，音频和签名图
// 在 CDN 上），这里管每个字什么时候写出来、这台设备上读过谁。

import data from "../../data/letters.json";

/** 一封信，和 letters.json 里的一样：页面上显示的字（不带语气提示）、每段的字幕，和念它的音频（她的声音底下铺着配乐）；
 * `audio.segments` 是抬头、每段正文在音频里的起止秒数，按这个顺序。没合成时没有音频。
 * 署名不念，信上放她手写的签名图（`signature_image`，透明底）；`signature` 是它的替代文字，没有图时照字写出来。 */
export type Letter = {
  salutation: string;
  signature: string;
  signature_image: string | null;
  paragraphs: { ja: string; zh: string }[];
  audio: { url: string; segments: [number, number][] } | null;
};

/** 每位角色的信，按角色标识。JSON 推出来的起止秒数是 `number[][]`，和元组对不上，要先转 unknown。 */
export const LETTERS = data as unknown as Record<string, Letter>;

/** 信封拆开后，音频开头留的静音（秒），和 scripts/last_letter.py 的 LEAD_IN 一致：信纸展开的这段时间她还没开口。 */
export const LEAD_IN = 1.2;

/** 段与段之间的停顿（秒），和 scripts/last_letter.py 一致；没有音频时按它估。 */
const PAUSES = { afterSalutation: 0.6, betweenParagraphs: 0.9 };

/** 念完最后一段后，隔多久签名（秒），和签名从左到右写出来要多久。 */
export const SIGNATURE_DELAY = 0.8;
export const SIGNATURE_SECONDS = 1.6;

/** 没有音频时，估一个字念多久（秒）。 */
const SECONDS_PER_CHAR = 0.15;

/** 信上的一块：抬头或一段正文（带字幕），和它在时间轴上从几秒写到几秒。 */
export type Part = {
  kind: "salutation" | "paragraph";
  /** 一个字一项（按码点拆，不拆坏代理对）。 */
  chars: string[];
  zh: string | null;
  start: number;
  end: number;
  /** 每个字从第几秒起显出来，和 `chars` 一一对应，单调不减。 */
  at: number[];
};

/** 写完一个字之后，下一个字要多等的份量（一个字算 1）：念到标点时她会停一下。 */
function pauseAfter(char: string): number {
  if ("。！？!?".includes(char)) return 3;
  if ("、，,".includes(char)) return 1.5;
  if ("…‥".includes(char)) return 0.8;
  return 0;
}

/** 把一块字摊到 [start, end] 上：每个字占 1 份，标点后面多停几份，最后一个字在 end 之前写出来。 */
function spread(chars: string[], start: number, end: number): number[] {
  const offsets: number[] = [];
  let total = 0;
  for (const char of chars) {
    offsets.push(total);
    total += 1 + pauseAfter(char);
  }
  const span = Math.max(0, end - start);
  return offsets.map((o) => start + (total > 0 ? (span * o) / total : 0));
}

/** 信上的各块，按写的顺序，带时间轴：有音频时照音频里每段的起止，没有时按字数估。 */
export function partsOf(letter: Letter): Part[] {
  const blocks: Omit<Part, "start" | "end" | "at">[] = [
    { kind: "salutation", chars: Array.from(letter.salutation), zh: null },
    ...letter.paragraphs.map((p) => ({ kind: "paragraph" as const, chars: Array.from(p.ja), zh: p.zh })),
  ];
  const times = letter.audio?.segments.length === blocks.length ? letter.audio.segments : estimate(blocks);
  return blocks.map((block, i) => {
    const [start, end] = times[i];
    return { ...block, start, end, at: spread(block.chars, start, end) };
  });
}

function estimate(blocks: { chars: string[] }[]): [number, number][] {
  let at = LEAD_IN;
  return blocks.map((block, i) => {
    const length = Math.max(1, block.chars.length * SECONDS_PER_CHAR);
    const span: [number, number] = [at, at + length];
    at += length + (i === 0 ? PAUSES.afterSalutation : PAUSES.betweenParagraphs);
    return span;
  });
}

/** 到第 `t` 秒，这一块写出了几个字。 */
export function written(part: Part, t: number): number {
  let n = 0;
  while (n < part.at.length && part.at[n] <= t) n++;
  return n;
}

/** 第几秒开始签名：念完最后一段之后。 */
export function signsAt(parts: Part[]): number {
  return (parts.length > 0 ? parts[parts.length - 1].end : 0) + SIGNATURE_DELAY;
}

/** 整封信在第几秒写完：签名写完。 */
export function finishesAt(parts: Part[]): number {
  return signsAt(parts) + SIGNATURE_SECONDS;
}

// 这台设备上读过谁：角色标识按读的先后存在 localStorage（eidolon-farewell.lettersRead），拆开过就算，读完、中途跳过都一样。
// 存不了（隐私模式等）时当作谁都没读过，这次打开页面里读过的由调用方记着。

const READ_KEY = "eidolon-farewell.lettersRead";

export function readLetters(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markLetterRead(id: string): void {
  const read = readLetters();
  if (read.includes(id)) return;
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...read, id]));
  } catch {
    // 存不了就算了，下次打开页面时她的信封还是没拆过的样子。
  }
}
