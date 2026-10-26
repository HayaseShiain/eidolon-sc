// PROTOTYPE（bar 地图票 08「原型：酒吧的画面」）：只在 prototype/bar 分支，不进 main。
// 假数据：一位角色（真乃）、两次点单、写死的台词；饮品照票 01 的 drinks.csv（28 款，不收 Flaming Moai）。

import type { Emotion } from "@/lib/standAnimations";

export const HER = {
  name: "真乃",
  color: "#ffbad6",
  outfit: { id: "stand/1030010010", url: "https://stand.hmhnk.top/spine/idols/stand/1030010010/" },
};

export type IngredientKey = "a" | "b" | "d" | "f" | "k";
export const INGREDIENTS: { key: IngredientKey; name: string; hotkey: string }[] = [
  { key: "a", name: "Adelhyde", hotkey: "q" },
  { key: "b", name: "Bronson Ext", hotkey: "w" },
  { key: "d", name: "Pwd Delta", hotkey: "e" },
  { key: "f", name: "Flanergide", hotkey: "r" },
  { key: "k", name: "Karmotrine", hotkey: "t" },
];

export type Flavor = "sweet" | "bitter" | "sour" | "spicy" | "bubbly";
export type Kind = "girly" | "manly" | "classic" | "classy" | "promo";
export const FLAVORS: [Flavor, string][] = [
  ["sweet", "甜味"],
  ["bitter", "苦味"],
  ["sour", "酸味"],
  ["spicy", "辛辣"],
  ["bubbly", "发泡"],
];
export const KINDS: [Kind, string][] = [
  ["girly", "女性化"],
  ["manly", "男性化"],
  ["classic", "经典"],
  ["classy", "时尚"],
  ["promo", "宣传"],
];

export type Drink = {
  id: string;
  name: string;
  /** a b d f k；k 为 null 时可选（加不加、加几份都是这款）。瓶装为 null。 */
  recipe: [number, number, number, number, number | null] | null;
  ice: boolean;
  aged: boolean;
  method: "mix" | "blend" | "bottle";
  /** 本身就是大杯（没有翻倍版）。 */
  big: boolean;
  flavor: Flavor;
  kind: Kind;
  /** 配方卡 `recipe_<page>.png`；瓶装没有。 */
  page: number | null;
  /** 瓶装饮品的一句描述（官方中文）。 */
  note?: string;
};

const d = (
  id: string,
  name: string,
  recipe: Drink["recipe"],
  ice: boolean,
  aged: boolean,
  method: Drink["method"],
  big: boolean,
  flavor: Flavor,
  kind: Kind,
  page: number | null,
  note?: string,
): Drink => ({ id, name, recipe, ice, aged, method, big, flavor, kind, page, note });

export const DRINKS: Drink[] = [
  d("srush", "Sugar Rush", [2, 0, 1, 0, null], false, false, "mix", false, "sweet", "girly", 21),
  d("sstar", "Sparkle Star", [2, 0, 1, 0, null], false, true, "mix", false, "sweet", "girly", 20),
  d("bfairy", "Blue Fairy", [4, 0, 0, 1, null], false, true, "mix", false, "sweet", "girly", 5),
  d("fdream", "Fluffy Dream", [3, 0, 3, 0, null], false, true, "mix", false, "sour", "girly", 9),
  d("scloud", "Sunshine Cloud", [2, 2, 0, 0, null], true, false, "blend", false, "bitter", "girly", 22),
  d("moblast", "Moonblast", [6, 0, 1, 1, 2], true, false, "blend", false, "sweet", "girly", 16),
  d("gpunch", "Gut Punch", [0, 5, 0, 1, null], false, true, "mix", false, "bitter", "manly", 13),
  d("pdriver", "Piledriver", [0, 3, 0, 3, 4], false, false, "mix", false, "bitter", "manly", 19),
  d("splex", "Suplex", [0, 4, 0, 3, 3], true, false, "mix", false, "bitter", "manly", 23),
  d("mablast", "Marsblast", [0, 6, 1, 4, 2], false, false, "blend", true, "spicy", "manly", 14),
  d("cspike", "Crevice Spike", [0, 0, 2, 4, null], false, false, "blend", false, "sour", "manly", 8),
  d("beer", "Beer", [1, 2, 1, 2, 4], false, false, "mix", false, "bubbly", "classic", 2),
  d("bjane", "Bleeding Jane", [0, 1, 3, 3, 0], false, false, "blend", false, "spicy", "classic", 3),
  d("fwater", "Frothy Water", [1, 1, 1, 1, 0], false, true, "mix", false, "bubbly", "classic", 11),
  d("btouch", "Bad Touch", [0, 2, 2, 2, 4], true, false, "mix", false, "sour", "classy", 1),
  d("btini", "Brandtini", [6, 0, 3, 0, 1], false, true, "mix", false, "sweet", "classy", 6),
  d("cvelvet", "Cobalt Velvet", [2, 0, 0, 3, 5], true, false, "mix", false, "bubbly", "classy", 7),
  d("fweaver", "Fringe Weaver", [1, 0, 0, 0, 9], false, true, "mix", false, "bubbly", "classy", 10),
  d("meblast", "Mercury Blast", [1, 1, 3, 3, 2], true, false, "blend", false, "sour", "classy", 15),
  d("gtemple", "Grizzly Temple", [3, 3, 3, 0, 1], false, false, "blend", false, "bitter", "promo", 12),
  d("blight", "Bloom Light", [4, 0, 1, 2, 3], true, true, "mix", false, "spicy", "promo", 4),
  d("zstar", "Zen Star", [4, 4, 4, 4, 4], true, false, "mix", true, "sour", "promo", 24),
  d("pman", "Piano Man", [2, 3, 5, 5, 3], true, false, "mix", true, "sour", "promo", 17),
  d("pwman", "Piano Woman", [5, 5, 2, 3, 3], false, true, "mix", true, "sweet", "promo", 18),
  d("abs", "Absinthe", null, false, false, "bottle", false, "sour", "classic", null, "像呕吐物一样绿的精灵"),
  d("rum", "Rum", null, false, false, "bottle", false, "bitter", "classic", null, "祖父级的酒"),
  d("tea", "Mulan Tea", null, false, false, "bottle", false, "sweet", "classic", null, "调味茶"),
  d("fed", "A Fedora", null, false, false, "bottle", false, "bubbly", "classic", null, "内含香水和李子"),
];

export type Counts = Record<IngredientKey, number>;
export const EMPTY: Counts = { a: 0, b: 0, d: 0, f: 0, k: 0 };
export const CAPACITY = 20;

export type Made = { drink: Drink; big: boolean; alcoholic: boolean } | { drink: null };

/** 精确匹配（票 01）：份数、冰、陈化、mix/blend 和某个配方完全一致，大杯是全部翻倍；对不上就是调坏的。 */
export function make(counts: Counts, ice: boolean, aged: boolean, method: "mix" | "blend"): Made {
  const got = [counts.a, counts.b, counts.d, counts.f];
  for (const drink of DRINKS) {
    if (!drink.recipe || drink.ice !== ice || drink.aged !== aged || drink.method !== method) continue;
    for (const times of drink.big ? [1] : [1, 2]) {
      const [a, b, dl, f, k] = drink.recipe;
      if ([a, b, dl, f].some((n, i) => n * times !== got[i])) continue;
      if (k !== null && k * times !== counts.k) continue;
      return { drink, big: drink.big || times === 2, alcoholic: counts.k > 0 };
    }
  }
  return { drink: null };
}

export type Verdict = "best" | "right" | "wrong";
export type Who = "her" | "me";
export type Line = { who: Who; ja?: string; zh: string; mood: Emotion };
export type Order = {
  line: Line;
  /** 点单备忘（服务器套模板写的那句）。 */
  memo: string;
  judge: (made: Made) => Verdict;
  reactions: Record<Verdict, Line>;
};
export type Step = { kind: "line"; line: Line } | { kind: "order"; order: Order } | { kind: "end" };

const her = (mood: Emotion, ja: string, zh: string): Line => ({ who: "her", ja, zh, mood });
const me = (zh: string): Line => ({ who: "me", zh, mood: "calm" });

export const SCRIPT: Step[] = [
  { kind: "line", line: her("happy", "こんばんは、プロデューサーさん。……えへへ、来ちゃいました", "晚上好，制作人。……嘿嘿，我来了。") },
  { kind: "line", line: me("欢迎光临。坐吧，今天辛苦了。") },
  { kind: "line", line: her("shy", "お店にいるプロデューサーさん、なんだか新鮮です……ほわっ", "在店里的制作人，感觉好新鲜……呼哇。") },
  {
    kind: "order",
    order: {
      line: her("calm", "えっと……シュガーラッシュを、ください", "那个……请给我一杯 Sugar Rush。"),
      memo: "她要 Sugar Rush。",
      judge: (made) => (!made.drink || made.drink.id !== "srush" ? "wrong" : made.alcoholic ? "right" : "best"),
      reactions: {
        best: her("happy", "甘くて、ふわふわです……！ありがとうございます", "甜甜的，软乎乎的……！谢谢你。"),
        right: her("shy", "……ちょっぴり、大人の味です", "……有一点点大人的味道呢。"),
        wrong: her("thinking", "あれ……？これ、シュガーラッシュ……ですか？　でも、いただきますね", "咦……？这个是 Sugar Rush……吗？不过我还是喝啦。"),
      },
    },
  },
  { kind: "line", line: me("今天的工作怎么样？") },
  { kind: "line", line: her("happy", "今日はピーちゃんと公園に行ったんです。鳩さんがいっぱいで……", "今天和小P去了公园。有好多鸽子……") },
  {
    kind: "order",
    order: {
      line: her("shy", "次は……甘くて、お酒じゃないもの、ありますか？", "下一杯……有没有甜甜的、不含酒精的？"),
      memo: "她要甜的，不要酒精。",
      judge: (made) => {
        if (!made.drink || made.drink.flavor !== "sweet" || made.alcoholic) return "wrong";
        return made.drink.id === "bfairy" ? "best" : "right";
      },
      reactions: {
        best: her("surprised", "わぁ、青い……！　歯が青くなっちゃいそうです", "哇，蓝色的……！牙齿好像要变蓝了。"),
        right: her("happy", "ほっとする甘さです……", "让人安心的甜味……"),
        wrong: her("sad", "ふふ……これは、ちょっと苦手かもです", "呵呵……这个，我可能有点喝不惯。"),
      },
    },
  },
  { kind: "line", line: me("路上小心，下次再来。") },
  { kind: "line", line: her("happy", "ごちそうさまでした。また……来てもいいですか？", "多谢款待。我……还可以再来吗？") },
  { kind: "end" },
];
