"use client";

// PROTOTYPE（proactive-messages 票 06）：用户的搭话开关，只在 prototype/proactive-messages 分支。
// 单独一类「搭话」的页面就是这一节；放在档案页时，在档案表单下面另起一节、拨了马上生效（不跟着档案的「保存」）。

import { useId } from "react";

import { SettingsSection } from "@/components/app/SettingsSection";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { FieldGroup } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

import { useReachOuts, useReachOutsEnabled } from "./ReachOutsPrototype";

export function ReachOutsSettings({ only }: { only?: "profile" }) {
  const s = useReachOuts();
  const [enabled, setEnabled] = useReachOutsEnabled();
  const id = useId();
  if (only === "profile" && s.toggleAt !== "profile") return null;
  return (
    <SettingsSection>
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${id}-reach-outs`}>她们会主动搭话</FieldLabel>
          </FieldContent>
          <Switch id={`${id}-reach-outs`} checked={enabled} onCheckedChange={setEnabled} />
        </Field>
      </FieldGroup>
    </SettingsSection>
  );
}
