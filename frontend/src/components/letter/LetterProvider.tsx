"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { useDirectory } from "@/components/conversations/ConversationDirectory";
import { getStats, type Character } from "@/lib/api";
import { hasSeenLetter, markLetterSeen, writerOf, type Letter } from "@/lib/letter";
import { showsNav } from "@/lib/navShell";

const LetterLayer = lazy(() => import("./LetterLayer").then((m) => ({ default: m.LetterLayer })));

type LetterContextValue = {
  /** 写信的人和她的信；还没算出来、或者没人写时是 null（对话列表页首就没有信封键）。 */
  shown: { writer: Character; letter: Letter } | null;
  /** 重读：对话列表页首的信封键。 */
  open: () => void;
  /** 信封键：信收起时信封飞进它里面。 */
  button: RefObject<HTMLButtonElement | null>;
};

const LetterContext = createContext<LetterContextValue | null>(null);

export function useLetter(): LetterContextValue | null {
  return useContext(LetterContext);
}

/**
 * 停服前最后一版的信（last-letter 分支，lib/letter）：登录后算出谁来写，这台设备上这个账号没看过的话，
 * 在导航外壳里第一次能出现的时候整屏打开。酒吧页上不出，有通话时（不论通话层展开没有）也不出，等到能出的那一页再出。
 * 看过以后从对话列表页首的信封键重读。信和字体只在算出写信的人、打开信的时候才载入。
 */
export function LetterProvider({ children }: { children: ReactNode }) {
  const { account, characters, call } = useDirectory();
  const pathname = usePathname();
  const [shown, setShown] = useState<LetterContextValue["shown"]>(null);
  const [isOpen, setOpen] = useState(false);
  const autoOpened = useRef(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const userId = account?.id ?? null;
  const roster = useRef(characters);
  roster.current = characters;
  const hasRoster = characters !== null;

  useEffect(() => {
    if (!userId || !hasRoster) return;
    let live = true;
    Promise.all([getStats("all"), import("./letters.json")])
      .then(([stats, data]) => {
        const letters = data.default as unknown as Record<string, Letter>;
        const everyone = roster.current ?? [];
        // 网址带 ?letter=<角色标识> 时直接打开她的信，不论谁该写、看没看过：挨个看 29 封信用。
        const asked = new URLSearchParams(window.location.search).get("letter");
        const id = asked && asked in letters ? asked : writerOf(stats, everyone, (id) => id in letters);
        const writer = everyone.find((c) => c.id === id);
        if (!live || !writer) return;
        setShown({ writer, letter: letters[writer.id] });
        if (asked === writer.id) {
          autoOpened.current = true;
          setOpen(true);
        }
      })
      .catch(() => {
        // 统计拉不到就不出信，不打扰正常使用。
      });
    return () => {
      live = false;
    };
  }, [userId, hasRoster]);

  const isBlocked = call !== null || !showsNav(pathname);
  useEffect(() => {
    if (!shown || !userId || isBlocked || autoOpened.current) return;
    autoOpened.current = true;
    if (!hasSeenLetter(userId)) setOpen(true);
  }, [shown, userId, isBlocked]);

  const open = useCallback(() => setOpen(true), []);
  const closed = useCallback(() => {
    if (userId) markLetterSeen(userId);
    setOpen(false);
  }, [userId]);

  return (
    <LetterContext.Provider value={{ shown, open, button }}>
      {children}
      {isOpen && shown && (
        <Suspense fallback={null}>
          <LetterLayer writer={shown.writer} letter={shown.letter} target={button} onClosed={closed} />
        </Suspense>
      )}
    </LetterContext.Provider>
  );
}
