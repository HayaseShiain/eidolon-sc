"use client";

// PROTOTYPE（bar 地图票 08）：一次光顾的假状态机（写死的台词，不接模型）加调酒台。三个变体共用，只是画法不同。

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CAPACITY,
  EMPTY,
  glitchName,
  SHORT,
  INGREDIENTS,
  make,
  SCRIPT,
  type Counts,
  type IngredientKey,
  type Line,
  type Made,
  type Order,
  type Verdict,
} from "./data";
import type { Emotion } from "@/lib/standAnimations";

export type Phase = "door" | "talk" | "mixing" | "end";
export type Shake = "idle" | "slow" | "fast" | "done";

/** 原版每帧 1 字、30 帧（票 03）。 */
const CPS = 30;
/** 摇满 5 秒转快摇（mix → blend）。 */
const FAST_AFTER_MS = 5000;

export type Mixer = {
  counts: Counts;
  ice: boolean;
  aged: boolean;
  shake: Shake;
  made: Made | null;
  pulse: { key: IngredientKey | "white"; id: number } | null;
  float: { ok: boolean; id: number } | null;
  /** 调好后那格写的名字：短名，调坏了是乱码。 */
  name: string | null;
};

const FRESH: Mixer = { counts: EMPTY, ice: false, aged: false, shake: "idle", made: null, pulse: null, float: null, name: null };

/** 声音：音效每次新建一个 Audio；打字音效是一段循环（票 03：说话期间循环播，不是每字一声）。 */
function useSound(enabled: boolean, bgm: boolean) {
  const loop = useRef<HTMLAudioElement | null>(null);
  const loopName = useRef<string | null>(null);
  const music = useRef<HTMLAudioElement | null>(null);
  const play = useCallback(
    (name: string) => {
      if (!enabled) return;
      const audio = new Audio(`/prototype-bar/audio/${name}.ogg`);
      audio.volume = 0.5;
      void audio.play().catch(() => {});
    },
    [enabled],
  );
  const setLoop = useCallback(
    (name: string | null) => {
      const want = enabled ? name : null;
      if (loopName.current === want) return;
      loop.current?.pause();
      loop.current = null;
      loopName.current = want;
      if (!want) return;
      const audio = new Audio(`/prototype-bar/audio/${want}.ogg`);
      audio.loop = true;
      audio.volume = 0.35;
      loop.current = audio;
      void audio.play().catch(() => {});
    },
    [enabled],
  );
  useEffect(() => {
    if (!bgm) {
      music.current?.pause();
      music.current = null;
      return;
    }
    const audio = new Audio("/prototype-bar/audio/bgm_last_call.ogg");
    audio.loop = true;
    audio.volume = 0.25;
    music.current = audio;
    void audio.play().catch(() => {});
    return () => audio.pause();
  }, [bgm]);
  useEffect(() => () => loop.current?.pause(), []);
  return { play, setLoop };
}

export function useBar({ sound, bgm, withDoor }: { sound: boolean; bgm: boolean; withDoor: boolean }) {
  const [phase, setPhase] = useState<Phase>(withDoor ? "door" : "talk");
  const [step, setStep] = useState(0);
  const [reaction, setReaction] = useState<Line | null>(null);
  const [typed, setTyped] = useState(0);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [mixer, setMixer] = useState<Mixer>(FRESH);
  const [mood, setMood] = useState<Emotion>("calm");
  /** 这一单的点单备忘；下一单之前一直留着。 */
  const [memo, setMemo] = useState<string | null>(null);
  const { play, setLoop } = useSound(sound, bgm);
  const fastTimer = useRef<number | null>(null);
  const seq = useRef(0);

  const current = SCRIPT[step];
  const order: Order | null = current?.kind === "order" ? current.order : null;
  const line: Line | null = reaction ?? (current?.kind === "line" ? current.line : order ? order.line : null);
  const length = line ? (line.who === "her" ? (line.ja ?? line.zh).length : line.zh.length) : 0;
  const isTyping = phase !== "door" && phase !== "end" && typed < length;

  // 打字：每秒 30 字。
  useEffect(() => {
    if (!isTyping) return;
    const id = window.setInterval(() => setTyped((n) => n + 1), 1000 / CPS);
    return () => window.clearInterval(id);
  }, [isTyping]);

  // 她在说话时循环 bleep_high，制作人 bleep_low；打完、点一下跳完都立刻停。
  useEffect(() => {
    setLoop(isTyping && line ? (line.who === "her" ? "bleep_high" : "bleep_low") : null);
  }, [isTyping, line, setLoop]);

  useEffect(() => {
    if (line?.who === "her") setMood(line.mood);
  }, [line]);

  const enter = useCallback(() => {
    play("door");
    setPhase("talk");
    setTyped(0);
  }, [play]);

  /** 点文本框：没打完就打完整句，打完了翻下一句；点单那句打完再点，开始调酒。 */
  const advance = useCallback(() => {
    if (phase !== "talk" || !line) return;
    if (typed < length) {
      setTyped(length);
      return;
    }
    if (reaction) {
      setReaction(null);
      setStep((s) => s + 1);
      setTyped(0);
      if (SCRIPT[step + 1]?.kind === "end") setPhase("end");
      return;
    }
    if (order) {
      setMemo(order.memo);
      setPhase("mixing");
      play("boot");
      return;
    }
    setStep((s) => s + 1);
    setTyped(0);
    if (SCRIPT[step + 1]?.kind === "end") setPhase("end");
  }, [phase, line, typed, length, reaction, order, step, play]);

  const canMix = phase === "mixing" && mixer.shake === "idle";
  const total = INGREDIENTS.reduce((n, i) => n + mixer.counts[i.key], 0);

  const add = useCallback(
    (key: IngredientKey, delta = 1) => {
      if (!canMix) return play("noclick");
      setMixer((m) => {
        const sum = INGREDIENTS.reduce((n, i) => n + m.counts[i.key], 0);
        const next = m.counts[key] + delta;
        if (next < 0 || (delta > 0 && sum >= CAPACITY)) return m;
        return { ...m, counts: { ...m.counts, [key]: next }, pulse: delta > 0 ? { key, id: ++seq.current } : m.pulse };
      });
      if (delta > 0) play("add");
    },
    [canMix, play],
  );

  const toggle = useCallback(
    (which: "ice" | "aged") => {
      if (!canMix) return play("noclick");
      setMixer((m) => {
        const on = !m[which];
        play(on ? (which === "ice" ? "ice" : "age") : "noclick");
        return { ...m, [which]: on };
      });
    },
    [canMix, play],
  );

  /** 调制 → 停止 → 上酒，同一个按钮（票 03）。调坏的不能上（票 07），按了只响一声。 */
  const mixButton = useCallback(() => {
    if (phase !== "mixing") return play("noclick");
    if (mixer.shake === "idle") {
      if (total === 0) return play("noclick");
      play("mix");
      setMixer((m) => ({ ...m, shake: "slow" }));
      fastTimer.current = window.setTimeout(() => setMixer((m) => (m.shake === "slow" ? { ...m, shake: "fast" } : m)), FAST_AFTER_MS);
      return;
    }
    if (mixer.shake === "slow" || mixer.shake === "fast") {
      if (fastTimer.current) window.clearTimeout(fastTimer.current);
      const made = make(mixer.counts, mixer.ice, mixer.aged, mixer.shake === "slow" ? "mix" : "blend");
      play("mix");
      setMixer((m) => ({
        ...m,
        shake: "done",
        made,
        name: made.drink ? SHORT[made.drink.id] : glitchName(),
        float: { ok: made.drink !== null, id: ++seq.current },
      }));
      return;
    }
    if (!mixer.made?.drink || !order) return play("noclick");
    const verdict = order.judge(mixer.made);
    play("serve");
    setVerdicts((v) => [...v, verdict]);
    setReaction(order.reactions[verdict]);
    setMixer(FRESH);
    setTyped(0);
    setPhase("talk");
  }, [phase, mixer, total, order, play]);

  const reset = useCallback(() => {
    if (phase !== "mixing") return play("noclick");
    if (fastTimer.current) window.clearTimeout(fastTimer.current);
    play(total > 0 || mixer.shake !== "idle" ? "click" : "noclick");
    setMixer({ ...FRESH, pulse: { key: "white", id: ++seq.current } });
  }, [phase, total, mixer.shake, play]);

  // 键盘（票 03）：Q W E R T 加一份、Shift 减一份，A 冰、S 陈化，空格调制 / 停止 / 上酒，Enter 翻页。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      const ingredient = INGREDIENTS.find((i) => i.hotkey === key);
      if (phase === "mixing") {
        if (ingredient) return add(ingredient.key, e.shiftKey ? -1 : 1);
        if (key === "a") return toggle("ice");
        if (key === "s") return toggle("aged");
        if (key === " ") {
          e.preventDefault();
          return mixButton();
        }
      } else if (phase === "talk" && (key === " " || key === "enter")) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, add, toggle, mixButton, advance]);

  /** 原型用：直接跳到第一次点单的调酒。 */
  const jumpToMixing = useCallback(() => {
    const first = SCRIPT.findIndex((s) => s.kind === "order");
    const step = SCRIPT[first];
    setStep(first);
    setReaction(null);
    setTyped(step.kind === "order" ? step.order.line.ja!.length : 0);
    setMemo(step.kind === "order" ? step.order.memo : null);
    setMixer(FRESH);
    setPhase("mixing");
  }, []);

  const restart = useCallback(() => {
    setPhase(withDoor ? "door" : "talk");
    setStep(0);
    setReaction(null);
    setTyped(0);
    setVerdicts([]);
    setMixer(FRESH);
    setMemo(null);
  }, [withDoor]);

  return {
    phase,
    step,
    line,
    typed,
    isTyping,
    isLineDone: !isTyping,
    mood,
    speaking: isTyping && line?.who === "her",
    memo: phase === "mixing" ? memo : null,
    lastMemo: memo,
    order,
    verdicts,
    mixer,
    total,
    canMix,
    enter,
    advance,
    add,
    toggle,
    mixButton,
    reset,
    jumpToMixing,
    restart,
  };
}

export type Bar = ReturnType<typeof useBar>;
