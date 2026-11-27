import { useState } from "react";
import type { Question } from "../../../lib/mentalist/model";
import { complete } from "../../../lib/mentalist/model";
import StemEditor from "./StemEditor";
import { Visual } from "./Visual";

export default function DisplayAnswer({ question, disabled, onAnswer }: {
  question: Question;
  disabled: boolean;
  onAnswer: (raw: string) => void;
}) {
  const { control, prompt } = question;
  const fields = control.fields!;
  const stem = control.kind === "stem-plot";
  const [parts, setParts] = useState<string[]>(stem ? [] : fields.map(() => "0"));
  const [active, setActive] = useState<number | null>(null);
  const total = /(?:for|data:) ([\d, ]+)[.]/.exec(prompt)?.[1]?.split(",").length ?? 0;
  // The keyed counts are not display limits. Allow enough marks to place every
  // observation in any bin, including while the student revises the display.
  const maxCount = Math.max(total, ...fields.flatMap(field => field.options.map(Number)).filter(Number.isFinite));
  const raw = parts.join("|");
  return <div className="mt-fields">
    {stem ? <StemEditor prompt={prompt} labels={fields.map(f => f.label)} disabled={disabled} onChange={setParts} />
      : <>
        <p>Tap a {control.kind === "dotplot" ? "tick" : "bin"} to change its count.</p>
        <Visual data={{ kind: control.kind, labels: fields.map(f => f.label.replace(/^Dots over /, "")), values: parts.map(Number) }}
          editChart={{ active: disabled ? null : active, select: index => { if (!disabled) setActive(index); }, maxCount, change: (index, delta) => setParts(previous =>
            previous.map((value, i) => i === index ? String(Math.min(maxCount, Math.max(0, Number(value) + delta))) : value)) }} />
      </>}
    <button type="button" disabled={disabled || !complete(control, raw)} onClick={() => onAnswer(raw)}>Check display</button>
  </div>;
}
