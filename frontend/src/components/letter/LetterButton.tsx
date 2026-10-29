"use client";

import { Button } from "@/components/ui/button";
import { copy } from "@/i18n";
import { LetterIcon } from "@/theme/icons";

import { useLetter } from "./LetterProvider";

const t = copy.letter;

/** 对话列表页首的信封键（last-letter 分支）：重读她的信；信收起时信封飞进这里。没人写信时不出现。 */
export function LetterButton() {
  const letter = useLetter();
  if (!letter?.shown) return null;
  return (
    <Button
      ref={letter.button}
      variant="ghost"
      size="icon-lg"
      aria-label={t.reread(letter.shown.writer.name)}
      onClick={letter.open}
    >
      <LetterIcon />
    </Button>
  );
}
