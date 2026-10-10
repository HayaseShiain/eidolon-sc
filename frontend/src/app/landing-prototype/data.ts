/**
 * PROTOTYPE（prototype/landing-page 分支，永不合并）：落地页原型用的偶像名单。
 *
 * 正式实现从 `listCharacters()` 读名单，但它现在不返回 `idol_id`，只能按 characters.toml 手抄一份
 * 来排官方顺序。这是回程交接里要记下的缺口：后端角色列表需要带上 `idol_id`（或已排好序）。
 */

export type Idol = {
  idolId: number;
  id: string;
  name: string;
  color: string;
  unit: number;
  defaultOutfit: string;
};

export const UNITS = [
  "illumination STARS",
  "L'Antica",
  "放課後クライマックスガールズ",
  "ALSTROEMERIA",
  "Straylight",
  "noctchill",
  "SHHis",
  "CoMETIK",
] as const;

/** 原型里真正做出横滚段的组合数：illumination STARS 加上 L'Antica（用来试段与段的整页推入）。 */
export const BUILT_UNITS = 2;

const RAW: [number, string, string, string, number][] = [
  [1, "mano", "櫻木真乃", "#ffbad6", 0],
  [2, "hiori", "風野灯織", "#144384", 0],
  [3, "meguru", "八宮めぐる", "#ffe012", 0],
  [4, "kogane", "月岡恋鐘", "#f84cad", 1],
  [5, "mamimi", "田中摩美々", "#a846fb", 1],
  [6, "sakuya", "白瀬咲耶", "#006047", 1],
  [7, "yuika", "三峰結華", "#3b91c4", 1],
  [8, "kiriko", "幽谷霧子", "#d9f2ff", 1],
  [9, "kaho", "小宮果穂", "#e5461c", 2],
  [10, "chiyoko", "園田智代子", "#f93b90", 2],
  [11, "juri", "西城樹里", "#ffc602", 2],
  [12, "rinze", "杜野凛世", "#89c3eb", 2],
  [13, "natsuha", "有栖川夏葉", "#90e667", 2],
  [14, "amana", "大崎甘奈", "#f54275", 3],
  [15, "tenka", "大崎甜花", "#e75bec", 3],
  [16, "chiyuki", "桑山千雪", "#fbfafa", 3],
  [17, "asahi", "芹沢あさひ", "#f30100", 4],
  [18, "fuyuko", "黛冬優子", "#5ce626", 4],
  [19, "mei", "和泉愛依", "#ff00ff", 4],
  [20, "toru", "浅倉透", "#50d0d0", 5],
  [21, "madoka", "樋口円香", "#be1e3e", 5],
  [22, "koito", "福丸小糸", "#7967c3", 5],
  [23, "hinana", "市川雛菜", "#ffc639", 5],
  [24, "nichika", "七草にちか", "#a6ceb6", 6],
  [25, "mikoto", "緋田美琴", "#760f10", 6],
  [26, "luca", "斑鳩ルカ", "#24130d", 7],
  [27, "hana", "鈴木羽那", "#e0b5d3", 7],
  [28, "haruki", "郁田はるき", "#ead7a4", 7],
];

/** 按官方偶像编号排好的 28 位。 */
export const IDOLS: Idol[] = RAW.map(([idolId, id, name, color, unit]) => ({
  idolId,
  id,
  name,
  color,
  unit,
  defaultOutfit: `stand/1030${String(idolId).padStart(2, "0")}0010`,
})).sort((a, b) => a.idolId - b.idolId);

export const ACT_NAMES = ["序", "分光", "光譜", "ことば", "着信", "記憶", "正直", "はじまり"] as const;
