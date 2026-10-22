"use client";

/**
 * PROTOTYPE（分支 prototype/call-typing，不进 main）：通话层里打字，手机键盘弹起时怎么排。
 * 三种键盘处理办法，`?variant=A|B|C` 切换（左上角的条，切换会整页重载）：
 * - A：浏览器默认，什么都不做。
 * - B：viewport 带 interactive-widget=resizes-content，整层缩到键盘上方，立绘跟着缩。
 * - C：VirtualKeyboard overlaysContent，键盘盖在内容上，只把台词卡和输入栏抬上去，立绘不动。
 * - D：同 B，打字时立绘取景从到膝换成到腰。
 * 通话是假的：不连后端的通话，发出去 1.5 秒后她回一句写死的话。`?c=<角色 id>` 换人。
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { CallLayer, type ProtoTyping } from "@/components/conversations/CallLayer";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Character, Segment } from "@/lib/api";
import type { ShownCall } from "@/lib/liveConversation";
import { CALM, type StandDirection } from "@/lib/standAnimations";
import { herVars } from "@/theme/herVars";

const VARIANTS = {
  A: "浏览器默认",
  B: "整层缩到键盘上方",
  C: "立绘不动、底部抬起",
  D: "同 B，打字时取景到腰",
} as const;
type Variant = keyof typeof VARIANTS;

const REPLIES: { line: Segment; mood: StandDirection["mood"] }[] = [
  { line: { ja: "えへへ、そう言ってもらえると嬉しいです！", zh: "嘿嘿，听你这么说我好开心！" }, mood: "happy" },
  { line: { ja: "えっ、本当ですか？ちょっとびっくりしちゃいました。", zh: "诶，真的吗？吓了我一跳。" }, mood: "surprised" },
  { line: { ja: "うーん……どうでしょう、少し考えさせてください。", zh: "嗯……怎么说呢，让我想一想。" }, mood: "thinking" },
  { line: { ja: "もう、プロデューサーさんったら……恥ずかしいです。", zh: "真是的，制作人先生……好难为情。" }, mood: "shy" },
];

export default function PrototypeCallTyping() {
  const [variant, setVariant] = useState<Variant>("A");
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const isFullScreen = useMediaQuery("(max-width: 767px)", true);
  const layerRef = useRef<HTMLElement | null>(null);

  const [line, setLine] = useState<Segment | null>(null);
  const [previousLine, setPreviousLine] = useState<Segment | null>(null);
  const [stand, setStand] = useState<StandDirection>(CALM);
  const [micMuted, setMicMuted] = useState(false);
  const [textOnly, setTextOnly] = useState(false);
  const [typingOpen, setTypingOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [replies, setReplies] = useState(0);
  const [call] = useState<ShownCall>(() => ({ phase: "connected", dial: 1, since: Date.now(), maxSeconds: null }));

  // 读网址上的办法和角色；B 改 viewport（App Router 自己放了一条 viewport meta，这里改它的 content）。
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("variant");
    const chosen: Variant = v === "B" || v === "C" || v === "D" ? v : "A";
    setVariant(chosen);
    setCharacterId(params.get("c"));
    if (chosen === "B" || chosen === "D") {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
      if (meta) meta.content = `${meta.content}, interactive-widget=resizes-content`;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      let res = await fetch("/api/characters");
      if (res.status === 401) {
        await fetch("/api/auth/dev-login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Sallyn" }),
        });
        res = await fetch("/api/characters");
      }
      if (!res.ok) return setFailure(`读角色失败：${res.status}`);
      const all = (await res.json()) as Character[];
      setCharacter(all.find((c) => c.id === characterId) ?? all.find((c) => c.stand) ?? all[0] ?? null);
    })();
  }, [characterId]);

  if (failure) return <p className="p-4">{failure}</p>;
  if (!character) return <p className="p-4">载入中…</p>;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setSent(text);
    setStand((s) => ({ ...s, looking: true, speaking: false }));
    window.setTimeout(() => {
      const reply = REPLIES[replies % REPLIES.length];
      setReplies((n) => n + 1);
      setPreviousLine(line);
      setLine(reply.line);
      setSent(null);
      setStand({ mood: reply.mood, speaking: !textOnly, looking: true, nod: null });
      window.setTimeout(() => setStand((s) => ({ ...s, speaking: false })), 2500);
    }, 1500);
  };

  const typing: ProtoTyping = {
    keyboard: variant,
    open: typingOpen,
    draft,
    sent,
    onOpen: () => setTypingOpen(true),
    onClose: () => setTypingOpen(false),
    onDraft: setDraft,
    onSend: send,
  };

  return (
    <div style={herVars(character.color)} className="relative h-dvh">
      <CallLayer
        character={character}
        call={call}
        isCollapsed={false}
        layerRef={layerRef}
        isFullScreen={isFullScreen}
        isReducedMotion={false}
        micMuted={micMuted}
        micNotice={null}
        textOnly={textOnly}
        line={line}
        previousLine={previousLine}
        hearing=""
        photo={null}
        affinityCue={null}
        standDirection={stand}
        standOutfits={character.stand ? [character.stand.default_outfit] : []}
        onCollapse={() => {}}
        onHangUp={() => {}}
        onToggleMic={() => setMicMuted((m) => !m)}
        onSwitchMic={() => {}}
        onToggleTextOnly={() => setTextOnly((x) => !x)}
        onRedial={() => {}}
        onDismiss={() => {}}
        onOwnKeys={() => {}}
        giftsOpen={false}
        onGift={() => {}}
        exemptingKeys={null}
        typing={typing}
      />
      <Switcher variant={variant} characterId={character.id} />
    </div>
  );
}

/** 原型的切换条和读数：在左上角、页首下面，不压底栏。读数每 200ms 刷新，看键盘弹起时视口怎么变。 */
function Switcher({ variant, characterId }: { variant: Variant; characterId: string }) {
  const keys = Object.keys(VARIANTS) as Variant[];
  const go = (step: number) => {
    const next = keys[(keys.indexOf(variant) + step + keys.length) % keys.length];
    window.location.search = `?variant=${next}&c=${characterId}`;
  };
  const [reading, setReading] = useState("");
  useEffect(() => {
    const id = window.setInterval(() => {
      const vv = window.visualViewport;
      const vk = (navigator as Navigator & { virtualKeyboard?: { boundingRect: DOMRect } }).virtualKeyboard;
      setReading(
        [
          `inner ${window.innerHeight}`,
          vv ? `vv ${Math.round(vv.height)} @${Math.round(vv.offsetTop)}` : "vv —",
          vk ? `vk ${Math.round(vk.boundingRect.height)}` : "vk 不支持",
          `scrollY ${Math.round(window.scrollY)}`,
        ].join(" · "),
      );
    }, 200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="fixed top-16 left-2 z-50 flex flex-col gap-1 rounded-lg bg-black/70 px-2 py-1 text-meta text-white">
      <div className="flex items-center gap-2">
        <button type="button" className="px-1" onClick={() => go(-1)}>
          ‹
        </button>
        <span>
          {variant}（{VARIANTS[variant]}）
        </span>
        <button type="button" className="px-1" onClick={() => go(1)}>
          ›
        </button>
      </div>
      <span className="tabular-nums">{reading}</span>
    </div>
  );
}
