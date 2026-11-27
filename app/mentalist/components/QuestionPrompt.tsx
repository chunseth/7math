import { useCallback, useState, type ReactNode } from "react";
import type { Question } from "../../../lib/mentalist/model";

const notation = /(?:[A-Z]′?\s*)?\([−-]?\d+(?:\.\d+)?,\s*[−-]?\d+(?:\.\d+)?\)|\^(?:\(([^()]+)\)|([−-]?(?:\d+|[a-z])))/g;

export function useQuestionPart(question?: Question) {
  const [part, setPart] = useState<{ question?: Question; title: string }>();
  const setPartTitle = useCallback((title: string) => setPart({ question, title }), [question]);
  return { partTitle: part?.question === question ? part?.title : undefined, setPartTitle };
}

export default function QuestionPrompt({ text, part }: { text: string; part?: string }) {
  return <>
    {part && <span className="mt-prompt-part" aria-live="polite">{part}</span>}
    <span className={part ? "mt-prompt-context" : undefined}>{format(text)}</span>
  </>;
}

function format(text: string) {
  const pieces: ReactNode[] = [];
  let start = 0;
  for (const match of text.matchAll(notation)) {
    const i = match.index;
    pieces.push(text.slice(start, i));
    const exponent = match[1] ?? match[2];
    pieces.push(exponent !== undefined ? <sup key={i}>{exponent}</sup>
      : <span key={i} className="mt-prompt-coordinate">{match[0]}</span>);
    start = i + match[0].length;
  }
  pieces.push(text.slice(start));
  return pieces;
}
