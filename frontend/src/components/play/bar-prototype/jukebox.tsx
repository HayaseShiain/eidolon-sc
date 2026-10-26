// PROTOTYPE（bar 地图票 08）：点唱机。照原版（jukebox_bg、jukebox_list、playlistslot_*、jukebox_done、small_jukebox_obj）：
// 开店前选 12 首（左边 5 首一页、12 页，右边 12 个槽），满 12 首 Ready! 变绿才能开店；
// 店里侧边菜单「点唱机」开关右上角的小播放器（上一首、暂停、下一首、随机、单曲循环）。
// 曲目只在本机（public/prototype-bar/audio/songs/，不进仓库）。

import { useCallback, useEffect, useRef, useState } from "react";

import { Sprite, Txt, useFrames } from "./pieces";

/** 59 首，顺序和显示名照原版（名字原版就缩写好了，只有英文）。 */
export const SONGS = [
  "Hopes and Dreams", "A Neon Glow Lights...", "Welcome to VA-11 HALL-A", "Every Day is Night", "Commencing Simulation",
  "Drive Me Wild", "Good for Health, Bad for...", "Who Was I?", "Troubling News", "A Gaze That Invited...",
  "Friendly Conversation", "You've Got Me", "Umemoto", "JC Elton's", "Go! Go! Streaming-chan!",
  "All Systems, Go!", "Where Do I Go From Here", "Will You Remember Me", "Everything Will Be Okay", "March of the White Kni...",
  "A. Rene", "Safe Haven", "Neo Avatar", "Those Who Dwell in Shadows", "Nighttime Maneuvers",
  "A Star Pierces the Dark...", "Your Love is a Drug", "Through the Storm, We...", "Synthestitch", "Snowfall",
  "The Answer Lies Within", "Dawn Approaches", "With Renewed Hope, We...", "Last Call", "Reminiscence",
  "Believe in Me Who...", "Digital Drive", "The Girl with the Iron Heart", "Metropolis", "Neon District",
  "Karmotrine Dream", "Skyline", "A New Frontier", "Dusk", "Meet The Staff",
  "Heart of the City", "A City That Never Sleeps", "Base of the Titans", "Follow the Trail", "Out of Orbit",
  "Tense", "Underground Club", "Showtime", "An Alternate Reality", "The Assignment",
  "Truth", "Glitch City", "Re: Snowfall", "Re: Base of the Titans",
];
/** 不先选歌时的默认歌单（票 03 笔记 5.3 节挑的轻松曲目）。 */
const DEFAULT_PLAYLIST = [3, 43, 33, 1, 10, 21, 26, 28, 40, 41, 36, 45];
const PAGE = 5;
const PAGES = Math.ceil(SONGS.length / PAGE);
const songUrl = (i: number) => `/prototype-bar/audio/songs/${i}.ogg`;

export type Jukebox = ReturnType<typeof useJukebox>;

/** 歌单和播放：Ready! 之后从第 1 槽开始放，播完按随机 / 单曲循环 / 顺序接下一首。 */
export function useJukebox({ chooseFirst, play }: { chooseFirst: boolean; play: (name: string) => void }) {
  const [slots, setSlots] = useState<(number | null)[]>(() => (chooseFirst ? Array(12).fill(null) : DEFAULT_PLAYLIST));
  const [ready, setReady] = useState(!chooseFirst);
  const [track, setTrack] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState(false);
  const [open, setOpen] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const playlist = slots.filter((s): s is number => s !== null);
  const startTrack = useCallback(
    (t: number) => {
      const song = playlist[t];
      if (song === undefined) return;
      audio.current?.pause();
      const a = new Audio(songUrl(song));
      a.volume = 0.3;
      audio.current = a;
      setTrack(t);
      setPlaying(true);
      void a.play().catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slots],
  );
  const next = useCallback(() => {
    const n = playlist.length;
    if (!n) return;
    startTrack(shuffle ? Math.floor(Math.random() * n) : (track + 1) % n);
  }, [playlist.length, shuffle, track, startTrack]);
  const prev = useCallback(() => {
    const n = playlist.length;
    if (n) startTrack((track - 1 + n) % n);
  }, [playlist.length, track, startTrack]);

  // 一首放完：单曲循环重放，否则下一首（随机时随机）
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onEnded = () => (loop ? startTrack(track) : next());
    a.addEventListener("ended", onEnded);
    return () => a.removeEventListener("ended", onEnded);
  }, [loop, track, next, startTrack]);
  useEffect(() => () => audio.current?.pause(), []);

  return {
    slots,
    setSlots,
    ready,
    track,
    title: playlist[track] !== undefined ? SONGS[playlist[track]] : "",
    playing,
    shuffle,
    loop,
    open,
    /** Ready!：mixdone，从第 1 槽开始放。 */
    finish: () => {
      play("mix");
      setReady(true);
      startTrack(0);
    },
    /** 不先选歌（默认歌单）时，进门开始放。 */
    ensurePlaying: () => {
      if (!audio.current) startTrack(0);
    },
    toggleOpen: () => {
      if (!ready) return;
      play(open ? "noclick" : "mix");
      setOpen((o) => !o);
    },
    togglePause: () => {
      const a = audio.current;
      if (!a) return;
      if (a.paused) {
        void a.play();
        setPlaying(true);
      } else {
        a.pause();
        setPlaying(false);
      }
    },
    next,
    prev,
    toggleShuffle: () => {
      setShuffle((s) => !s);
      setLoop(false);
    },
    toggleLoop: () => {
      setLoop((l) => !l);
      setShuffle(false);
    },
  };
}

/**
 * 选曲界面（640×360 整屏）：底图从上往下擦出约 1.1 秒，擦出时中间横向长出「JUKEBOX 3」；擦完才有控件。
 * 左键点左边曲名放进第一个空槽（可以重复）；点已有曲目的槽选中（变黄），再点另一个对调；右键（手机上长按）清掉一个槽，后面不补位。
 * 鼠标停在曲名上 2.5 秒开始试听，移开淡出。
 */
export function JukeboxSetup({ juke, play, touch }: { juke: Jukebox; play: (name: string) => void; touch: boolean }) {
  const [booted, setBooted] = useState(false);
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [halo, setHalo] = useState<{ slot: number; id: number } | null>(null);
  const [previewing, setPreviewing] = useState<number | null>(null);
  const preview = useRef<HTMLAudioElement | null>(null);
  const loadingFrame = useFrames(4, 133);
  const pressTimer = useRef<number | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setBooted(true);
      play("boot");
    }, 1130);
    return () => window.clearTimeout(id);
  }, [play]);

  // 悬停 2.5 秒试听；移开时淡出
  useEffect(() => {
    if (hover === null) return;
    const id = window.setTimeout(() => {
      const a = new Audio(songUrl(hover));
      a.loop = true;
      a.volume = 0.3;
      preview.current = a;
      setPreviewing(hover);
      void a.play().catch(() => {});
    }, 2500);
    return () => {
      window.clearTimeout(id);
      const a = preview.current;
      preview.current = null;
      setPreviewing(null);
      if (!a) return;
      const fade = window.setInterval(() => {
        a.volume = Math.max(0, a.volume - 0.03);
        if (a.volume <= 0) {
          a.pause();
          window.clearInterval(fade);
        }
      }, 33);
    };
  }, [hover]);

  const full = juke.slots.every((s) => s !== null);
  const add = (song: number) => {
    const at = juke.slots.findIndex((s) => s === null);
    if (at < 0) return;
    play("tab");
    juke.setSlots(juke.slots.map((s, i) => (i === at ? song : s)));
    setHalo({ slot: at, id: ++seq.current });
  };
  const clickSlot = (i: number) => {
    if (juke.slots[i] === null) return;
    if (picked === null) {
      play("jukepick");
      setPicked(i);
      return;
    }
    play("jukechange");
    const next = [...juke.slots];
    [next[picked], next[i]] = [next[i], next[picked]];
    juke.setSlots(next);
    setPicked(null);
  };
  const removeSlot = (i: number) => {
    play("prompt");
    juke.setSlots(juke.slots.map((s, j) => (j === i ? null : s)));
    if (picked === i) setPicked(null);
  };
  const turn = (step: number) => {
    const to = page + step;
    if (to < 0 || to >= PAGES) return play("jukechange");
    play("jukepick");
    setHover(null);
    setPage(to);
  };

  return (
    <div className="pointer-events-auto absolute inset-0">
      <div className="bar-juke-wipe absolute inset-0">
        <Sprite name="juke_frame" x={0} y={0} w={640} h={360} />
      </div>
      {!booted && <Sprite name="juke_startup" x={189} y={60} w={263} h={147} className="bar-juke-startup" />}
      {booted && (
        <>
          {/* 标题框：原版中文版因为字体没有汉字是空的，这里照英文版写上 */}
          <Sprite name="juke_slot_blue" x={25} y={38} w={191} h={25} />
          <Txt x={25} y={44} w={191} runs="请选择一首曲子" size={11} mono color="#3c84cf" align="center" />
          {Array.from({ length: PAGE }, (_, n) => {
            const song = page * PAGE + n;
            if (song >= SONGS.length) return null;
            const top = 78 + n * 30;
            return (
              <div key={song}>
                <Sprite name={hover === song ? "juke_slot_yellow" : "juke_slot_blue"} x={25} y={top} w={191} h={25} />
                <Txt x={25} y={top + 6} w={191} runs={SONGS[song]} size={11} mono align="center" />
                <button
                  type="button"
                  aria-label={SONGS[song]}
                  className="bar-hit pointer-events-auto absolute"
                  style={{ left: 25, top, width: 191, height: 25 }}
                  onMouseEnter={() => {
                    play("hover");
                    setHover(song);
                  }}
                  onMouseLeave={() => setHover((h) => (h === song ? null : h))}
                  onClick={() => add(song)}
                />
              </div>
            );
          })}
          {/* 翻页 */}
          <button type="button" aria-label="上一页" className="bar-hit pointer-events-auto absolute" style={{ left: 26, top: 232, width: 24, height: 24, opacity: page === 0 ? 0.4 : 1 }} onClick={() => turn(-1)}>
            <Sprite name="arrow" x={0} y={0} w={24} h={24} style={{ transform: "scaleX(-1)" }} />
          </button>
          <Txt x={95} y={238} w={60} runs={`${page + 1}/${PAGES}`} size={11} mono align="center" />
          <button type="button" aria-label="下一页" className="bar-hit pointer-events-auto absolute" style={{ left: 193, top: 232, width: 24, height: 24, opacity: page === PAGES - 1 ? 0.4 : 1 }} onClick={() => turn(1)}>
            <Sprite name="arrow" x={0} y={0} w={24} h={24} />
          </button>
          {previewing === null && hover !== null && <Sprite name={`juke_preview_${loadingFrame}`} x={235} y={220} w={95} h={40} />}
          {/* 12 个槽 */}
          {juke.slots.map((song, i) => {
            const left = i < 6 ? 225 : 425;
            const top = 40 + (i % 6) * 30;
            const isPicked = picked === i;
            return (
              <div key={i}>
                <Sprite name={isPicked ? "juke_slot_yellow" : "juke_slot_red"} x={left} y={top} w={191} h={25} />
                <Txt x={left + 4} y={top + 6} w={14} runs={String(i + 1)} size={11} mono color={isPicked ? "#ffbb31" : "#a6023c"} align="center" />
                {song !== null && <Txt x={left + 16} y={top + 6} w={175} runs={SONGS[song]} size={11} mono align="center" />}
                {halo?.slot === i && <div key={halo.id} className="bar-juke-halo absolute" style={{ left, top, width: 191, height: 25, border: "1px solid #fff" }} />}
                <button
                  type="button"
                  aria-label={`第 ${i + 1} 首`}
                  className="bar-hit pointer-events-auto absolute"
                  style={{ left, top, width: 191, height: 25, touchAction: "manipulation" }}
                  onClick={() => clickSlot(i)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    removeSlot(i);
                  }}
                  onPointerDown={(e) => {
                    if (e.pointerType !== "touch") return;
                    pressTimer.current = window.setTimeout(() => {
                      pressTimer.current = null;
                      removeSlot(i);
                    }, 550);
                  }}
                  onPointerUp={() => pressTimer.current && window.clearTimeout(pressTimer.current)}
                  onPointerLeave={() => pressTimer.current && window.clearTimeout(pressTimer.current)}
                />
              </div>
            );
          })}
          {/* Ready! */}
          <Sprite name={full ? "juke_ready_green" : "juke_ready_red"} x={358} y={220} w={58} h={32} />
          <button type="button" aria-label="Ready" className="bar-hit pointer-events-auto absolute" style={{ left: 358, top: 220, width: 58, height: 32 }} onClick={() => full && juke.finish()} />
          {/* 左下文本框里的说明 */}
          <Txt x={26} y={279} w={380} runs="点击左侧的曲名来添加曲目。" size={13} lineHeight={16} color="#fc1783" />
          <Txt
            x={26}
            y={298}
            w={374}
            runs={touch ? "长按曲名可移除曲目，点两首曲目可替换顺序。" : "右键点击曲名可移除曲目，点击两首曲目可替换顺序。"}
            size={13}
            lineHeight={16}
          />
        </>
      )}
    </div>
  );
}

/**
 * 店里的小播放器：盖在右上角 logo 上 (435,27) 188×63，从上往下展开 10 帧。底板随播放 / 暂停换图；
 * 上一首、下一首按下时亮黄、0.44 秒淡出；随机、单曲循环开着时一直亮黄（两者互斥）。曲名在 (442,73)，白字带灰影。
 */
export function SmallPlayer({ juke }: { juke: Jukebox }) {
  const [flash, setFlash] = useState<{ which: "back" | "next"; id: number } | null>(null);
  const seq = useRef(0);
  const hit = (label: string, x0: number, x1: number, y0: number, y1: number, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      className="bar-hit pointer-events-auto absolute"
      style={{ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }}
      onClick={onClick}
    />
  );
  return (
    <div className="bar-juke-open absolute" style={{ left: 0, top: 0, width: 640, height: 360, transformOrigin: "0 27px" }}>
      <Sprite name={juke.playing ? "juke_small_playing" : "juke_small_paused"} x={435} y={27} w={188} h={63} />
      {/* 高亮图不是画在底板左上角，而是画在各按钮对象的位置（碰撞区减去图里的偏移）：随机、循环 (438,29)，上一首、下一首 (439,29) */}
      {juke.shuffle && <Sprite name="juke_shuffle" x={438} y={29} w={188} h={63} />}
      {juke.loop && <Sprite name="juke_loop" x={438} y={29} w={188} h={63} />}
      {flash && <Sprite key={flash.id} name={`juke_${flash.which}`} x={439} y={29} w={188} h={63} className="bar-juke-flash" />}
      <Txt x={442} y={74} runs={juke.title} size={11} mono color="#808080" />
      <Txt x={442} y={73} runs={juke.title} size={11} mono />
      {hit("上一首", 446, 476, 55, 68, () => {
        setFlash({ which: "back", id: ++seq.current });
        juke.prev();
      })}
      {hit("暂停", 482, 499, 49, 74, juke.togglePause)}
      {hit("下一首", 505, 535, 55, 68, () => {
        setFlash({ which: "next", id: ++seq.current });
        juke.next();
      })}
      {hit("随机", 545, 575, 51, 72, juke.toggleShuffle)}
      {hit("单曲循环", 582, 613, 54, 69, juke.toggleLoop)}
    </div>
  );
}
